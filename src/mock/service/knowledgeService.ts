import { RoleType, Visibility } from '@/constants/enums'
import type {
  Knowledge,
  KnowledgeAnnotation,
  KnowledgeDetail,
  KnowledgeFilter,
  KnowledgeListItem,
  KnowledgeQuestionItem,
  KnowledgeQuestionRel,
  KnowledgeTagRel,
  KnowledgeTitleCheck,
  QuestionKnowledgeLink,
} from '@/types/models'
import { getDb, newStamp, nextId, nowIso, softDelete } from '../db'
import { noPermission, notFound } from '../errors'
import { findUser } from '../repo'

/**
 * 知识点知识库服务（v1-plus 模块1）
 *
 * 依据《14、v1 plus.md》§4 模块1 与 §6 全局规则：
 *   - 可见性复用底稿语义：私有仅作者可见，公开全平台可读
 *   - 删除为逻辑删除，**只解除关联**，不删除题目与标签实体
 *   - 双向关联：知识点侧的标签/题目关联与题目侧入口共用同一套关联数据
 *   - 注销衔接：作者的公开知识点保留、私有知识点对外失效（§4.4）
 *   - 批注仅本人可见（用户 + 知识点唯一）
 */

export interface KnowledgePayload {
  title: string
  summary?: string | null
  content: string
  /** 不传时按角色取默认值：普通用户私有、管理员公开（复用底稿规则） */
  visibility?: Visibility
  tagIds: number[]
  questionIds: number[]
}

/* ------------------------------- 内部工具 ------------------------------- */

const activeKnowledge = (): Knowledge[] => getDb().knowledge.filter((k) => k.deleted === 0)
const activeTagRels = (): KnowledgeTagRel[] =>
  getDb().knowledgeTagRels.filter((r) => r.deleted === 0)
const activeQuestionRels = (): KnowledgeQuestionRel[] =>
  getDb().knowledgeQuestionRels.filter((r) => r.deleted === 0)

function findKnowledge(id: number): Knowledge | undefined {
  return activeKnowledge().find((k) => k.id === id)
}

function tagIdsOf(knowledgeId: number): number[] {
  return activeTagRels()
    .filter((r) => r.knowledgeId === knowledgeId)
    .map((r) => r.tagId)
}

function tagNamesOf(knowledgeId: number): string[] {
  const db = getDb()
  return tagIdsOf(knowledgeId)
    .map((id) => db.tags.find((t) => t.id === id && t.deleted === 0)?.tagName)
    .filter((n): n is string => !!n)
}

/** 由「知识点 → 标签 → 分类归属」推导分类（14 号 §4.1：分类筛选是通过标签归属实现的） */
function categoriesOf(knowledgeId: number): Array<{ id: number; name: string }> {
  const db = getDb()
  const tagIds = new Set(tagIdsOf(knowledgeId))
  const categoryIds = new Set(
    db.categoryTagRels
      .filter((r) => r.deleted === 0 && tagIds.has(r.tagId))
      .map((r) => r.categoryId),
  )
  return [...categoryIds]
    .map((id) => db.categories.find((c) => c.id === id && c.deleted === 0))
    .filter((c): c is NonNullable<typeof c> => !!c)
    .map((c) => ({ id: c.id, name: c.categoryName }))
}

function toListItem(k: Knowledge): KnowledgeListItem {
  const author = findUser(k.userId)
  const cats = categoriesOf(k.id)
  return {
    ...k,
    authorName: author?.username ?? '已注销用户',
    authorDeleted: !author || author.deleted !== 0,
    tagIds: tagIdsOf(k.id),
    tagNames: tagNamesOf(k.id),
    categoryIds: cats.map((c) => c.id),
    categoryNames: cats.map((c) => c.name),
  }
}

/** 标题前缀匹配（Q6：trim 后不区分大小写） */
function matchTitlePrefix(title: string, keyword: string): boolean {
  const k = keyword.trim().toLowerCase()
  if (!k) return true
  return title.trim().toLowerCase().startsWith(k)
}

/**
 * 为一道题找「可跳转的试卷」：优先公开且启用的，其次本人的，最后任意可见的
 * （14 号 §4.2：点击关联题目跳转到底稿预览页）
 */
function draftRefForQuestion(questionId: number, viewerId: number | null): {
  draftId: number | null
  draftName: string | null
} {
  const db = getDb()
  const rels = db.draftQuestionRels.filter((r) => r.deleted === 0 && r.questionId === questionId)
  const candidates = rels
    .map((rel) => db.drafts.find((d) => d.id === rel.draftId && d.deleted === 0))
    .filter((d): d is NonNullable<typeof d> => !!d)
    // 游客/他人只能看公开且启用的试卷；本人还可以看自己的私有试卷
    .filter((d) => {
      if (d.draftStatus !== 1) return false // 1 = 启用
      if (d.visibility === Visibility.PUBLIC) return true
      return viewerId !== null && d.userId === viewerId
    })
  const preferred =
    candidates.find((d) => d.visibility === Visibility.PUBLIC) ??
    candidates.find((d) => viewerId !== null && d.userId === viewerId) ??
    candidates[0]
  return preferred
    ? { draftId: preferred.id, draftName: preferred.draftName }
    : { draftId: null, draftName: null }
}

/** 校验关联题目的合法性（Q2：本人全部底稿（含私有）+ 公开底稿；已删除题目不可选） */
function assertQuestionsSelectable(questionIds: number[], ownerId: number): void {
  if (questionIds.length === 0) return
  const db = getDb()
  const allowed = new Set(selectableQuestionIds(ownerId))
  for (const qid of questionIds) {
    const question = db.questions.find((x) => x.id === qid && x.deleted === 0)
    if (!question) throw notFound(`题目不存在：${qid}`)
    if (!allowed.has(qid)) throw noPermission('不能关联他人私有试卷中的题目')
  }
}

function selectableQuestionIds(ownerId: number): number[] {
  const db = getDb()
  const questionIds = new Set<number>()
  // 本人全部底稿（含私有）
  db.drafts
    .filter((d) => d.deleted === 0 && d.userId === ownerId)
    .forEach((d) =>
      db.draftQuestionRels
        .filter((r) => r.deleted === 0 && r.draftId === d.id)
        .forEach((r) => questionIds.add(r.questionId)),
    )
  // 全部公开底稿
  db.drafts
    .filter((d) => d.deleted === 0 && d.visibility === Visibility.PUBLIC)
    .forEach((d) =>
      db.draftQuestionRels
        .filter((r) => r.deleted === 0 && r.draftId === d.id)
        .forEach((r) => questionIds.add(r.questionId)),
    )
  return [...questionIds]
}

function replaceRelations(knowledgeId: number, tagIds: number[], questionIds: number[]): void {
  const db = getDb()
  const stamp = nowIso()
  // 先逻辑删除旧关联（复用 deleted = id 规范），再插入新关联
  db.knowledgeTagRels
    .filter((r) => r.knowledgeId === knowledgeId && r.deleted === 0)
    .forEach((r) => softDelete(db.knowledgeTagRels, r.id))
  db.knowledgeQuestionRels
    .filter((r) => r.knowledgeId === knowledgeId && r.deleted === 0)
    .forEach((r) => softDelete(db.knowledgeQuestionRels, r.id))

  tagIds.forEach((tagId) => {
    db.knowledgeTagRels.push({
      id: nextId('knowledgeTagRels'),
      deleted: 0,
      createTime: stamp,
      updateTime: stamp,
      knowledgeId,
      tagId,
    })
  })
  questionIds.forEach((questionId) => {
    db.knowledgeQuestionRels.push({
      id: nextId('knowledgeQuestionRels'),
      deleted: 0,
      createTime: stamp,
      updateTime: stamp,
      knowledgeId,
      questionId,
    })
  })
}

function assertOwner(knowledge: Knowledge, userId: number): void {
  // 管理员也不能编辑他人知识点（13 号 §5.3：管理员只做治理，不做内容编辑）
  if (knowledge.userId !== userId) throw noPermission('只能编辑自己创建的知识点')
}

/* -------------------------------- 查询 -------------------------------- */

/** 广场列表：**仅公开、未删除**；作者注销的公开知识点仍然展示并标注 */
export function listPublicKnowledge(filter: KnowledgeFilter = {}): KnowledgeListItem[] {
  const sort = filter.sort ?? 'created'
  const rows = activeKnowledge()
    .filter((k) => k.visibility === Visibility.PUBLIC)
    .filter((k) => matchTitlePrefix(k.title, filter.keyword ?? ''))
    .filter((k) => {
      if (!filter.categoryId) return true
      return categoriesOf(k.id).some((c) => c.id === filter.categoryId)
    })
    .filter((k) => {
      const selected = filter.tagIds ?? []
      if (selected.length === 0) return true
      // 多选标签：命中任一即算匹配
      const own = new Set(tagIdsOf(k.id))
      return selected.some((t) => own.has(t))
    })
    .map(toListItem)

  return sortKnowledge(rows, sort)
}

function sortKnowledge(rows: KnowledgeListItem[], sort: KnowledgeFilter['sort']): KnowledgeListItem[] {
  const list = [...rows]
  if (sort === 'title') {
    return list.sort((a, b) => a.title.localeCompare(b.title, 'zh-CN'))
  }
  if (sort === 'updated') {
    return list.sort((a, b) => (b.updateTime ?? '').localeCompare(a.updateTime ?? ''))
  }
  return list.sort((a, b) => b.createTime.localeCompare(a.createTime))
}

/** 我的知识点：本人创建的全部（私有 + 公开），含已注销账号不可登录故不存在该场景 */
export function listMyKnowledge(userId: number): KnowledgeListItem[] {
  return sortKnowledge(
    activeKnowledge()
      .filter((k) => k.userId === userId)
      .map(toListItem),
    'updated',
  )
}

/** 知识点详情：私有仅作者；作者已注销的私有知识点对外失效 */
export function getKnowledgeDetail(knowledgeId: number, viewerId: number | null): KnowledgeDetail {
  const knowledge = findKnowledge(knowledgeId)
  if (!knowledge) throw notFound('知识点不存在或已被删除')

  const author = findUser(knowledge.userId)
  const authorDeleted = !author || author.deleted !== 0
  const isOwner = viewerId !== null && knowledge.userId === viewerId

  if (knowledge.visibility === Visibility.PRIVATE) {
    if (authorDeleted && !isOwner) throw notFound('该知识点已不可访问')
    if (!isOwner) throw noPermission('私有知识点仅创建者本人可访问')
  }

  // 关联题目：已逻辑删除的题目直接移出列表（15 号 KD-05）
  const db = getDb()
  const questions: KnowledgeQuestionItem[] = activeQuestionRels()
    .filter((r) => r.knowledgeId === knowledgeId)
    .map((r) => {
      const question = db.questions.find((x) => x.id === r.questionId && x.deleted === 0)
      if (!question) return null
      const ref = draftRefForQuestion(question.id, viewerId)
      return {
        questionId: question.id,
        title: question.title,
        questionType: question.questionType,
        draftId: ref.draftId,
        draftName: ref.draftName,
      }
    })
    .filter((x): x is KnowledgeQuestionItem => !!x)

  return {
    knowledge,
    author: {
      id: author?.id ?? knowledge.userId,
      username: author?.username ?? '已注销用户',
      deleted: author?.deleted ?? 1,
    },
    tagIds: tagIdsOf(knowledgeId),
    tagNames: tagNamesOf(knowledgeId),
    questions,
    myAnnotation: viewerId === null ? null : getMyAnnotation(knowledgeId, viewerId),
    canEdit: isOwner,
  }
}

/** 某个用户创建的公开知识点（他人主页 / 注销用户主页展示用；私有永不外露） */
export function listPublicKnowledgeByUser(userId: number): KnowledgeListItem[] {
  return sortKnowledge(
    activeKnowledge()
      .filter((k) => k.userId === userId && k.visibility === Visibility.PUBLIC)
      .map(toListItem),
    'updated',
  )
}

/**
 * 批量版：多道题 → 各自可见的关联知识点
 * 答题回顾页与错题页一屏多题，用它避免逐题请求。
 */
export function listKnowledgeByQuestions(
  questionIds: number[],
  viewerId: number | null,
): Record<number, QuestionKnowledgeLink[]> {
  const result: Record<number, QuestionKnowledgeLink[]> = {}
  for (const qid of questionIds) {
    const links = listKnowledgeByQuestion(qid, viewerId)
    if (links.length > 0) result[qid] = links
  }
  return result
}

/** 供错题页 / 答题回顾页：某道题关联的、当前访问者可见的知识点 */
export function listKnowledgeByQuestion(
  questionId: number,
  viewerId: number | null,
): QuestionKnowledgeLink[] {
  const db = getDb()
  const ids = new Set(
    activeQuestionRels()
      .filter((r) => r.questionId === questionId)
      .map((r) => r.knowledgeId),
  )
  return activeKnowledge()
    .filter((k) => ids.has(k.id))
    .filter((k) => {
      if (k.visibility === Visibility.PUBLIC) {
        // 公开：作者的账号已注销也仍可读
        return true
      }
      return viewerId !== null && k.userId === viewerId
    })
    .map((k) => ({ id: k.id, title: k.title }))
    // 可能空数组：调用方据此把「查看关联知识点」入口置灰（15 号 CL-01）
    .sort((a, b) => a.id - b.id)
}

/** 编辑页「关联题目」可选范围（Q2 已定），供搜索下拉使用 */
export function searchSelectableQuestions(
  userId: number,
  keyword = '',
): KnowledgeQuestionItem[] {
  const db = getDb()
  const k = keyword.trim().toLowerCase()
  return selectableQuestionIds(userId)
    .map((qid) => db.questions.find((x) => x.id === qid && x.deleted === 0))
    .filter((x): x is NonNullable<typeof x> => !!x)
    .filter((q) => !k || q.title.toLowerCase().includes(k))
    .slice(0, 50)
    .map((q) => {
      const ref = draftRefForQuestion(q.id, userId)
      return {
        questionId: q.id,
        title: q.title,
        questionType: q.questionType,
        draftId: ref.draftId,
        draftName: ref.draftName,
      }
    })
}

/* ------------------------------ 标题查重 ------------------------------ */

/**
 * 保存前提示（14 号 §4.3）：
 *   - 公开知识点存在**完全同名**的公开知识点 → 二次确认后仍可保存
 *   - 输入标题时给出 3-5 条主题相近的公开知识点 → 仅提示，不阻止保存
 *   - 私有知识点不做标题重复校验
 */
export function checkKnowledgeTitle(title: string, excludeId?: number): KnowledgeTitleCheck {
  const t = title.trim()
  if (!t) return { exactDuplicate: false, similar: [] }
  const publics = activeKnowledge().filter(
    (k) => k.visibility === Visibility.PUBLIC && k.id !== excludeId,
  )
  const exactDuplicate = publics.some((k) => k.title.trim() === t)

  // 相似度只做「字面重合」的轻量判断（v1-plus 不做语义相似度，也不引入检索）
  const grams = (s: string): Set<string> => {
    const set = new Set<string>()
    for (let i = 0; i < s.length - 1; i++) set.add(s.slice(i, i + 2))
    return set
  }
  const target = grams(t)
  const similar = publics
    .map((k) => {
      const other = grams(k.title.trim())
      let hit = 0
      other.forEach((g) => {
        if (target.has(g)) hit++
      })
      const score = target.size === 0 ? 0 : hit / target.size
      return { id: k.id, title: k.title, score }
    })
    .filter((x) => x.score >= 0.34 && x.title.trim() !== t)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)
    .map(({ id, title: name }) => ({ id, title: name }))

  return { exactDuplicate, similar }
}

/* ------------------------------ 增删改 ------------------------------ */

/** 新建知识点：可见性不传时按角色取默认值（普通用户私有、管理员公开） */
export function createKnowledge(userId: number, payload: KnowledgePayload): Knowledge {
  const user = findUser(userId)
  if (!user || user.deleted !== 0) throw notFound('用户不存在')
  const title = payload.title.trim()
  if (!title) throw new Error('标题不能为空')
  if (!payload.content.trim()) throw new Error('正文不能为空')
  assertQuestionsSelectable(payload.questionIds, userId)

  const visibility =
    payload.visibility ?? (user.roleType === RoleType.ADMIN ? Visibility.PUBLIC : Visibility.PRIVATE)

  const article: Knowledge = {
    ...newStamp(),
    id: nextId('knowledge'),
    deleted: 0,
    userId,
    title,
    summary: payload.summary?.trim() || null,
    content: payload.content,
    visibility,
  }
  getDb().knowledge.push(article)
  replaceRelations(article.id, payload.tagIds, payload.questionIds)
  return article
}

/** 编辑知识点：仅作者本人；变更会刷新 updateTime（批注与收藏不刷新，Q3） */
export function updateKnowledge(
  knowledgeId: number,
  userId: number,
  payload: KnowledgePayload,
): Knowledge {
  const knowledge = findKnowledge(knowledgeId)
  if (!knowledge) throw notFound('知识点不存在或已被删除')
  assertOwner(knowledge, userId)
  const title = payload.title.trim()
  if (!title) throw new Error('标题不能为空')
  if (!payload.content.trim()) throw new Error('正文不能为空')
  assertQuestionsSelectable(payload.questionIds, userId)

  knowledge.title = title
  knowledge.summary = payload.summary?.trim() || null
  knowledge.content = payload.content
  if (payload.visibility) knowledge.visibility = payload.visibility
  knowledge.updateTime = nowIso()
  replaceRelations(knowledgeId, payload.tagIds, payload.questionIds)
  return knowledge
}

/** 删除知识点：逻辑删除 + 解除标签/题目关联；**不删除题目与标签实体**（14 号 §4.3 边界） */
export function deleteKnowledge(knowledgeId: number, userId: number): void {
  const knowledge = findKnowledge(knowledgeId)
  if (!knowledge) throw notFound('知识点不存在或已被删除')
  assertOwner(knowledge, userId)

  const db = getDb()
  db.knowledgeTagRels
    .filter((r) => r.knowledgeId === knowledgeId && r.deleted === 0)
    .forEach((r) => softDelete(db.knowledgeTagRels, r.id))
  db.knowledgeQuestionRels
    .filter((r) => r.knowledgeId === knowledgeId && r.deleted === 0)
    .forEach((r) => softDelete(db.knowledgeQuestionRels, r.id))
  softDelete(db.knowledge, knowledgeId)
}

/* -------------------------------- 批注 -------------------------------- */

function getMyAnnotation(knowledgeId: number, userId: number): string | null {
  const row = getDb().knowledgeAnnotations.find(
    (a) => a.deleted === 0 && a.knowledgeId === knowledgeId && a.userId === userId,
  )
  return row ? row.content : null
}

/** 保存本人批注：用户 + 知识点唯一，编辑覆盖；内容为空视为删除批注 */
export function saveMyAnnotation(knowledgeId: number, userId: number, content: string): void {
  const knowledge = findKnowledge(knowledgeId)
  if (!knowledge) throw notFound('知识点不存在或已被删除')
  const db = getDb()
  const existing = db.knowledgeAnnotations.find(
    (a) => a.deleted === 0 && a.knowledgeId === knowledgeId && a.userId === userId,
  )
  const text = content.trim()
  if (!text) {
    if (existing) softDelete(db.knowledgeAnnotations, existing.id)
    return
  }
  if (existing) {
    existing.content = text
    existing.updateTime = nowIso()
    return
  }
  db.knowledgeAnnotations.push({
    ...newStamp(),
    id: nextId('knowledgeAnnotations'),
    deleted: 0,
    knowledgeId,
    userId,
    content: text,
  })
}
