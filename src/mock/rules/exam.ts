import {
  DraftStatus,
  ExamSourceType,
  JudgeResult,
  JudgeStatus,
  MasterStatus,
  QuestionType,
} from '@/constants/enums'
import type {
  PaperDraft,
  PaperExam,
  PaperExamQuestion,
  UserQuestionRecord,
} from '@/types/models'
import { getDb, newStamp, nextId, nowIso, softDelete } from '../db'
import {
  allExams,
  draftRels,
  examQuestionsOf,
  findDraft,
  findQuestion,
  findRecord,
} from '../repo'
import { isObjective, judgeObjective, scoreOf } from './judge'

/**
 * 答题记录：生成、逐题保存、交卷结算、错题记账、删除
 * 对应设计文档 6.2 节交卷结算流程。
 */

/** 生成答题记录（复制试卷的题目、顺序与分值快照） */
export function createExam(
  userId: number,
  draftId: number,
  sourceType: ExamSourceType = ExamSourceType.NORMAL,
): PaperExam {
  const db = getDb()
  const draft = findDraft(draftId)
  if (!draft) throw new Error('试卷不存在')

  const rels = draftRels(draftId)
  const attemptNo =
    allExams().filter((e) => e.userId === userId && e.draftId === draftId).length + 1
  const stamp = newStamp()

  const exam: PaperExam = {
    id: nextId('exams'),
    userId,
    draftId,
    draftName: draft.draftName,
    categoryId: draft.categoryId,
    paperType: draft.paperType,
    sourceType,
    attemptNo,
    questionCount: rels.length,
    totalScore: null,
    obtainedScore: null,
    usedSeconds: null,
    submitTime: null,
    deleted: 0,
    ...stamp,
  }
  db.exams.push(exam)

  // 题序：试卷开启乱序时打乱
  const ordered = [...rels]
  if (draft.randomOrder === 1) {
    for (let i = ordered.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[ordered[i], ordered[j]] = [ordered[j], ordered[i]]
    }
  }

  ordered.forEach((rel, index) => {
    const question = findQuestion(rel.questionId)
    if (!question) return
    const row: PaperExamQuestion = {
      id: nextId('examQuestions'),
      examId: exam.id,
      questionId: question.id,
      sortNo: index + 1,
      questionType: question.questionType,
      score: rel.score,
      userAnswer: null,
      judgeStatus: JudgeStatus.PENDING,
      judgeResult: null,
      obtainedScore: null,
      aiExplain: null,
      aiRetryTimes: 0,
      manualRetryTimes: 0,
      judgeTime: null,
      deleted: 0,
      ...newStamp(),
    }
    db.examQuestions.push(row)
  })

  return exam
}

/** 单题保存作答（幂等：按 examQuestionId 单行更新） */
export function saveAnswer(
  examQuestionId: number,
  userAnswer: string | null,
): PaperExamQuestion | null {
  const db = getDb()
  const row = db.examQuestions.find((eq) => eq.id === examQuestionId && eq.deleted === 0)
  if (!row) return null
  const exam = db.exams.find((e) => e.id === row.examId)
  if (!exam || exam.submitTime) return null // 已交卷不可修改
  row.userAnswer = userAnswer
  row.updateTime = nowIso()

  // 练习型即时反馈：客观题边答边判（仅用于展示对错，交卷时统一结算记账）
  if (exam.paperType === 2 && isObjective(row.questionType)) {
    row.judgeStatus = JudgeStatus.JUDGED
    row.judgeResult = judgeObjective(row.questionType, currentAnswer(row.questionId), userAnswer)
    row.obtainedScore = scoreOf(row.score, row.judgeResult)
  }
  return row
}

function currentAnswer(questionId: number): string {
  return findQuestion(questionId)?.answer ?? ''
}

/**
 * 交卷结算
 * 1. 客观题立即判分；简答题 v1 不判分（保持待判分）
 * 2. 汇总满分与实得分（v1 实得分仅累计已判分题目）
 * 3. 错题记账：判错 → upsert 错题记录 + 写明细；判对 → 若在错题集合则移入已掌握集合
 */
export function submitExam(examId: number): {
  exam: PaperExam
  judgedCount: number
  pendingCount: number
  wrongCount: number
} {
  const db = getDb()
  const exam = db.exams.find((e) => e.id === examId && e.deleted === 0)
  if (!exam) throw new Error('答题记录不存在')
  if (exam.submitTime) {
    // 幂等：重复交卷直接返回既有结果
    const items = examQuestionsOf(examId)
    return {
      exam,
      judgedCount: items.filter((i) => i.judgeStatus === JudgeStatus.JUDGED).length,
      pendingCount: items.filter((i) => i.judgeStatus !== JudgeStatus.JUDGED).length,
      wrongCount: items.filter((i) => i.judgeResult === JudgeResult.WRONG).length,
    }
  }

  const now = nowIso()
  const items = examQuestionsOf(examId)
  let totalScore = 0
  let obtainedScore = 0
  let judgedCount = 0
  let pendingCount = 0
  let wrongCount = 0

  items.forEach((eq) => {
    totalScore += eq.score
    if (isObjective(eq.questionType)) {
      const result = judgeObjective(eq.questionType, currentAnswer(eq.questionId), eq.userAnswer)
      eq.judgeStatus = JudgeStatus.JUDGED
      eq.judgeResult = result
      eq.obtainedScore = scoreOf(eq.score, result)
      eq.judgeTime = now
      judgedCount += 1
      if (result === JudgeResult.WRONG) wrongCount += 1
    } else {
      // v1：简答题不判分、不计分（AI 判分后置 v1.5）
      eq.judgeStatus = JudgeStatus.PENDING
      eq.judgeResult = null
      eq.obtainedScore = null
      pendingCount += 1
    }
    eq.updateTime = now
    if (eq.obtainedScore) obtainedScore += eq.obtainedScore
  })

  exam.totalScore = totalScore
  exam.obtainedScore = Number(obtainedScore.toFixed(2))
  exam.submitTime = now
  exam.updateTime = now

  // 错题 / 已掌握 记账
  items.forEach((eq) => {
    if (eq.judgeStatus !== JudgeStatus.JUDGED) return
    if (eq.judgeResult === JudgeResult.WRONG) {
      upsertWrongRecord(exam, eq, now)
    } else if (eq.judgeResult === JudgeResult.RIGHT) {
      markMastered(exam, eq, now)
    }
  })

  return { exam, judgedCount, pendingCount, wrongCount }
}

function upsertWrongRecord(exam: PaperExam, eq: PaperExamQuestion, now: string): void {
  const db = getDb()
  let record = findRecord(exam.userId, eq.questionId, exam.categoryId)
  if (!record) {
    const stamp = newStamp()
    record = {
      id: nextId('records'),
      userId: exam.userId,
      questionId: eq.questionId,
      categoryId: exam.categoryId,
      isMaster: MasterStatus.WRONG_SET,
      wrongCount: 1,
      lastExamId: exam.id,
      lastExamQuestionId: eq.id,
      lastWrongTime: now,
      masterTime: null,
      deleted: 0,
      ...stamp,
    } satisfies UserQuestionRecord
    db.records.push(record)
  } else {
    // 已掌握题目再次答错 → 取消已掌握标记，移回错题集合，错题次数继续累加
    record.isMaster = MasterStatus.WRONG_SET
    record.wrongCount += 1
    record.lastExamId = exam.id
    record.lastExamQuestionId = eq.id
    record.lastWrongTime = now
    record.masterTime = null
    record.updateTime = now
  }

  db.wrongDetails.push({
    id: nextId('wrongDetails'),
    recordId: record.id,
    examId: exam.id,
    examQuestionId: eq.id,
    userAnswer: eq.userAnswer ?? null,
    judgeResult: eq.judgeResult ?? null,
    aiExplain: eq.aiExplain ?? null,
    answerTime: now,
    deleted: 0,
    ...newStamp(),
  })
}

/** 错题答对 → 记录保留，标记已掌握并移入已掌握集合 */
function markMastered(exam: PaperExam, eq: PaperExamQuestion, now: string): void {
  const record = findRecord(exam.userId, eq.questionId, exam.categoryId)
  if (!record || record.isMaster === MasterStatus.MASTERED_SET) return
  record.isMaster = MasterStatus.MASTERED_SET
  record.masterTime = now
  record.lastExamId = exam.id
  record.lastExamQuestionId = eq.id
  record.updateTime = now
}

/** 删除答题记录（记录不再计入统计；错题明细保留） */
export function deleteExam(examId: number): boolean {
  const db = getDb()
  const ok = softDelete(db.exams, examId)
  if (!ok) return false
  db.examQuestions
    .filter((eq) => eq.examId === examId && eq.deleted === 0)
    .forEach((eq) => {
      softDelete(db.examQuestions, eq.id)
    })
  return true
}

/** 待组卷检查：试卷是否可被当前用户选用答题 */
export function assertDraftAnswerable(draft: PaperDraft | null): string | null {
  if (!draft) return '试卷不存在'
  if (draft.draftStatus === DraftStatus.DISCARDED) return '试卷已废弃，不可作答'
  if (draft.draftStatus !== DraftStatus.ENABLED) return '试卷处于停用状态，不可发起答题'
  return null
}

/** 是否为简答题（v1 交卷后展示参考答案供自评） */
export function needsSelfAssessment(type: QuestionType): boolean {
  return type === QuestionType.SHORT_ANSWER
}
