import { ExamSourceType, JudgeStatus, PrivacyType, QuestionType } from '@/constants/enums'
import type { ExamDetail, ExamListItem, ExamQuestionItem, PaperExam } from '@/types/models'
import { getDb, nowIso, softDelete } from '../db'
import {
  allExams,
  draftRels,
  examQuestionsOf,
  findDraft,
  findExam,
  findQuestion,
  findUser,
  questionTagNames,
} from '../repo'
import { isObjective, parseOptions } from '../rules/judge'
import { assertDraftAnswerable } from '../rules/exam'
import {
  createExam as ruleCreateExam,
  deleteExam as ruleDeleteExam,
  saveAnswer as ruleSaveAnswer,
  submitExam as ruleSubmitExam,
} from '../rules/exam'
import { listExamsOfUser } from '../rules/stat'

/** 答题记录服务（对应业务需求文档第六章） */

function assertExamOwner(exam: PaperExam, userId: number): void {
  if (exam.userId !== userId) throw new Error('无权操作他人的答题记录')
}

/** 发起答题：基于启用状态的试卷生成一份独立的答题记录 */
export function startExam(userId: number, draftId: number): PaperExam {
  const draft = findDraft(draftId)
  const error = assertDraftAnswerable(draft)
  if (error) throw new Error(error)

  const rels = draftRels(draftId)
  if (rels.length === 0) throw new Error('该试卷没有题目，无法发起答题')

  return ruleCreateExam(userId, draftId, ExamSourceType.NORMAL)
}

/** 续答：取该答题记录（未提交即可继续作答） */
export function getExamDetail(examId: number, userId: number): ExamDetail {
  const exam = findExam(examId)
  if (!exam) throw new Error('答题记录不存在')
  assertExamOwner(exam, userId)

  const submitted = !!exam.submitTime
  const items: ExamQuestionItem[] = examQuestionsOf(examId).map((eq) => {
    const question = findQuestion(eq.questionId)
    return {
      examQuestionId: eq.id,
      questionId: eq.questionId,
      sortNo: eq.sortNo,
      questionType: eq.questionType,
      score: eq.score,
      title: question?.title ?? '（题目已删除）',
      options: parseOptions(question?.options),
      // 未交卷不下发答案与解析，避免作弊
      answer: submitted ? question?.answer ?? null : null,
      analysis: submitted ? question?.analysis ?? null : null,
      tagNames: questionTagNames(eq.questionId),
      userAnswer: eq.userAnswer ?? null,
      judgeStatus: eq.judgeStatus,
      judgeResult: eq.judgeResult ?? null,
      obtainedScore: eq.obtainedScore ?? null,
      aiExplain: eq.aiExplain ?? null,
    }
  })

  return { exam, items, editable: !submitted }
}

/** 单题保存（自动保存调用，幂等）；返回该小题最新判分状态用于练习型即时反馈 */
export function saveAnswer(
  examId: number,
  userId: number,
  examQuestionId: number,
  userAnswer: string | null,
): { judgeStatus: number; judgeResult: number | null; obtainedScore: number | null } {
  const exam = findExam(examId)
  if (!exam) throw new Error('答题记录不存在')
  assertExamOwner(exam, userId)
  if (exam.submitTime) throw new Error('已交卷，不可再修改答案')
  const row = ruleSaveAnswer(examQuestionId, userAnswer)
  if (!row) throw new Error('保存失败：作答记录不存在或已交卷')
  return {
    judgeStatus: row.judgeStatus,
    judgeResult: row.judgeResult ?? null,
    obtainedScore: row.obtainedScore ?? null,
  }
}

export interface SubmitResult {
  exam: PaperExam
  judgedCount: number
  pendingCount: number
  wrongCount: number
  totalScore: number
  obtainedScore: number
  accuracy: number | null
}

/** 交卷结算 */
export function submitExam(examId: number, userId: number): SubmitResult {
  const exam = findExam(examId)
  if (!exam) throw new Error('答题记录不存在')
  assertExamOwner(exam, userId)

  const usedSeconds = Math.max(
    1,
    Math.round((Date.now() - new Date(exam.createTime).getTime()) / 1000),
  )
  const result = ruleSubmitExam(examId)
  result.exam.usedSeconds = usedSeconds

  const judged = result.judgedCount
  const rightCount = examQuestionsOf(examId).filter(
    (eq) => eq.judgeStatus === JudgeStatus.JUDGED && eq.judgeResult === 1,
  ).length

  return {
    exam: result.exam,
    judgedCount: result.judgedCount,
    pendingCount: result.pendingCount,
    wrongCount: result.wrongCount,
    totalScore: result.exam.totalScore ?? 0,
    obtainedScore: result.exam.obtainedScore ?? 0,
    accuracy: judged > 0 ? rightCount / judged : null,
  }
}

/** 我的答题记录 */
export function listMyExams(userId: number): ExamListItem[] {
  return listExamsOfUser(userId)
}

/** 未交卷答题记录（用于"继续作答"入口） */
export function listUnsubmitted(userId: number): ExamListItem[] {
  return listMyExams(userId).filter((e) => !e.submitTime)
}

/** 删除答题记录（错题明细保留，统计实时重算） */
export function deleteExam(examId: number, userId: number): void {
  const exam = findExam(examId)
  if (!exam) throw new Error('答题记录不存在')
  assertExamOwner(exam, userId)
  ruleDeleteExam(examId)
}

/** 供页面展示的题型等辅助信息 */
export function examQuestionTypeLabel(type: QuestionType): string {
  return isObjective(type) ? '客观题' : '简答题（v1 不判分，交卷后对照参考答案自评）'
}

/** 统计答题记录中已判分/待判分数量（列表用） */
export function countPending(examId: number): number {
  return examQuestionsOf(examId).filter((eq) => eq.judgeStatus !== JudgeStatus.JUDGED).length
}

/** 全量答题记录（管理端审计可扩展） */
export function allExamCount(): number {
  return allExams().length
}

/** 重置某答题记录的作答（Demo 便利功能，生产不提供） */
export function clearExamAnswers(examId: number, userId: number): void {
  const exam = findExam(examId)
  if (!exam) throw new Error('答题记录不存在')
  assertExamOwner(exam, userId)
  if (exam.submitTime) throw new Error('已交卷，不可清空作答')
  const db = getDb()
  db.examQuestions
    .filter((eq) => eq.examId === examId && eq.deleted === 0)
    .forEach((eq) => {
      eq.userAnswer = null
      eq.judgeStatus = JudgeStatus.PENDING
      eq.judgeResult = null
      eq.obtainedScore = null
      eq.updateTime = nowIso()
    })
}

/** 删除未交卷答题记录（用户放弃作答） */
export function abandonExam(examId: number, userId: number): void {
  const exam = findExam(examId)
  if (!exam) throw new Error('答题记录不存在')
  assertExamOwner(exam, userId)
  if (exam.submitTime) throw new Error('已交卷的答题记录请使用删除操作')
  const db = getDb()
  softDelete(db.exams, examId)
  db.examQuestions
    .filter((eq) => eq.examId === examId && eq.deleted === 0)
    .forEach((eq) => softDelete(db.examQuestions, eq.id))
}

/**
 * 他人视角查看答题记录
 * - 本人：完整内容
 * - 他人：仅在该用户主页为"公开"时可见，且隐去参考答案与解析（Q6 决策）
 */
export function getExamDetailForViewer(
  examId: number,
  viewerId: number | null,
  viewerIsAdmin = false,
): ExamDetail {
  const exam = findExam(examId)
  if (!exam) throw new Error('答题记录不存在')

  const owner = findUser(exam.userId)
  const isOwner = viewerId === exam.userId
  if (!isOwner) {
    const allowed = viewerIsAdmin || owner?.privacyType === PrivacyType.PUBLIC
    if (!allowed) throw new Error('该用户未公开答题记录')
    if (!exam.submitTime) throw new Error('该答题尚未交卷，不可查看')
  }

  const detail = getExamDetail(examId, exam.userId)
  if (isOwner) return detail

  // 裁剪：保留题干、本人作答与对错结论
  return {
    ...detail,
    items: detail.items.map((item) => ({
      ...item,
      answer: null,
      analysis: null,
    })),
  }
}

export { findUser }
