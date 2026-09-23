import { DraftStatus, LockFlag, PaperType } from '@/constants/enums'
import type { PaperDraft, Question } from '@/types/models'
import {
  allExamQuestions,
  draftRels,
  examQuestionsByQuestion,
  findDraft,
  findQuestion,
  lockedDraftsReferencing,
  relsByQuestion,
} from '../repo'
import { validateQuestion } from './judge'

/**
 * 锁定三件套与编辑权限判定
 * 对应《4、业务需求（修订初版V1.0）.md》2.2 / 2.4 节与《5、数据库设计》6.4 节。
 */

/** ① 试卷是否可编辑：状态为停用 且 未锁定 */
export function canEditDraft(draft: PaperDraft): boolean {
  return draft.draftStatus === DraftStatus.DISABLED && draft.isLocked === LockFlag.UNLOCKED
}

/** 试卷是否可被他人选用答题 */
export function canAnswerDraft(draft: PaperDraft): boolean {
  return draft.draftStatus === DraftStatus.ENABLED
}

/** 试卷在公开列表中是否可见（仅启用状态的公开试卷） */
export function isPubliclyListed(draft: PaperDraft): boolean {
  return draft.draftStatus === DraftStatus.ENABLED && draft.visibility === 2
}

/**
 * ② 题目是否可编辑：未被任何已锁定试卷引用
 * 注意：考点标签不受此限制（设计文档 2.4 第 4 条）
 */
export function isQuestionEditable(questionId: number): boolean {
  const question = findQuestion(questionId)
  if (!question) return false
  return question.isLocked === LockFlag.UNLOCKED
}

/** 题目被哪些已锁定试卷引用（用于界面提示"因被《X》引用而锁定"） */
export function lockedDraftNames(questionId: number): string[] {
  return lockedDraftsReferencing(questionId).map((d) => d.draftName)
}

/**
 * ③ 题目删除保护：满足任一条件即禁止逻辑删除
 * - 被任一已锁定试卷引用
 * - 已被任一答题记录引用（即已产生历史作答）
 */
export function isQuestionDeletable(questionId: number): { deletable: boolean; reasons: string[] } {
  const reasons: string[] = []
  const locked = lockedDraftNames(questionId)
  if (locked.length > 0) {
    reasons.push(`已被锁定试卷引用：《${locked.join('》《')}》`)
  }
  const examRefs = examQuestionsByQuestion(questionId)
  if (examRefs.length > 0) {
    reasons.push(`已被 ${examRefs.length} 条历史答题记录引用`)
  }
  return { deletable: reasons.length === 0, reasons }
}

/** 题目当前被多少份试卷引用 */
export function referenceCount(questionId: number): number {
  return relsByQuestion(questionId).length
}

/** 对某份试卷而言，其题目是否为只读（被其他已锁定试卷引用） */
export function isQuestionReadOnlyInDraft(questionId: number, draftId: number): boolean {
  const others = lockedDraftsReferencing(questionId).filter((d) => d.id !== draftId)
  return others.length > 0
}

/**
 * 试卷启用前置校验（设计文档 2.2 第 4 条）
 * 返回错误列表，空数组表示可启用。
 */
export function validateDraftForEnable(draftId: number): string[] {
  const errors: string[] = []
  const draft = findDraft(draftId)
  if (!draft) return ['试卷不存在']
  if (draft.draftStatus === DraftStatus.DISCARDED) errors.push('废弃试卷不可启用')

  const rels = draftRels(draftId)
  if (rels.length === 0) {
    errors.push('试卷至少需要 1 道题目才能启用')
    return errors
  }

  const questions: Question[] = rels
    .map((rel) => findQuestion(rel.questionId))
    .filter((q): q is Question => !!q)

  if (questions.length !== rels.length) errors.push('存在已被删除的题目，请先清理')

  let totalScore = 0
  questions.forEach((q, index) => {
    const rel = rels[index]
    const errs = validateQuestion(q)
    // 试卷内的分值以关联表为准，覆盖题目默认分值
    if (rel && rel.score <= 0) errs.push(`题目#${q.id}：本试卷内分值必须大于 0`)
    errors.push(...errs)
    totalScore += rel?.score ?? q.score
  })

  if (totalScore <= 0) errors.push('试卷总分必须大于 0')
  return errors
}

/** 启用试卷：置锁定（一次性、不可回退），并让其引用的题目继承锁定 */
export function applyDraftLock(draft: PaperDraft, now: string): void {
  draft.isLocked = LockFlag.LOCKED
  draft.enableTime = draft.enableTime ?? now
  draft.updateTime = now
}

/** 让试卷引用的全部题目继承锁定 */
export function applyQuestionLockByDraft(draftId: number, now: string): number {
  let count = 0
  draftRels(draftId).forEach((rel) => {
    const question = findQuestion(rel.questionId)
    if (question && question.isLocked === LockFlag.UNLOCKED) {
      question.isLocked = LockFlag.LOCKED
      question.updateTime = now
      count += 1
    }
  })
  return count
}

/** 练习型/竞技型：v1 判分规则一致，类型仅用于筛选与统计维度 */
export function judgeRuleDescription(type: PaperType): string {
  return type === PaperType.COMPETITIVE
    ? '竞技型：多选必须全部选对才算正确，错选、漏选均判定错误'
    : '练习型：判分规则与竞技型一致（多选全对才算对），不预留部分得分能力'
}

/** 所有被历史答题记录引用过的题目 id（用于列表提示） */
export function questionIdsUsedByExam(): Set<number> {
  return new Set(allExamQuestions().map((eq) => eq.questionId))
}
