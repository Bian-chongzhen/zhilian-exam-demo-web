import { JudgeResult, JudgeStatus } from '@/constants/enums'
import type { AccuracyStat, CategoryAccuracy, ExamListItem } from '@/types/models'
import { allExams, examQuestionsOf, findCategory, judgedExamQuestionsOf } from '../repo'

/**
 * 准确率统计口径（设计文档 6.5 节）
 * - 仅纳入已交卷答题记录（paperExam.submitTime 非空且未删除）
 * - 仅纳入已判分小题（judgeStatus = 2）
 * - 题级口径，按已判分作答次数统计（同一题多次作答分别计入）
 * - 待重试 / 待判分不进分子分母
 * - 分类准确率按答题记录的 categoryId 分组；未作答过的分类不返回
 */
export function calcAccuracy(userId: number): AccuracyStat {
  const rows = judgedExamQuestionsOf(userId)

  let rightCount = 0
  const byCategory = new Map<number, { right: number; total: number }>()

  rows.forEach(({ exam, eq }) => {
    const isRight = eq.judgeResult === JudgeResult.RIGHT
    if (isRight) rightCount += 1

    const bucket = byCategory.get(exam.categoryId) ?? { right: 0, total: 0 }
    bucket.total += 1
    if (isRight) bucket.right += 1
    byCategory.set(exam.categoryId, bucket)
  })

  const total = rows.length
  const categories: CategoryAccuracy[] = [...byCategory.entries()]
    .map(([categoryId, v]) => ({
      categoryId,
      categoryName: findCategory(categoryId)?.categoryName ?? `分类#${categoryId}`,
      accuracy: v.total > 0 ? v.right / v.total : null,
      judgedCount: v.total,
      rightCount: v.right,
    }))
    .sort((a, b) => b.judgedCount - a.judgedCount)

  return {
    userId,
    globalAccuracy: total > 0 ? rightCount / total : null,
    judgedCount: total,
    rightCount,
    categories,
  }
}

/** 单份答题记录的判分汇总（用于答题记录列表） */
export function summarizeExam(examId: number): {
  rightCount: number
  wrongCount: number
  pendingCount: number
} {
  let rightCount = 0
  let wrongCount = 0
  let pendingCount = 0
  examQuestionsOf(examId).forEach((eq) => {
    if (eq.judgeStatus !== JudgeStatus.JUDGED) {
      pendingCount += 1
      return
    }
    if (eq.judgeResult === JudgeResult.RIGHT) rightCount += 1
    else wrongCount += 1
  })
  return { rightCount, wrongCount, pendingCount }
}

/** 用户答题记录列表 */
export function listExamsOfUser(userId: number): ExamListItem[] {
  return allExams()
    .filter((e) => e.userId === userId)
    .sort((a, b) => (b.submitTime ?? b.createTime).localeCompare(a.submitTime ?? a.createTime))
    .map((exam) => ({
      ...exam,
      categoryName: findCategory(exam.categoryId)?.categoryName ?? `分类#${exam.categoryId}`,
      ...summarizeExam(exam.id),
    }))
}

/** 准确率格式化（展示用） */
export function formatAccuracy(value: number | null | undefined): string {
  if (value === null || value === undefined) return '—'
  return `${(value * 100).toFixed(1)}%`
}
