import { FavoriteTargetType, Visibility } from '@/constants/enums'
import type { Favorite, FavoriteItem } from '@/types/models'
import { getDb, newStamp, nextId, softDelete } from '../db'
import { findUser } from '../repo'

/**
 * 多态收藏服务（v1-plus 模块3）
 *
 * 依据《14、v1 plus.md》模块3 与 15 号 FA-01 ~ FA-07：
 *   - 可收藏三类资源：公开试卷底稿 / 题目 / 公开知识点
 *   - 同一用户不能重复收藏同一资源（唯一键：用户 + 类型 + 资源 id）
 *   - 收藏只是个人标记，**不改变资源本身的业务状态**
 *   - 资源被废弃 / 转为私有 / 被删除：收藏记录**不删除**，条目标记 available=false
 *     （界面置灰 + 「资源已不可访问」，仍可手动取消收藏）
 *   - 取消收藏：对应记录移除，广场与详情页的按钮状态同步
 */

const activeFavorites = (userId: number): Favorite[] =>
  getDb().favorites.filter((f) => f.deleted === 0 && f.userId === userId)

/** 某用户是否已收藏该资源 */
export function isFavorited(
  userId: number,
  targetType: FavoriteTargetType,
  targetId: number,
): boolean {
  return activeFavorites(userId).some(
    (f) => f.targetType === targetType && f.targetId === targetId,
  )
}

/** 批量查已收藏的资源 id（列表页批量标注星标状态，避免逐条请求） */
export function listFavoriteIds(
  userId: number,
  targetType: FavoriteTargetType,
): number[] {
  return activeFavorites(userId)
    .filter((f) => f.targetType === targetType)
    .map((f) => f.targetId)
}

/** 切换收藏状态，返回切换后的状态（true = 已收藏） */
export function toggleFavorite(
  userId: number,
  targetType: FavoriteTargetType,
  targetId: number,
): boolean {
  const db = getDb()
  const existing = db.favorites.find(
    (f) =>
      f.deleted === 0 && f.userId === userId && f.targetType === targetType && f.targetId === targetId,
  )
  if (existing) {
    softDelete(db.favorites, existing.id)
    return false
  }
  // 收藏前校验资源存在（不存在则视为不可收藏；已存在的历史记录仍保留在列表里）
  if (!resourceExists(targetType, targetId)) return false
  db.favorites.push({
    ...newStamp(),
    id: nextId('favorites'),
    deleted: 0,
    userId,
    targetType,
    targetId,
  })
  return true
}

function resourceExists(targetType: FavoriteTargetType, targetId: number): boolean {
  const db = getDb()
  if (targetType === FavoriteTargetType.DRAFT) {
    return db.drafts.some((d) => d.id === targetId && d.deleted === 0)
  }
  if (targetType === FavoriteTargetType.QUESTION) {
    return db.questions.some((q) => q.id === targetId && q.deleted === 0)
  }
  return db.knowledge.some((k) => k.id === targetId && k.deleted === 0)
}

/* --------------------------- 可用性与跳转目标 --------------------------- */

/** 试卷是否对当前用户可访问：未删除、未废弃，且（公开 或 本人创建） */
function draftAccessible(draftId: number, userId: number): boolean {
  const draft = getDb().drafts.find((d) => d.id === draftId && d.deleted === 0)
  if (!draft) return false
  if (draft.visibility === Visibility.PUBLIC) {
    // 已废弃的试卷对非管理员等同不可用（与试卷详情页的 S4 判定一致）
    return draft.draftStatus !== 3
  }
  return draft.userId === userId
}

/** 知识点是否对当前用户可访问：未删除，且（公开 或 本人创建） */
function knowledgeAccessible(knowledgeId: number, userId: number): boolean {
  const row = getDb().knowledge.find((k) => k.id === knowledgeId && k.deleted === 0)
  if (!row) return false
  if (row.visibility === Visibility.PUBLIC) return true
  return row.userId === userId
}

/** 题目是否还能看到：题目未删除，且至少有一份「对本人可见」的试卷引用它 */
function questionAccessible(questionId: number, userId: number): boolean {
  const db = getDb()
  const question = db.questions.find((q) => q.id === questionId && q.deleted === 0)
  if (!question) return false
  return db.draftQuestionRels
    .filter((r) => r.deleted === 0 && r.questionId === questionId)
    .some((r) => draftAccessible(r.draftId, userId))
}

/** 题目 → 可跳转的试卷（Q11：跳到所在试卷预览页并自动定位高亮该题） */
function questionLink(questionId: number, userId: number): string | null {
  const db = getDb()
  const rels = db.draftQuestionRels
    .filter((r) => r.deleted === 0 && r.questionId === questionId)
    .map((r) => db.drafts.find((d) => d.id === r.draftId && d.deleted === 0))
    .filter((d): d is NonNullable<typeof d> => !!d)
  const preferred =
    rels.find((d) => d.visibility === Visibility.PUBLIC && d.draftStatus !== 3) ??
    rels.find((d) => d.userId === userId)
  if (!preferred) return null
  // questionId 作为查询参数：预览页据此滚动并高亮该题（Q11 已定案）
  return `/drafts/${preferred.id}?questionId=${questionId}`
}

/* ------------------------------- 列表 ------------------------------- */

/** 我的收藏（按类型分 Tab 展示；每类各自分页由页面负责） */
export function listFavorites(userId: number, targetType: FavoriteTargetType): FavoriteItem[] {
  const db = getDb()
  return activeFavorites(userId)
    .filter((f) => f.targetType === targetType)
    .map((f) => buildItem(f, userId))
    .sort((a, b) => b.favoritedAt.localeCompare(a.favoritedAt))
}

function buildItem(favorite: Favorite, userId: number): FavoriteItem {
  const db = getDb()
  const base: FavoriteItem = {
    id: favorite.id,
    targetType: favorite.targetType,
    targetId: favorite.targetId,
    title: '资源已不可访问',
    subtitle: '',
    favoritedAt: favorite.createTime,
    available: false,
    link: null,
  }

  if (favorite.targetType === FavoriteTargetType.DRAFT) {
    const draft = db.drafts.find((d) => d.id === favorite.targetId && d.deleted === 0)
    if (!draft) return base
    const available = draftAccessible(draft.id, userId)
    const category = db.categories.find((c) => c.id === draft.categoryId)
    return {
      ...base,
      title: draft.draftName,
      subtitle: `${category?.categoryName ?? '—'} · ${draft.questionCount} 题`,
      available,
      link: available ? `/drafts/${draft.id}` : null,
    }
  }

  if (favorite.targetType === FavoriteTargetType.QUESTION) {
    const question = db.questions.find((q) => q.id === favorite.targetId && q.deleted === 0)
    if (!question) return base
    const available = questionAccessible(question.id, userId)
    const link = available ? questionLink(question.id, userId) : null
    return {
      ...base,
      title: question.title,
      subtitle: question.analysis ? '含解析' : '题目',
      // 题目存在但没有可见试卷时也算不可访问（跳不过去）
      available: available && link !== null,
      link,
    }
  }

  const knowledge = db.knowledge.find((k) => k.id === favorite.targetId && k.deleted === 0)
  if (!knowledge) return base
  const available = knowledgeAccessible(knowledge.id, userId)
  const tagNames = db.knowledgeTagRels
    .filter((r) => r.deleted === 0 && r.knowledgeId === knowledge.id)
    .map((r) => db.tags.find((t) => t.id === r.tagId && t.deleted === 0)?.tagName)
    .filter((n): n is string => !!n)
  return {
    ...base,
    title: knowledge.title,
    subtitle: tagNames.length > 0 ? tagNames.join('、') : '未绑定考点标签',
    available,
    link: available ? `/knowledge/${knowledge.id}` : null,
  }
}

/** 收藏总数（三类合计，供侧边栏或统计展示用） */
export function favoriteCount(userId: number): number {
  return activeFavorites(userId).length
}

/** 作者注销后的收藏处理：收藏记录保留（本人无法登录故不再使用），此处仅用于说明性查询 */
export function favoriteOwnerName(userId: number): string {
  return findUser(userId)?.username ?? '已注销用户'
}
