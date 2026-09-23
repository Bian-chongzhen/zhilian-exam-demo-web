import { DraftStatus, JudgeStatus, MasterStatus, PrivacyType, QuestionType, RoleType, Visibility } from '@/constants/enums'
import type {
  AccuracyStat,
  ExamListItem,
  ProfileView,
  StatsDashboard,
  StatsTagWrongItem,
  StatsTrendPoint,
  StatsTotals,
  WrongRecordItem,
} from '@/types/models'
import { getDb } from '../db'
import { notFound } from '../errors'
import { listPublicKnowledgeByUser } from './knowledgeService'
import {
  allDrafts,
  examQuestionsOf,
  findCategory,
  findQuestion,
  findUser,
  questionTagNames,
  recordsOfUser,
} from '../repo'
import { parseOptions } from '../rules/judge'
import { calcAccuracy, listExamsOfUser } from '../rules/stat'

/** 统计与个人主页服务（对应业务需求文档第一章 5/6 条） */

export function accuracy(userId: number): AccuracyStat {
  return calcAccuracy(userId)
}

/* ==================================================================== */
/* v1-plus 模块5：个人学习统计大盘                                        */
/* ==================================================================== */

/**
 * 学情大盘数据（**全部由既有答题/错题数据聚合，不新增业务表**）
 *
 * 口径（严格沿用 v1 基线，14 号 模块5 已明确）：
 *   - 只看**已交卷**的答题记录（`submitTime` 非空）
 *   - 只看**已判分**的小题（JudgeStatus.JUDGED）
 *   - **简答题不计入**任何指标（v1 不给简答判分）
 *   - 删除答题记录后本接口结果同步变化（无缓存、无快照表）
 *
 * 与用户主页的区分（14 号 模块5 权限约束）：
 *   用户主页对外只给全局/分类准确率；**详细学情大盘仅本人可见**，其他用户访问直接 403。
 */
export function dashboard(userId: number): StatsDashboard {
  const db = getDb()
  const user = findUser(userId)
  if (!user) throw notFound('用户不存在')

  // ① 已交卷的答题记录
  const finishedExams = db.exams.filter(
    (e) => e.deleted === 0 && e.userId === userId && !!e.submitTime,
  )
  const finishedExamIds = new Set(finishedExams.map((e) => e.id))

  // ② 这些记录里「已判分的客观题小题」——所有题量/趋势指标的分子来源
  const judgedObjective = db.examQuestions.filter((q) => {
    if (q.deleted !== 0) return false
    if (!finishedExamIds.has(q.examId)) return false
    if (q.questionType === QuestionType.SHORT_ANSWER) return false // 简答不计入
    return q.judgeStatus === JudgeStatus.JUDGED
  })

  // ③ 错题 / 已掌握集合（维度：用户 + 题目 + 分类；这里按记录条数统计题目数）
  const wrongRecords = db.records.filter(
    (r) => r.deleted === 0 && r.userId === userId && r.isMaster === MasterStatus.WRONG_SET,
  )
  const masteredRecords = db.records.filter(
    (r) => r.deleted === 0 && r.userId === userId && r.isMaster === MasterStatus.MASTERED_SET,
  )

  // ④ 答题趋势：按「交卷日期」归属当日完成试卷数；做题量按 Q4 口径 = 当日已判分客观题小题数
  const trendMap = new Map<string, { examCount: number; questionCount: number }>()
  const examDateOf = new Map<number, string>()
  finishedExams.forEach((e) => {
    const date = (e.submitTime ?? '').slice(0, 10)
    examDateOf.set(e.id, date)
    const row = trendMap.get(date) ?? { examCount: 0, questionCount: 0 }
    row.examCount += 1
    trendMap.set(date, row)
  })
  judgedObjective.forEach((q) => {
    const date = examDateOf.get(q.examId)
    if (!date) return
    const row = trendMap.get(date) ?? { examCount: 0, questionCount: 0 }
    row.questionCount += 1
    trendMap.set(date, row)
  })
  const trend: StatsTrendPoint[] = [...trendMap.entries()]
    .map(([date, v]) => ({ date, examCount: v.examCount, questionCount: v.questionCount }))
    .sort((a, b) => a.date.localeCompare(b.date))

  // ⑤ 考点错题排行：错题集合里每道题按其考点标签分别计数（一题多标签则各计一次）
  const tagCount = new Map<number, number>()
  wrongRecords.forEach((r) => {
    const tagIds = db.questionTagRels
      .filter((rel) => rel.deleted === 0 && rel.questionId === r.questionId)
      .map((rel) => rel.tagId)
    tagIds.forEach((tagId) => tagCount.set(tagId, (tagCount.get(tagId) ?? 0) + 1))
  })
  const tagWrongRanking: StatsTagWrongItem[] = [...tagCount.entries()]
    .map(([tagId, count]) => ({
      tagId,
      tagName: db.tags.find((t) => t.id === tagId)?.tagName ?? `标签#${tagId}`,
      wrongCount: count,
    }))
    .sort((a, b) => b.wrongCount - a.wrongCount)
    .slice(0, 10) // 排行榜取前 10，避免图过长

  // ⑥ 分类正确率：复用 v1 的题级准确率口径
  const accuracyStat = calcAccuracy(userId)

  const totals: StatsTotals = {
    finishedExamCount: finishedExams.length,
    judgedQuestionCount: judgedObjective.length,
    wrongCount: wrongRecords.length,
    masteredCount: masteredRecords.length,
    globalAccuracy: accuracyStat.globalAccuracy,
  }

  const empty =
    totals.finishedExamCount === 0 &&
    totals.wrongCount === 0 &&
    totals.masteredCount === 0

  return {
    totals,
    trend,
    categoryAccuracy: accuracyStat.categories,
    tagWrongRanking,
    setCompare: { wrongCount: totals.wrongCount, masteredCount: totals.masteredCount },
    empty,
  }
}

/** 该用户发布的公开试卷（主页展示用） */
export function publicDraftsOf(userId: number) {
  return allDrafts()
    .filter(
      (d) => d.userId === userId && d.visibility === Visibility.PUBLIC && d.draftStatus !== DraftStatus.DISCARDED,
    )
    .map((d) => ({
      ...d,
      categoryName: findCategory(d.categoryId)?.categoryName ?? '—',
      ownerName: findUser(d.userId)?.username ?? '已注销用户',
      canEdit: false,
    }))
}

/** 他人视角的错题集：不暴露正确答案、解析与错题次数（Q6 决策） */
function sanitizeRecordsForOthers(userId: number): WrongRecordItem[] {
  const db = getDb()
  return recordsOfUser(userId)
    .filter((r) => r.isMaster === MasterStatus.WRONG_SET)
    .map((record) => {
      const question = findQuestion(record.questionId)
      return {
        recordId: record.id,
        questionId: record.questionId,
        categoryId: record.categoryId,
        categoryName: findCategory(record.categoryId)?.categoryName ?? '—',
        isMaster: record.isMaster,
        wrongCount: 0,
        lastWrongTime: record.lastWrongTime ?? null,
        masterTime: record.masterTime ?? null,
        questionType: question?.questionType ?? QuestionType.SINGLE,
        title: question?.title ?? '（题目已删除）',
        options: parseOptions(question?.options),
        answer: '',
        analysis: null,
        tagNames: questionTagNames(record.questionId),
        detailCount: db.wrongDetails.filter((d) => d.recordId === record.id && d.deleted === 0).length,
      }
    })
    .sort((a, b) => (b.lastWrongTime ?? '').localeCompare(a.lastWrongTime ?? ''))
}

/**
 * 个人主页聚合
 * - 隐私态：他人仅可见公开试卷
 * - 公开态：他人可额外看到准确率、答题记录、错题集（字段按 Q6 决策裁剪）
 * - 已注销用户：正常展示历史数据，标注"已注销"，隐私配置依然生效
 */
export function profileView(viewerId: number | null, targetUserId: number): ProfileView {
  const target = findUser(targetUserId)
  if (!target) throw notFound('用户不存在')

  const viewer = viewerId ? findUser(viewerId) : null
  const isSelf = viewerId === targetUserId
  const isAdmin = viewer?.roleType === RoleType.ADMIN
  // 注销不改变隐私配置；管理员不因角色获得隐私豁免
  const canViewDetail = isSelf || target.privacyType === PrivacyType.PUBLIC

  const base: ProfileView = {
    user: {
      id: target.id,
      username: target.username,
      profile: target.profile ?? null,
      privacyType: target.privacyType,
      deleted: target.deleted,
      createTime: target.createTime,
    },
    canViewDetail,
    publicDrafts: publicDraftsOf(targetUserId),
    /*
     * 公开知识点：**与隐私设置无关**。
     * 隐私开关管的是答题记录、错题集、准确率这些个人数据；
     * 知识点的可见性由每篇自己的公开/私有决定（14 号 §4.4：注销用户的公开知识点继续可用）。
     */
    publicKnowledge: listPublicKnowledgeByUser(targetUserId),
  }

  if (!canViewDetail) return base

  const exams: ExamListItem[] = listExamsOfUser(targetUserId)
  base.accuracy = calcAccuracy(targetUserId)
  base.exams = exams
  base.wrongRecords = isSelf || isAdmin
    ? // 本人视角：完整字段（错题次数等）
      recordsOfUser(targetUserId)
        .filter((r) => r.isMaster === MasterStatus.WRONG_SET)
        .map((record) => {
          const question = findQuestion(record.questionId)
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
            detailCount: getDb().wrongDetails.filter((d) => d.recordId === record.id && d.deleted === 0).length,
          }
        })
    : sanitizeRecordsForOthers(targetUserId)

  return base
}

/** 待判分统计（v1 恒为简答题数量） */
export function pendingSummary(userId: number): { pendingCount: number } {
  let pending = 0
  getDb()
    .exams.filter((e) => e.userId === userId && e.deleted === 0)
    .forEach((exam) => {
      pending += examQuestionsOf(exam.id).filter((eq) => eq.judgeStatus !== JudgeStatus.JUDGED).length
    })
  return { pendingCount: pending }
}
