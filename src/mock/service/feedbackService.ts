import { FeedbackStatus } from '@/constants/enums'
import type { FeedbackFilter, FeedbackItem, FeedbackTicket } from '@/types/models'
import { getDb, newStamp, nextId, nowIso } from '../db'
import { notFound } from '../errors'
import { findUser } from '../repo'
import { requireAdmin } from './authService'

/**
 * 题目报错反馈工单服务（v1-plus 模块4）
 *
 * 依据《14、v1 plus.md》模块4 与 15 号 FB-01 ~ FB-05 / FB-U1 / FB-U2：
 *   - 用户侧：在底稿预览页与答题回顾页对某道题提交文字反馈；未登录不可提交（FB-U1）
 *   - 题目已失效：不允许提交（FB-U2）；**已提交的工单不因题目被删而消失**（FB-02）
 *   - 管理端：仅管理员可看；按状态与时间范围筛选；改状态 + 填处理备注
 *   - **工单只流转信息，绝不修改题库任何数据**（FB-03）——要改题仍走「复制为新题」流程
 *   - Q5 已定：状态改为「已处理 / 忽略」时**备注必填**
 *   - 账号注销：提交的工单全部保留，管理员可继续处理（15 号 §10）
 *
 * 权限口径：管理端方法**不接收「操作者 id」**，一律由 `requireAdmin()` 从会话推导
 * （与用户账号管理页保持一致，避免调用方声明自己是谁）。
 */

/* ------------------------------ 内部工具 ------------------------------ */

function inDateRange(value: string, start?: string | null, end?: string | null): boolean {
  const day = value.slice(0, 10)
  if (start && day < start) return false
  // endDate 含端点当天
  if (end && day > end) return false
  return true
}

function truncate(text: string, max: number): string {
  return text.length <= max ? text : `${text.slice(0, max)}…`
}

function toItem(ticket: FeedbackTicket): FeedbackItem {
  const db = getDb()
  const submitter = findUser(ticket.userId)
  const question = db.questions.find((q) => q.id === ticket.questionId && q.deleted === 0)
  const handler = ticket.handledBy ? findUser(ticket.handledBy) : null

  // 题目已被删除：预览为 null，界面据此标注「题目已删除」（FB-02），工单本身照常可用
  const draftRel = question
    ? db.draftQuestionRels.find((r) => r.deleted === 0 && r.questionId === question.id)
    : undefined
  const draft = draftRel
    ? db.drafts.find((d) => d.id === draftRel.draftId && d.deleted === 0)
    : undefined

  return {
    id: ticket.id,
    userId: ticket.userId,
    submitterName: submitter?.username ?? '已注销用户',
    submitterDeleted: !submitter || submitter.deleted !== 0,
    questionId: ticket.questionId,
    questionPreview: question ? truncate(question.title, 60) : null,
    questionType: question ? question.questionType : null,
    draftId: draft ? draft.id : null,
    draftName: draft ? draft.draftName : null,
    description: ticket.description,
    status: ticket.status,
    adminRemark: ticket.adminRemark ?? null,
    handledByName: handler?.username ?? null,
    handledTime: ticket.handledTime ?? null,
    createTime: ticket.createTime,
  }
}

/* ------------------------------ 用户侧 ------------------------------ */

/** 提交报错反馈（登录用户）；题目已失效时拒绝（FB-U2） */
export function submitFeedback(userId: number, questionId: number, description: string): void {
  const db = getDb()
  const text = description.trim()
  if (!text) throw new Error('请填写问题描述')
  if (text.length > 500) throw new Error('问题描述最多 500 字')

  const question = db.questions.find((q) => q.id === questionId && q.deleted === 0)
  if (!question) throw notFound('该题目已失效，不能提交反馈')

  db.feedbackTickets.push({
    ...newStamp(),
    id: nextId('feedbackTickets'),
    deleted: 0,
    userId,
    questionId,
    description: text,
    status: FeedbackStatus.PENDING,
    adminRemark: null,
    handledBy: null,
    handledTime: null,
  })
}

/** 我提交过的工单（用户只读自查；不下发管理员备注等治理字段） */
export function listMyFeedback(userId: number): FeedbackItem[] {
  return getDb()
    .feedbackTickets.filter((t) => t.deleted === 0 && t.userId === userId)
    .map((t) => ({
      ...toItem(t),
      adminRemark: null,
      handledByName: null,
    }))
    .sort((a, b) => b.createTime.localeCompare(a.createTime))
}

/* ------------------------------ 管理端 ------------------------------ */

/** 工单列表（仅管理员；按状态 + 时间范围筛选） */
export function listFeedback(filter: FeedbackFilter = {}): FeedbackItem[] {
  requireAdmin()
  const status = filter.status ?? 'all'

  return getDb()
    .feedbackTickets.filter((t) => t.deleted === 0)
    .filter((t) => (status === 'all' ? true : t.status === status))
    .filter((t) => inDateRange(t.createTime, filter.startDate, filter.endDate))
    .map(toItem)
    .sort((a, b) => b.createTime.localeCompare(a.createTime))
}

/**
 * 处理工单：改状态 + 写备注（Q5：已处理/忽略 时备注必填）
 * ⚠ 只改工单，**绝不触碰题目数据**（FB-03）；要改题请走题库纠错 / 试卷编辑的原有流程。
 */
export function handleFeedback(ticketId: number, status: FeedbackStatus, remark: string): void {
  const operator = requireAdmin()
  const ticket = getDb().feedbackTickets.find((t) => t.id === ticketId && t.deleted === 0)
  if (!ticket) throw notFound('工单不存在')

  const text = remark.trim()
  if ((status === FeedbackStatus.HANDLED || status === FeedbackStatus.IGNORED) && !text) {
    throw new Error('标记为「已处理 / 忽略」时必须填写处理备注')
  }

  ticket.status = status
  ticket.adminRemark = text || null
  ticket.updateTime = nowIso()
  if (status === FeedbackStatus.PENDING) {
    // 退回待处理：清掉处理痕迹，避免出现「待处理但有处理人」的矛盾状态
    ticket.handledBy = null
    ticket.handledTime = null
  } else {
    ticket.handledBy = operator.id
    ticket.handledTime = nowIso()
  }
}

/** 待处理工单数（管理端角标/概览用） */
export function pendingFeedbackCount(): number {
  requireAdmin()
  return getDb().feedbackTickets.filter(
    (t) => t.deleted === 0 && t.status === FeedbackStatus.PENDING,
  ).length
}
