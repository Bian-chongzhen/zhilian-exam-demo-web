import { MasterStatus, QuestionType } from '@/constants/enums'
import type { WrongDetailItem, WrongRecordItem } from '@/types/models'
import { getDb, softDelete } from '../db'
import {
  findCategory,
  findExam,
  findQuestion,
  findRecord,
  questionTagNames,
  recordsOfUser,
} from '../repo'
import { parseOptions } from '../rules/judge'

/** 错题集 / 已掌握集合服务（对应业务需求文档第七章） */

/** 集合列表：维度为 用户 + 题目 + 分类 */
export function listRecords(
  userId: number,
  filter?: { categoryId?: number | null; isMaster?: number | null; keyword?: string },
): WrongRecordItem[] {
  const db = getDb()
  return recordsOfUser(userId)
    .filter((r) => (filter?.categoryId ? r.categoryId === filter.categoryId : true))
    .filter((r) =>
      filter?.isMaster === null || filter?.isMaster === undefined
        ? true
        : r.isMaster === filter.isMaster,
    )
    .map((record) => {
      const question = findQuestion(record.questionId)
      const detailCount = db.wrongDetails.filter(
        (d) => d.recordId === record.id && d.deleted === 0,
      ).length
      return {
        recordId: record.id,
        questionId: record.questionId,
        categoryId: record.categoryId,
        categoryName: findCategory(record.categoryId)?.categoryName ?? '—',
        isMaster: record.isMaster,
        wrongCount: record.wrongCount,
        lastWrongTime: record.lastWrongTime ?? null,
        masterTime: record.masterTime ?? null,
        questionType: question?.questionType ?? QuestionType.SINGLE,
        title: question?.title ?? '（题目已删除）',
        options: parseOptions(question?.options),
        answer: question?.answer ?? '',
        analysis: question?.analysis ?? null,
        tagNames: questionTagNames(record.questionId),
        detailCount,
      }
    })
    .filter((item) =>
      filter?.keyword ? item.title.toLowerCase().includes(filter.keyword.toLowerCase()) : true,
    )
    .sort((a, b) => (b.lastWrongTime ?? '').localeCompare(a.lastWrongTime ?? ''))
}

/** 集合统计 */
export function countBySet(userId: number): {
  wrongCount: number
  masteredCount: number
  totalWrongTimes: number
} {
  const records = recordsOfUser(userId)
  return {
    wrongCount: records.filter((r) => r.isMaster === MasterStatus.WRONG_SET).length,
    masteredCount: records.filter((r) => r.isMaster === MasterStatus.MASTERED_SET).length,
    totalWrongTimes: records.reduce((sum, r) => sum + r.wrongCount, 0),
  }
}

/** 错题作答明细（可追溯多次练习历史） */
export function listDetails(userId: number, recordId: number): WrongDetailItem[] {
  const db = getDb()
  const record = db.records.find((r) => r.id === recordId && r.deleted === 0)
  if (!record || record.userId !== userId) throw new Error('无权查看该错题明细')

  return db.wrongDetails
    .filter((d) => d.recordId === recordId && d.deleted === 0)
    .sort((a, b) => b.answerTime.localeCompare(a.answerTime))
    .map((d) => {
      const exam = findExam(d.examId)
      return {
        id: d.id,
        examId: d.examId,
        examQuestionId: d.examQuestionId,
        userAnswer: d.userAnswer ?? null,
        judgeResult: d.judgeResult ?? null,
        aiExplain: d.aiExplain ?? null,
        answerTime: d.answerTime,
        examName: exam?.draftName ?? '（答题记录已删除）',
      } as WrongDetailItem & { examName: string }
    })
}

/**
 * 手动删除单条错题 / 已掌握记录
 * 删除后若该题再次答错，会重新生成记录且 wrongCount 从 1 重新计算（Q20 决策）
 */
export function deleteRecord(userId: number, recordId: number): void {
  const db = getDb()
  const record = db.records.find((r) => r.id === recordId && r.deleted === 0)
  if (!record) throw new Error('记录不存在')
  if (record.userId !== userId) throw new Error('无权删除他人的错题记录')
  softDelete(db.records, recordId)
}

/** 该题当前是否在错题集合中（用于详情页提示） */
export function recordState(userId: number, questionId: number, categoryId: number): {
  exists: boolean
  isMaster: MasterStatus | null
  wrongCount: number
} {
  const record = findRecord(userId, questionId, categoryId)
  if (!record) return { exists: false, isMaster: null, wrongCount: 0 }
  return { exists: true, isMaster: record.isMaster, wrongCount: record.wrongCount }
}
