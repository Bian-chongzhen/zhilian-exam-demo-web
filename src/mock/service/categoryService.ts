import { EnabledFlag } from '@/constants/enums'
import type { CategoryDetail, PaperCategory, QuestionTag } from '@/types/models'
import { getDb, newStamp, nextId, nowIso, softDelete } from '../db'
import {
  allCategories,
  allDrafts,
  allTags,
  categoryTagIds,
  categoryWeightMap,
  findCategory,
  findTag,
  insertCategoryTagRel,
  insertCategoryWeight,
  questionTagIds,
  insertQuestionTagRel,
} from '../repo'
import { requireAdmin } from './authService'

/** 管理端服务：试卷分类、考点标签、题库纠错（对应业务需求文档第三、四章） */

export function listCategories(): CategoryDetail[] {
  return allCategories().map((category) => {
    const weightMap = categoryWeightMap(category.id)
    return {
      ...category,
      tagIds: categoryTagIds(category.id),
      weights: [...weightMap.entries()].map(([tagId, weight]) => ({ tagId, weight })),
      draftCount: allDrafts().filter((d) => d.categoryId === category.id).length,
    }
  })
}

export interface CategoryPayload {
  categoryName: string
  fixedQuestionCount: number
  tagIds: number[]
  weights: Array<{ tagId: number; weight: number }>
}

export function createCategory(operatorId: number, payload: CategoryPayload): PaperCategory {
  requireAdmin()
  if (!payload.categoryName.trim()) throw new Error('分类名称不能为空')
  if (allCategories().some((c) => c.categoryName === payload.categoryName.trim())) {
    throw new Error('分类名称已存在')
  }
  if (payload.fixedQuestionCount <= 0) throw new Error('固定题量必须大于 0')

  const db = getDb()
  const stamp = newStamp()
  const category: PaperCategory = {
    id: nextId('categories'),
    deleted: 0,
    ...stamp,
    categoryName: payload.categoryName.trim(),
    fixedQuestionCount: payload.fixedQuestionCount,
    isSystem: 0,
    sortNo: allCategories().length + 1,
  }
  db.categories.push(category)
  syncCategoryTags(category.id, payload)
  return category
}

export function updateCategory(
  operatorId: number,
  categoryId: number,
  payload: CategoryPayload,
): PaperCategory {
  requireAdmin()
  const category = findCategory(categoryId)
  if (!category) throw new Error('分类不存在')
  if (!payload.categoryName.trim()) throw new Error('分类名称不能为空')
  if (
    allCategories().some(
      (c) => c.id !== categoryId && c.categoryName === payload.categoryName.trim(),
    )
  ) {
    throw new Error('分类名称已存在')
  }
  if (payload.fixedQuestionCount <= 0) throw new Error('固定题量必须大于 0')

  category.categoryName = payload.categoryName.trim()
  category.fixedQuestionCount = payload.fixedQuestionCount
  category.updateTime = nowIso()
  syncCategoryTags(categoryId, payload)
  return category
}

/** 同步分类包含的考点标签与权重配置 */
function syncCategoryTags(categoryId: number, payload: CategoryPayload): void {
  const db = getDb()
  const current = categoryTagIds(categoryId)
  const next = payload.tagIds

  db.categoryTagRels
    .filter((r) => r.categoryId === categoryId && r.deleted === 0 && !next.includes(r.tagId))
    .forEach((r) => {
      r.deleted = r.id
      r.deleteTime = nowIso()
    })
  next.filter((tagId) => !current.includes(tagId)).forEach((tagId) => insertCategoryTagRel(categoryId, tagId))

  // 未出现在 weights 中的标签 = 未配置 → 抽题时按均权 1.00 处理
  payload.weights
    .filter((w) => next.includes(w.tagId))
    .forEach((w) => insertCategoryWeight(categoryId, w.tagId, w.weight))
}

/** 删除分类：预置分类不可删；仍被试卷引用则阻止 */
export function deleteCategory(operatorId: number, categoryId: number): void {
  requireAdmin()
  const category = findCategory(categoryId)
  if (!category) throw new Error('分类不存在')
  if (category.isSystem === 1) throw new Error('系统预置分类不可删除')

  const used = allDrafts().filter((d) => d.categoryId === categoryId)
  if (used.length > 0) {
    throw new Error(`该分类仍被 ${used.length} 份试卷引用，请先处理这些试卷`)
  }

  const db = getDb()
  db.categoryTagRels
    .filter((r) => r.categoryId === categoryId && r.deleted === 0)
    .forEach((r) => softDelete(db.categoryTagRels, r.id))
  db.categoryWeights
    .filter((r) => r.categoryId === categoryId && r.deleted === 0)
    .forEach((r) => softDelete(db.categoryWeights, r.id))
  softDelete(db.categories, categoryId)
}

/* ------------------------------ 考点标签 ------------------------------ */

export function listTags(includeDisabled = true): Array<QuestionTag & { usedCount: number }> {
  const db = getDb()
  return allTags()
    .filter((t) => (includeDisabled ? true : t.isEnabled === EnabledFlag.ENABLED))
    .map((tag) => ({
      ...tag,
      usedCount: db.questionTagRels.filter((r) => r.tagId === tag.id && r.deleted === 0).length,
    }))
}

export function createTag(operatorId: number, tagName: string): QuestionTag {
  requireAdmin()
  if (!tagName.trim()) throw new Error('标签名称不能为空')
  if (allTags().some((t) => t.tagName === tagName.trim())) throw new Error('标签名称已存在')

  const db = getDb()
  const stamp = newStamp()
  const tag: QuestionTag = {
    id: nextId('tags'),
    deleted: 0,
    ...stamp,
    tagName: tagName.trim(),
    isEnabled: EnabledFlag.ENABLED,
    sortNo: allTags().length + 1,
  }
  db.tags.push(tag)
  return tag
}

export function updateTag(
  operatorId: number,
  tagId: number,
  payload: { tagName?: string; isEnabled?: number },
): QuestionTag {
  requireAdmin()
  const tag = findTag(tagId)
  if (!tag) throw new Error('标签不存在')
  if (payload.tagName !== undefined) {
    if (!payload.tagName.trim()) throw new Error('标签名称不能为空')
    if (allTags().some((t) => t.id !== tagId && t.tagName === payload.tagName!.trim())) {
      throw new Error('标签名称已存在')
    }
    tag.tagName = payload.tagName.trim()
  }
  if (payload.isEnabled !== undefined) tag.isEnabled = payload.isEnabled
  tag.updateTime = nowIso()
  return tag
}

/** 删除标签：被分类或题目引用时阻止，可改为停用 */
export function deleteTag(operatorId: number, tagId: number): void {
  requireAdmin()
  const db = getDb()
  const categoryRefs = db.categoryTagRels.filter((r) => r.tagId === tagId && r.deleted === 0).length
  const questionRefs = db.questionTagRels.filter((r) => r.tagId === tagId && r.deleted === 0).length
  if (categoryRefs > 0 || questionRefs > 0) {
    throw new Error(
      `该标签被 ${categoryRefs} 个分类、${questionRefs} 道题目引用，不可删除；建议改为"停用"`,
    )
  }
  softDelete(db.tags, tagId)
}

/* --------------------------- 题库纠错（题目标签维护） --------------------------- */

/**
 * 管理员直接调整任意题目的考点标签（题库纠错入口）
 * 注意：标签不受题目锁定限制（设计文档 2.4 第 4 条）
 */
export function adminUpdateQuestionTags(
  operatorId: number,
  questionId: number,
  tagIds: number[],
): void {
  requireAdmin()
  const db = getDb()
  const current = questionTagIds(questionId)
  db.questionTagRels
    .filter((r) => r.questionId === questionId && r.deleted === 0 && !tagIds.includes(r.tagId))
    .forEach((r) => {
      r.deleted = r.id
      r.deleteTime = nowIso()
    })
  tagIds.filter((id) => !current.includes(id)).forEach((id) => insertQuestionTagRel(questionId, id))
}

/** 分类的标签与权重配置（供试卷编辑时校验标签范围） */
export function categoryTagConfig(categoryId: number): {
  tagIds: number[]
  weights: Array<{ tagId: number; weight: number }>
} {
  const weightMap = categoryWeightMap(categoryId)
  return {
    tagIds: categoryTagIds(categoryId),
    weights: [...weightMap.entries()].map(([tagId, weight]) => ({ tagId, weight })),
  }
}
