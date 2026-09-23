import { DraftSourceType, DraftStatus, LockFlag, Visibility } from '@/constants/enums'
import type { ComposeCandidate, ComposeParams, ComposePreview, PaperDraft } from '@/types/models'
import { getDb, newStamp, nextId } from '../db'
import { findCategory, findDraft, findQuestion, insertDraftQuestionRel } from '../repo'
import { buildCandidates, drawQuestions, previewCompose } from '../rules/compose'

/** 错题组卷服务（对应业务需求文档第八章） */

export interface ComposeResult {
  draft: PaperDraft
  picked: ComposeCandidate[]
  warnings: string[]
  /** 目标题量与实际生成题量不一致时给出提示 */
  downgraded: boolean
}

/** 组卷条件预校验（提交前调用） */
export function validateParams(userId: number, params: ComposeParams): string[] {
  const errors: string[] = []
  if (!params.categoryId) errors.push('请选择试卷分类')
  if (!params.paperType) errors.push('请选择试卷类型（竞技型 / 练习型，无默认值）')
  if (!params.draftName || !params.draftName.trim()) errors.push('请填写错题试卷名称')
  if (!findCategory(params.categoryId)) errors.push('试卷分类不存在')

  const { candidates } = buildCandidates(userId, params)
  if (candidates.length === 0) {
    errors.push('当前条件下没有可抽取的错题，请放宽条件或先做几道题')
  }
  return errors
}

/** 组卷预览（不落库） */
export function preview(userId: number, params: ComposeParams): ComposePreview {
  return previewCompose(userId, params)
}

/**
 * 生成错题复习试卷
 * 产物：归属当前用户、来源为"错题组卷"、状态停用且未锁定（可继续调整或直接启用）
 */
export function generate(userId: number, params: ComposeParams): ComposeResult {
  const errors = validateParams(userId, params)
  if (errors.length > 0) throw new Error(errors.join('\n'))

  const category = findCategory(params.categoryId)!
  const targetCount = params.targetCount ?? category.fixedQuestionCount
  const { candidates, warnings } = buildCandidates(userId, params)
  const picked = drawQuestions(candidates, params.strategy, targetCount)
  const downgraded = picked.length < targetCount
  if (downgraded) {
    warnings.push(`实际可抽题目仅 ${picked.length} 道，已按实际数量生成`)
  }

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
    visibility: params.visibility ?? Visibility.PRIVATE,
    draftStatus: DraftStatus.DISABLED,
    isLocked: LockFlag.UNLOCKED,
    sourceType: DraftSourceType.WRONG_COMPOSE,
    randomOrder: 0,
    questionCount: picked.length,
    enableTime: null,
  }
  db.drafts.push(draft)

  picked.forEach((candidate, index) => {
    const question = findQuestion(candidate.questionId)
    insertDraftQuestionRel(draft.id, candidate.questionId, index + 1, question?.score ?? 1)
  })

  return { draft, picked, warnings, downgraded }
}

/** 生成后立即启用并返回试卷（便捷路径：组卷 → 启用锁定 → 开始答题） */
export function generateAndEnable(userId: number, params: ComposeParams): ComposeResult {
  const result = generate(userId, params)
  result.draft.draftStatus = DraftStatus.ENABLED
  result.draft.isLocked = LockFlag.LOCKED
  result.draft.enableTime = new Date().toISOString()
  result.picked.forEach((candidate) => {
    const question = findQuestion(candidate.questionId)
    if (question) question.isLocked = LockFlag.LOCKED
  })
  return result
}

/** 默认试卷名称建议 */
export function suggestDraftName(userId: number, categoryId: number): string {
  const category = findCategory(categoryId)
  const db = getDb()
  const same = db.drafts.filter(
    (d) => d.userId === userId && d.categoryId === categoryId && d.deleted === 0,
  ).length
  return `${category?.categoryName ?? '错题'}复习卷（第 ${same + 1} 次组卷）`
}

/** 供界面展示：题目在候选集中的权重解释 */
export function candidateOf(
  candidates: ComposeCandidate[],
  questionId: number,
): ComposeCandidate | undefined {
  return candidates.find((c) => c.questionId === questionId)
}

/** 校验试卷是否为组卷产物 */
export function isComposedDraft(draftId: number): boolean {
  return findDraft(draftId)?.sourceType === DraftSourceType.WRONG_COMPOSE
}
