import { DraftStatus, JudgeStatus, QuestionType } from '@/constants/enums'
import type {
  CategoryTagRel,
  DraftQuestionRel,
  PaperCategory,
  PaperDraft,
  PaperExam,
  PaperExamQuestion,
  Question,
  QuestionTag,
  SysUser,
  UserQuestionRecord,
} from '@/types/models'
import { active, getDb, nowIso, nextId, newStamp } from './db'

/* --------------------------- 基础查询 --------------------------- */

export const allUsers = (): SysUser[] => active(getDb().users)
export const findUser = (id: number): SysUser | null => allUsers().find((u) => u.id === id) ?? null
export const findUserByName = (name: string): SysUser | null =>
  allUsers().find((u) => u.username === name) ?? null
export const findUsersByPhone = (phone: string): SysUser[] =>
  allUsers().filter((u) => u.phone === phone)

export const allCategories = (): PaperCategory[] =>
  active(getDb().categories).sort((a, b) => a.sortNo - b.sortNo)
export const findCategory = (id: number): PaperCategory | null =>
  allCategories().find((c) => c.id === id) ?? null

export const allTags = (): QuestionTag[] => active(getDb().tags).sort((a, b) => a.sortNo - b.sortNo)
export const findTag = (id: number): QuestionTag | null => allTags().find((t) => t.id === id) ?? null

export const categoryTagIds = (categoryId: number): number[] =>
  active(getDb().categoryTagRels)
    .filter((r) => r.categoryId === categoryId)
    .map((r) => r.tagId)

export const allDrafts = (): PaperDraft[] => active(getDb().drafts)
export const findDraft = (id: number): PaperDraft | null =>
  allDrafts().find((d) => d.id === id) ?? null

export const allQuestions = (): Question[] => active(getDb().questions)
export const findQuestion = (id: number): Question | null =>
  allQuestions().find((q) => q.id === id) ?? null

export const allExams = (): PaperExam[] => active(getDb().exams)
export const findExam = (id: number): PaperExam | null => allExams().find((e) => e.id === id) ?? null

export const allExamQuestions = (): PaperExamQuestion[] => active(getDb().examQuestions)
export const examQuestionsOf = (examId: number): PaperExamQuestion[] =>
  allExamQuestions()
    .filter((eq) => eq.examId === examId)
    .sort((a, b) => a.sortNo - b.sortNo)

export const allRecords = (): UserQuestionRecord[] => active(getDb().records)
export const recordsOfUser = (userId: number): UserQuestionRecord[] =>
  allRecords().filter((r) => r.userId === userId)
export const findRecord = (userId: number, questionId: number, categoryId: number): UserQuestionRecord | null =>
  recordsOfUser(userId).find(
    (r) => r.questionId === questionId && r.categoryId === categoryId,
  ) ?? null

/* --------------------------- 关联查询 --------------------------- */

/** 试卷的题目关联（含排序） */
export const draftRels = (draftId: number): DraftQuestionRel[] =>
  active(getDb().draftQuestionRels)
    .filter((r) => r.draftId === draftId)
    .sort((a, b) => a.sortNo - b.sortNo)

/** 引用了某题目的试卷关联（题目可被多份试卷共享） */
export const relsByQuestion = (questionId: number): DraftQuestionRel[] =>
  active(getDb().draftQuestionRels).filter((r) => r.questionId === questionId)

/** 题目的考点标签 id */
export const questionTagIds = (questionId: number): number[] =>
  active(getDb().questionTagRels)
    .filter((r) => r.questionId === questionId)
    .map((r) => r.tagId)

/** 题目的考点标签名 */
export const questionTagNames = (questionId: number): string[] =>
  questionTagIds(questionId)
    .map((id) => findTag(id)?.tagName)
    .filter((v): v is string => !!v)

/** 分类下配置的考点权重映射（无记录 = 未配置，按均权 1.00 处理） */
export const categoryWeightMap = (categoryId: number): Map<number, number> => {
  const map = new Map<number, number>()
  active(getDb().categoryWeights)
    .filter((w) => w.categoryId === categoryId)
    .forEach((w) => map.set(w.tagId, w.weight))
  return map
}

/** 题目被哪些已锁定试卷引用（锁定三件套之②的判定依据） */
export const lockedDraftsReferencing = (questionId: number): PaperDraft[] =>
  relsByQuestion(questionId)
    .map((rel) => findDraft(rel.draftId))
    .filter((d): d is PaperDraft => !!d && d.isLocked === 1 && d.draftStatus !== DraftStatus.DISCARDED)

/** 题目是否已被历史答题记录引用（锁定三件套之③的判定依据） */
export const examQuestionsByQuestion = (questionId: number): PaperExamQuestion[] =>
  allExamQuestions().filter((eq) => eq.questionId === questionId)

/* --------------------------- 插入封装 --------------------------- */

export function insertCategoryTagRel(categoryId: number, tagId: number): CategoryTagRel {
  const row: CategoryTagRel = {
    id: nextId('categoryTagRels'),
    categoryId,
    tagId,
    deleted: 0,
    ...newStamp(),
  }
  getDb().categoryTagRels.push(row)
  return row
}

export function insertCategoryWeight(
  categoryId: number,
  tagId: number,
  weight: number,
): void {
  const db = getDb()
  const exist = active(db.categoryWeights).find(
    (w) => w.categoryId === categoryId && w.tagId === tagId,
  )
  if (exist) {
    exist.weight = weight
    exist.updateTime = nowIso()
    return
  }
  db.categoryWeights.push({
    id: nextId('categoryWeights'),
    categoryId,
    tagId,
    weight,
    deleted: 0,
    ...newStamp(),
  })
}

export function insertQuestionTagRel(questionId: number, tagId: number): void {
  const db = getDb()
  const exist = active(db.questionTagRels).find(
    (r) => r.questionId === questionId && r.tagId === tagId,
  )
  if (exist) return
  db.questionTagRels.push({
    id: nextId('questionTagRels'),
    questionId,
    tagId,
    deleted: 0,
    ...newStamp(),
  })
}

export function insertDraftQuestionRel(
  draftId: number,
  questionId: number,
  sortNo: number,
  score: number,
): DraftQuestionRel {
  const row: DraftQuestionRel = {
    id: nextId('draftQuestionRels'),
    draftId,
    questionId,
    sortNo,
    score,
    deleted: 0,
    ...newStamp(),
  }
  getDb().draftQuestionRels.push(row)
  return row
}

/* --------------------------- 统计辅助 --------------------------- */

/** 已交卷答题记录（准确率统计的前置条件） */
export const submittedExamsOf = (userId: number): PaperExam[] =>
  allExams().filter((e) => e.userId === userId && !!e.submitTime)

/** 已判分的作答记录（仅统计已交卷答题记录，见设计文档 6.5 节） */
export const judgedExamQuestionsOf = (userId: number): Array<{
  exam: PaperExam
  eq: PaperExamQuestion
}> => {
  const result: Array<{ exam: PaperExam; eq: PaperExamQuestion }> = []
  submittedExamsOf(userId).forEach((exam) => {
    examQuestionsOf(exam.id).forEach((eq) => {
      if (eq.judgeStatus === JudgeStatus.JUDGED) result.push({ exam, eq })
    })
  })
  return result
}

/** 题目是否处于"仅剩简答"等题型判断 */
export const isShortAnswer = (type: number): boolean => type === QuestionType.SHORT_ANSWER
