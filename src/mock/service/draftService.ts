import {
  DraftSourceType,
  DraftStatus,
  LockFlag,
  PaperType,
  QuestionType,
  RoleType,
  TitleFormat,
  Visibility,
} from '@/constants/enums'
import type {
  DraftDetail,
  DraftListItem,
  DraftQuestionItem,
  PaperDraft,
  Question,
  QuestionOption,
} from '@/types/models'
import { getDb, newStamp, nextId, nowIso, saveDb, softDelete } from '../db'
import { noPermission, notFound } from '../errors'
import {
  allCategories,
  allDrafts,
  allExamQuestions,
  allQuestions,
  categoryTagIds,
  draftRels,
  examQuestionsByQuestion,
  findCategory,
  findDraft,
  findQuestion,
  findUser,
  insertDraftQuestionRel,
  insertQuestionTagRel,
  lockedDraftsReferencing,
  questionTagIds,
  questionTagNames,
  relsByQuestion,
} from '../repo'
import { parseOptions, stringifyOptions, defaultOptionsFor, isObjective, validateQuestion } from '../rules/judge'
import {
  applyDraftLock,
  applyQuestionLockByDraft,
  canEditDraft,
  isQuestionDeletable,
  isPubliclyListed,
  isQuestionReadOnlyInDraft,
  validateDraftForEnable,
} from '../rules/lock'

/** 试卷服务（对应业务需求文档第二章） */

function toListItem(draft: PaperDraft): DraftListItem {
  const owner = findUser(draft.userId)
  return {
    ...draft,
    categoryName: findCategory(draft.categoryId)?.categoryName ?? '—',
    ownerName: owner ? owner.username : '已注销用户',
    canEdit: canEditDraft(draft),
  }
}

/** 公开试卷广场：仅启用状态的公开试卷 */
export function listPublicDrafts(filter?: {
  categoryId?: number | null
  paperType?: number | null
  keyword?: string
}): DraftListItem[] {
  return allDrafts()
    .filter(isPubliclyListed)
    .filter((d) => (filter?.categoryId ? d.categoryId === filter.categoryId : true))
    .filter((d) => (filter?.paperType ? d.paperType === filter.paperType : true))
    .filter((d) =>
      filter?.keyword ? d.draftName.toLowerCase().includes(filter.keyword.toLowerCase()) : true,
    )
    .sort((a, b) => (b.enableTime ?? '').localeCompare(a.enableTime ?? ''))
    .map(toListItem)
}

/** 我的试卷（不含废弃——废弃后原创建者不再看到） */
export function listMyDrafts(userId: number): DraftListItem[] {
  return allDrafts()
    .filter((d) => d.userId === userId && d.draftStatus !== DraftStatus.DISCARDED)
    .sort((a, b) => (b.updateTime ?? b.createTime).localeCompare(a.updateTime ?? a.createTime))
    .map(toListItem)
}

/** 管理端：全部废弃试卷（只读审计） */
export function listDiscardedDrafts(): DraftListItem[] {
  return allDrafts()
    .filter((d) => d.draftStatus === DraftStatus.DISCARDED)
    .sort((a, b) => (b.updateTime ?? b.createTime).localeCompare(a.updateTime ?? a.createTime))
    .map(toListItem)
}

/** 试卷详情（权限：私有试卷仅创建者可见；废弃试卷仅管理员可见） */
export function getDraftDetail(draftId: number, viewerId: number | null): DraftDetail {
  const draft = findDraft(draftId)
  if (!draft) throw notFound('试卷不存在')
  const viewer = viewerId ? findUser(viewerId) : null
  const isAdmin = viewer?.roleType === RoleType.ADMIN

  if (draft.draftStatus === DraftStatus.DISCARDED && !isAdmin) {
    // 对非管理员而言已废弃试卷等同不可访问资源（S4：资源不可用）
    throw notFound('该试卷已废弃，仅供管理员审计')
  }
  if (draft.visibility === Visibility.PRIVATE && draft.userId !== viewerId) {
    // 已登录但非所有者（或游客）访问私有试卷 → S3 无权限
    throw noPermission('无权访问他人的私有试卷')
  }

  const questions: DraftQuestionItem[] = draftRels(draftId)
    .map((rel) => {
      const question = findQuestion(rel.questionId)
      if (!question) return null
      return {
        relId: rel.id,
        questionId: question.id,
        sortNo: rel.sortNo,
        score: rel.score,
        question,
        tagIds: questionTagIds(question.id),
        tagNames: questionTagNames(question.id),
      }
    })
    .filter((v): v is DraftQuestionItem => v !== null)

  return {
    draft,
    category: findCategory(draft.categoryId)!,
    owner: findUser(draft.userId) ?? ({ username: '已注销用户' } as never),
    questions,
    canEdit: canEditDraft(draft) && draft.userId === viewerId,
    lockedQuestionCount: questions.filter((q) => q.question.isLocked === LockFlag.LOCKED).length,
  }
}

export interface CreateDraftParams {
  draftName: string
  categoryId: number
  paperType: PaperType
  visibility: Visibility
  randomOrder?: number
}

/**
 * 新建试卷
 * 默认可见性按角色：管理员默认公开，普通用户默认私有（P0-12 决策）
 */
export function createDraft(userId: number, params: CreateDraftParams): PaperDraft {
  const user = findUser(userId)
  if (!user) throw new Error('用户不存在')
  if (!params.draftName.trim()) throw new Error('试卷名称不能为空')
  if (!findCategory(params.categoryId)) throw new Error('试卷分类不存在')

  const db = getDb()
  const stamp = newStamp()
  const draft: PaperDraft = {
    id: nextId('drafts'),
    deleted: 0,
    ...stamp,
    draftName: params.draftName.trim(),
    userId,
    categoryId: params.categoryId,
    paperType: params.paperType,
    visibility: params.visibility ?? (user.roleType === RoleType.ADMIN ? Visibility.PUBLIC : Visibility.PRIVATE),
    draftStatus: DraftStatus.DISABLED,
    isLocked: LockFlag.UNLOCKED,
    sourceType: DraftSourceType.MANUAL,
    randomOrder: params.randomOrder ?? 0,
    questionCount: 0,
    enableTime: null,
  }
  db.drafts.push(draft)
  return draft
}

function assertOwnership(draft: PaperDraft, userId: number): void {
  const user = findUser(userId)
  // 权限约束：所有人（含管理员）都不能修改他人试卷
  if (draft.userId !== userId) {
    throw new Error(
      user?.roleType === RoleType.ADMIN ? '管理员不可编辑他人试卷（可停用做内容治理）' : '不能修改他人创建的试卷',
    )
  }
}

/** 修改试卷基础信息（需处于"停用且未锁定"状态） */
export function updateDraftMeta(
  draftId: number,
  userId: number,
  params: Partial<CreateDraftParams>,
): PaperDraft {
  const draft = findDraft(draftId)
  if (!draft) throw new Error('试卷不存在')
  assertOwnership(draft, userId)
  if (!canEditDraft(draft)) {
    throw new Error('试卷处于启用或已锁定状态，不可编辑（启用即永久锁定）')
  }
  if (params.draftName !== undefined) {
    if (!params.draftName.trim()) throw new Error('试卷名称不能为空')
    draft.draftName = params.draftName.trim()
  }
  if (params.categoryId !== undefined) {
    if (!findCategory(params.categoryId)) throw new Error('试卷分类不存在')
    draft.categoryId = params.categoryId
  }
  if (params.paperType !== undefined) draft.paperType = params.paperType
  if (params.visibility !== undefined) draft.visibility = params.visibility
  if (params.randomOrder !== undefined) draft.randomOrder = params.randomOrder
  draft.updateTime = nowIso()
  return draft
}

/** 启用 / 停用切换；首次启用触发永久锁定 */
export function switchDraftStatus(
  draftId: number,
  userId: number,
  target: DraftStatus,
): { draft: PaperDraft; lockedQuestionCount: number; message: string } {
  const draft = findDraft(draftId)
  if (!draft) throw new Error('试卷不存在')
  assertOwnership(draft, userId)
  if (draft.draftStatus === DraftStatus.DISCARDED) throw new Error('废弃试卷不可变更状态')

  if (target === DraftStatus.ENABLED) {
    const errors = validateDraftForEnable(draftId)
    if (errors.length > 0) {
      throw new Error(`启用前置校验未通过：\n${errors.slice(0, 5).join('\n')}`)
    }
    if (draft.isLocked === LockFlag.UNLOCKED) applyDraftLock(draft, nowIso())
    draft.draftStatus = DraftStatus.ENABLED
    const locked = applyQuestionLockByDraft(draftId, nowIso())
    return {
      draft,
      lockedQuestionCount: locked,
      message:
        locked > 0
          ? `试卷已启用并永久锁定；同时 ${locked} 道题目继承锁定（题干、答案与分值不可再修改）`
          : '试卷已启用并永久锁定',
    }
  }

  draft.draftStatus = DraftStatus.DISABLED
  draft.updateTime = nowIso()
  return {
    draft,
    lockedQuestionCount: 0,
    message:
      draft.isLocked === LockFlag.LOCKED
        ? '试卷已停用：不再对外可答题，但因已锁定仍不可编辑'
        : '试卷已停用：可继续编辑',
  }
}

/** 逻辑删除试卷 → 标记废弃（原创建者不再可见） */
export function discardDraft(draftId: number, userId: number): void {
  const draft = findDraft(draftId)
  if (!draft) throw new Error('试卷不存在')
  assertOwnership(draft, userId)
  draft.draftStatus = DraftStatus.DISCARDED
  draft.updateTime = nowIso()
}

/**
 * 另存为新试卷（修正通道）
 * 复制题目、顺序、分值与本试卷内配置，生成一份全新的"停用且未锁定"试卷。
 */
export function saveDraftAs(draftId: number, userId: number, newName: string): PaperDraft {
  const source = findDraft(draftId)
  if (!source) throw new Error('试卷不存在')
  if (!newName.trim()) throw new Error('新试卷名称不能为空')

  const db = getDb()
  const stamp = newStamp()
  const copy: PaperDraft = {
    id: nextId('drafts'),
    deleted: 0,
    ...stamp,
    draftName: newName.trim(),
    userId,
    categoryId: source.categoryId,
    paperType: source.paperType,
    visibility: Visibility.PRIVATE,
    draftStatus: DraftStatus.DISABLED,
    isLocked: LockFlag.UNLOCKED,
    sourceType: DraftSourceType.MANUAL,
    randomOrder: source.randomOrder,
    questionCount: 0,
    enableTime: null,
  }
  db.drafts.push(copy)

  const rels = draftRels(draftId)
  rels.forEach((rel, index) => {
    insertDraftQuestionRel(copy.id, rel.questionId, index + 1, rel.score)
  })
  copy.questionCount = rels.length
  return copy
}

/* --------------------------- 试卷内题目 --------------------------- */

function assertEditable(draftId: number, userId: number): PaperDraft {
  const draft = findDraft(draftId)
  if (!draft) throw new Error('试卷不存在')
  assertOwnership(draft, userId)
  if (!canEditDraft(draft)) {
    throw new Error('试卷处于启用或已锁定状态，不可编辑题目')
  }
  return draft
}

export interface QuestionPayload {
  questionType: QuestionType
  title: string
  options?: QuestionOption[]
  answer: string
  analysis?: string | null
  score: number
  tagIds: number[]
}

function buildQuestion(payload: QuestionPayload): Question {
  const stamp = newStamp()
  const question: Question = {
    id: nextId('questions'),
    deleted: 0,
    ...stamp,
    questionType: payload.questionType,
    title: payload.title.trim(),
    titleFormat: TitleFormat.PLAIN,
    options:
      payload.questionType === QuestionType.SHORT_ANSWER
        ? null
        : stringifyOptions(payload.options ?? defaultOptionsFor(payload.questionType)),
    answer: payload.answer.trim(),
    analysis: payload.analysis ?? null,
    score: payload.score,
    isLocked: LockFlag.UNLOCKED,
  }
  return question
}

/** 在试卷内新建题目（同时建立关联） */
export function createQuestionInDraft(
  draftId: number,
  userId: number,
  payload: QuestionPayload,
): Question {
  assertEditable(draftId, userId)
  const question = buildQuestion(payload)
  const errors = validateQuestion(question)
  if (errors.length > 0) throw new Error(errors.join('\n'))

  getDb().questions.push(question)
  payload.tagIds.forEach((tagId) => insertQuestionTagRel(question.id, tagId))

  const rels = draftRels(draftId)
  insertDraftQuestionRel(draftId, question.id, rels.length + 1, payload.score)
  const draft = findDraft(draftId)!
  draft.questionCount = rels.length + 1
  draft.updateTime = nowIso()
  return question
}

/** 从题库引用已有题目到本试卷（题目可被多份试卷共享） */
export function attachQuestionToDraft(
  draftId: number,
  userId: number,
  questionId: number,
  score?: number,
): void {
  assertEditable(draftId, userId)
  const question = findQuestion(questionId)
  if (!question) throw new Error('题目不存在')
  const exists = draftRels(draftId).some((rel) => rel.questionId === questionId)
  if (exists) throw new Error('该题目已在当前试卷中')

  const rels = draftRels(draftId)
  insertDraftQuestionRel(draftId, questionId, rels.length + 1, score ?? question.score)
  const draft = findDraft(draftId)!
  draft.questionCount = rels.length + 1
  draft.updateTime = nowIso()
}

/**
 * 修改题目内容
 * - 题目被任一已锁定试卷引用 → 只读（锁定三件套之②）
 * - 分值：本试卷内的分值写入关联表，题目默认分值同步更新
 */
export function updateQuestion(
  draftId: number,
  userId: number,
  questionId: number,
  payload: QuestionPayload,
  relScore?: number,
): Question {
  assertEditable(draftId, userId)
  const question = findQuestion(questionId)
  if (!question) throw new Error('题目不存在')
  if (question.isLocked === LockFlag.LOCKED) {
    const names = lockedDraftsReferencing(questionId).map((d) => d.draftName)
    throw new Error(
      `该题目已被锁定试卷引用（${names.join('、')}），内容不可修改。如需调整，请使用"复制为新题"。`,
    )
  }

  const merged: Question = {
    ...question,
    questionType: payload.questionType,
    title: payload.title.trim(),
    options:
      payload.questionType === QuestionType.SHORT_ANSWER
        ? null
        : stringifyOptions(payload.options ?? defaultOptionsFor(payload.questionType)),
    answer: payload.answer.trim(),
    analysis: payload.analysis ?? null,
    score: payload.score,
    updateTime: nowIso(),
  }
  const errors = validateQuestion(merged)
  if (errors.length > 0) throw new Error(errors.join('\n'))

  Object.assign(question, merged)

  // 标签维护（不受锁定限制）
  const db = getDb()
  const current = questionTagIds(questionId)
  const next = payload.tagIds
  db.questionTagRels
    .filter((r) => r.questionId === questionId && r.deleted === 0 && !next.includes(r.tagId))
    .forEach((r) => {
      r.deleted = r.id
      r.deleteTime = nowIso()
    })
  next
    .filter((tagId) => !current.includes(tagId))
    .forEach((tagId) => insertQuestionTagRel(questionId, tagId))

  if (relScore !== undefined) {
    const rel = draftRels(draftId).find((r) => r.questionId === questionId)
    if (rel) {
      rel.score = relScore
      rel.updateTime = nowIso()
    }
  }
  return question
}

/**
 * 复制为新题（锁定题目的修改通道）
 * 以原题内容生成一道新题目，仅在本试卷中引用；原题目及其历史引用保持不变。
 */
export function copyQuestionAsNew(
  draftId: number,
  userId: number,
  questionId: number,
): Question {
  assertEditable(draftId, userId)
  const source = findQuestion(questionId)
  if (!source) throw new Error('题目不存在')

  const question = buildQuestion({
    questionType: source.questionType,
    title: source.title,
    options: parseOptions(source.options),
    answer: source.answer,
    analysis: source.analysis,
    score: source.score,
    tagIds: [],
  })
  getDb().questions.push(question)
  questionTagIds(questionId).forEach((tagId) => insertQuestionTagRel(question.id, tagId))

  const rels = draftRels(draftId)
  insertDraftQuestionRel(draftId, question.id, rels.length + 1, source.score)
  const draft = findDraft(draftId)!
  draft.questionCount = rels.length + 1
  draft.updateTime = nowIso()
  return question
}

/** 解绑题目（对只读题目同样允许） */
export function detachQuestionFromDraft(draftId: number, userId: number, relId: number): void {
  assertEditable(draftId, userId)
  const db = getDb()
  const rel = db.draftQuestionRels.find((r) => r.id === relId && r.deleted === 0)
  if (!rel) throw new Error('关联不存在')
  softDelete(db.draftQuestionRels, relId)

  const rels = draftRels(draftId)
  rels.forEach((r, index) => {
    r.sortNo = index + 1
  })
  const draft = findDraft(draftId)!
  draft.questionCount = rels.length
  draft.updateTime = nowIso()
}

/** 调整题目顺序 */
export function moveQuestion(draftId: number, userId: number, relId: number, delta: number): void {
  assertEditable(draftId, userId)
  const rels = draftRels(draftId)
  const index = rels.findIndex((r) => r.id === relId)
  if (index < 0) return
  const target = index + delta
  if (target < 0 || target >= rels.length) return
  const [moved] = rels.splice(index, 1)
  rels.splice(target, 0, moved)
  rels.forEach((r, i) => {
    r.sortNo = i + 1
    r.updateTime = nowIso()
  })
}

/** 修改本试卷内单题分值（启用前置校验必须通过） */
export function updateRelScore(
  draftId: number,
  userId: number,
  relId: number,
  score: number,
): void {
  assertEditable(draftId, userId)
  if (score <= 0) throw new Error('分值必须大于 0')
  const rel = getDb().draftQuestionRels.find((r) => r.id === relId && r.deleted === 0)
  if (!rel) throw new Error('关联不存在')
  rel.score = score
  rel.updateTime = nowIso()
}

/** 删除题目（受删除保护约束） */
export function deleteQuestion(userId: number, questionId: number): void {
  const question = findQuestion(questionId)
  if (!question) throw new Error('题目不存在')
  const { deletable, reasons } = isQuestionDeletable(questionId)
  if (!deletable) {
    throw new Error(`该题目禁止删除：\n${reasons.join('\n')}`)
  }
  const db = getDb()
  // 同时解绑全部引用，避免悬挂
  relsByQuestion(questionId).forEach((rel) => softDelete(db.draftQuestionRels, rel.id))
  softDelete(db.questions, questionId)
}

/** 题目在本试卷内是否只读（被其他已锁定试卷引用） */
export function questionReadOnly(draftId: number, questionId: number): boolean {
  return isQuestionReadOnlyInDraft(questionId, draftId)
}

/* --------------------------- 题库 --------------------------- */

export interface QuestionBankItem {
  question: Question
  tagNames: string[]
  usedByDraftCount: number
  usedByExamCount: number
  lockedDraftNames: string[]
}

/** 题库（管理员纠错与试卷选题使用） */
export function listQuestionBank(filter?: {
  keyword?: string
  tagId?: number | null
  questionType?: number | null
}): QuestionBankItem[] {
  return allQuestions()
    .filter((q) =>
      filter?.keyword ? q.title.toLowerCase().includes(filter.keyword.toLowerCase()) : true,
    )
    .filter((q) =>
      filter?.tagId ? questionTagIds(q.id).includes(filter.tagId) : true,
    )
    .filter((q) => (filter?.questionType ? q.questionType === filter.questionType : true))
    .map((question) => ({
      question,
      tagNames: questionTagNames(question.id),
      usedByDraftCount: relsByQuestion(question.id).length,
      usedByExamCount: examQuestionsByQuestion(question.id).length,
      lockedDraftNames: lockedDraftsReferencing(question.id).map((d) => d.draftName),
    }))
}

/** 单人可选题库范围：要求标签在分类白名单内时给出提示 */
export function availableTagsForCategory(categoryId: number): number[] {
  return categoryTagIds(categoryId)
}

/** 试卷可作答性说明 */
export function draftAnswerHint(draft: PaperDraft): string | null {
  if (draft.draftStatus !== DraftStatus.ENABLED) return '试卷未启用，暂不可发起答题'
  if (draft.isLocked === LockFlag.LOCKED && draft.questionCount === 0) return '试卷没有题目'
  return null
}

/** 是否存在历史作答（用于判断题目删除保护） */
export function hasExamReference(questionId: number): boolean {
  return allExamQuestions().some((eq) => eq.questionId === questionId)
}

/** 分类列表（试卷编辑下拉使用） */
export function categories() {
  return allCategories()
}

/** 题型是否需要选项 */
export function needsOptions(type: QuestionType): boolean {
  return isObjective(type)
}

export { saveDb }
