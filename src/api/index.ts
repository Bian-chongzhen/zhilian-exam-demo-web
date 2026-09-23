/**
 * 前端 API 层（Phase 1：本地 Mock 真逻辑）
 *
 * 说明：本层是**界面与后端之间的唯一契约面**。
 * 第二阶段接入 Spring Boot 时，只需把这里的方法实现替换为 axios 调用，
 * 调用方（stores 与 views）无需任何改动。
 */
import { resetDb, saveDb } from '@/mock/db'
import type { ComposeParams, FeedbackFilter, KnowledgeFilter } from '@/types/models'
import type { DraftStatus, FavoriteTargetType, FeedbackStatus } from '@/constants/enums'
import { ApiCode } from '@/constants/apiCodes'
import { DomainError } from '@/mock/errors'
import * as authService from '@/mock/service/authService'
import * as categoryService from '@/mock/service/categoryService'
import * as composeService from '@/mock/service/composeService'
import * as draftService from '@/mock/service/draftService'
import * as examService from '@/mock/service/examService'
import * as favoriteService from '@/mock/service/favoriteService'
import * as feedbackService from '@/mock/service/feedbackService'
import * as knowledgeService from '@/mock/service/knowledgeService'
import * as noteService from '@/mock/service/noteService'
import * as statService from '@/mock/service/statService'
import * as wrongService from '@/mock/service/wrongService'

export class ApiError extends Error {
  code: number
  constructor(message: string, code: number = ApiCode.GENERIC) {
    super(message)
    this.name = 'ApiError'
    this.code = code
  }
}

/**
 * 把领域错误转换为契约面错误：保留 service 抛出的语义错误码，
 * 让页面能区分「无权限(403) / 资源不存在(404) / 会话失效(401)」，而不是匹配错误文案。
 */
function toApiError(e: unknown): ApiError {
  if (e instanceof DomainError) return new ApiError(e.message, e.code)
  return new ApiError(e instanceof Error ? e.message : String(e), ApiCode.GENERIC)
}

/** 模拟网络延迟，便于观察加载态 */
const LATENCY = 90

function traceId(): string {
  return `demo-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

/**
 * 写操作的会话前置校验
 *
 * 依据 13 号 §4.3「游客不允许任何形式的数据写入」与 §5.3「不能只依靠前端隐藏按钮绕过权限」：
 * **契约面统一要求写操作必须存在有效会话**，否则返回 401。
 * 为什么放在契约面而不是每个 service 里：这是「所有写接口的共同前置条件」，
 * 收口一处可避免漏掉某个接口（service 内部仍各自保留业务规则校验）。
 *
 * 例外（allowGuest）：注册、登录、找回密码 —— 这三个本来就是未登录状态下要用的。
 */
function assertSessionForWrite(): void {
  if (!authService.currentUser()) {
    throw new ApiError('未登录或登录已失效', ApiCode.SESSION)
  }
}

async function call<T>(fn: () => T, opts: { allowGuest?: boolean } = {}): Promise<T> {
  await new Promise((resolve) => setTimeout(resolve, LATENCY))
  if (!opts.allowGuest) assertSessionForWrite()
  try {
    const data = fn()
    saveDb()
    return data
  } catch (e) {
    throw toApiError(e)
  }
}

/** 只读调用不写库，但仍保持一致的延迟与错误语义 */
async function query<T>(fn: () => T): Promise<T> {
  await new Promise((resolve) => setTimeout(resolve, LATENCY))
  try {
    return fn()
  } catch (e) {
    throw toApiError(e)
  }
}

export const trace = { traceId }

/**
 * 契约面 DTO 类型统一从本模块导出：
 * 页面只 import `@/api`，不直接依赖 `mock/`（Phase 2 换成 axios 时类型来源随之替换）。
 */
export type {
  AdminUserFilter,
  AdminUserItem,
  AccountStatusFilter,
} from '@/mock/service/authService'
export type { KnowledgePayload } from '@/mock/service/knowledgeService'
export type { FavoriteItem } from '@/types/models'
export type { FeedbackFilter, FeedbackItem } from '@/types/models'
export type { StatsDashboard, StatsTagWrongItem, StatsTrendPoint, StatsTotals } from '@/types/models'
export type {
  KnowledgeDetail,
  KnowledgeFilter,
  KnowledgeListItem,
  KnowledgeQuestionItem,
  KnowledgeSort,
  KnowledgeTitleCheck,
  QuestionKnowledgeLink,
} from '@/types/models'

/* -------------------------------- 认证 -------------------------------- */
export const authApi = {
  checkUsername: (username: string) => query(() => authService.checkUsernameAvailable(username)),
  // 注册 / 登录 / 找回密码：未登录状态下必须可用，显式放行
  register: (params: authService.RegisterParams) =>
    call(() => authService.register(params), { allowGuest: true }),
  login: (params: authService.LoginParams) =>
    call(() => authService.login(params), { allowGuest: true }),
  logout: () => call(() => authService.logout()),
  current: () => query(() => authService.currentUser()),
  /** 会话是否存在但已失效（用户被注销/删除）—— 用于区分「游客」与「会话失效」(PER-02) */
  isSessionExpired: () => query(() => authService.isSessionExpired()),
  resetPassword: (params: { phone: string; username: string; newPassword: string }) =>
    call(() => authService.resetPassword(params), { allowGuest: true }),
  resetDemoData: () => call(() => resetDb()),
}

/* -------------------------------- 用户 -------------------------------- */
export const userApi = {
  updateProfile: (userId: number, params: { profile?: string | null; privacyType?: number }) =>
    call(() => authService.updateProfile(userId, params)),
  changePassword: (userId: number, oldPassword: string, newPassword: string) =>
    call(() => authService.changePassword(userId, oldPassword, newPassword)),
  deactivate: (userId: number, password: string) =>
    call(() => authService.deactivateAccount(userId, password)),
  list: () => query(() => authService.listUsers()),
  /* --- 管理端：用户账号管理（v0.5）。权限以会话为准，故不接收「操作者 id」 --- */
  /** 用户账号列表（含已注销账号，支持用户名关键字 + 账号状态筛选） */
  adminList: (filter?: authService.AdminUserFilter) =>
    query(() => authService.listUsersForAdmin(filter)),
  /** 重置指定用户密码：该用户全部在线会话立即失效 */
  adminResetPassword: (targetUserId: number, newPassword: string) =>
    call(() => authService.adminResetPassword(targetUserId, newPassword)),
  /** 切换指定用户角色（下次登录生效；不允许操作自己） */
  adminSwitchRole: (targetUserId: number) =>
    call(() => authService.adminSwitchRole(targetUserId)),
}

/* -------------------------------- 分类 -------------------------------- */
export const categoryApi = {
  list: () => query(() => categoryService.listCategories()),
  create: (operatorId: number, payload: categoryService.CategoryPayload) =>
    call(() => categoryService.createCategory(operatorId, payload)),
  update: (operatorId: number, categoryId: number, payload: categoryService.CategoryPayload) =>
    call(() => categoryService.updateCategory(operatorId, categoryId, payload)),
  remove: (operatorId: number, categoryId: number) =>
    call(() => categoryService.deleteCategory(operatorId, categoryId)),
  tagConfig: (categoryId: number) => query(() => categoryService.categoryTagConfig(categoryId)),
}

/* -------------------------------- 标签 -------------------------------- */
export const tagApi = {
  list: () => query(() => categoryService.listTags()),
  create: (operatorId: number, tagName: string) =>
    call(() => categoryService.createTag(operatorId, tagName)),
  update: (operatorId: number, tagId: number, payload: { tagName?: string; isEnabled?: number }) =>
    call(() => categoryService.updateTag(operatorId, tagId, payload)),
  remove: (operatorId: number, tagId: number) => call(() => categoryService.deleteTag(operatorId, tagId)),
}

/* -------------------------------- 试卷 -------------------------------- */
export const draftApi = {
  listPublic: (filter?: { categoryId?: number | null; paperType?: number | null; keyword?: string }) =>
    query(() => draftService.listPublicDrafts(filter)),
  listMine: (userId: number) => query(() => draftService.listMyDrafts(userId)),
  listDiscarded: () => query(() => draftService.listDiscardedDrafts()),
  detail: (draftId: number, viewerId: number | null) =>
    query(() => draftService.getDraftDetail(draftId, viewerId)),
  create: (userId: number, params: draftService.CreateDraftParams) =>
    call(() => draftService.createDraft(userId, params)),
  updateMeta: (draftId: number, userId: number, params: Partial<draftService.CreateDraftParams>) =>
    call(() => draftService.updateDraftMeta(draftId, userId, params)),
  switchStatus: (draftId: number, userId: number, target: DraftStatus) =>
    call(() => draftService.switchDraftStatus(draftId, userId, target)),
  discard: (draftId: number, userId: number) => call(() => draftService.discardDraft(draftId, userId)),
  saveAs: (draftId: number, userId: number, newName: string) =>
    call(() => draftService.saveDraftAs(draftId, userId, newName)),
  createQuestion: (draftId: number, userId: number, payload: draftService.QuestionPayload) =>
    call(() => draftService.createQuestionInDraft(draftId, userId, payload)),
  updateQuestion: (
    draftId: number,
    userId: number,
    questionId: number,
    payload: draftService.QuestionPayload,
    relScore?: number,
  ) => call(() => draftService.updateQuestion(draftId, userId, questionId, payload, relScore)),
  copyAsNew: (draftId: number, userId: number, questionId: number) =>
    call(() => draftService.copyQuestionAsNew(draftId, userId, questionId)),
  attachQuestion: (draftId: number, userId: number, questionId: number, score?: number) =>
    call(() => draftService.attachQuestionToDraft(draftId, userId, questionId, score)),
  detachQuestion: (draftId: number, userId: number, relId: number) =>
    call(() => draftService.detachQuestionFromDraft(draftId, userId, relId)),
  moveQuestion: (draftId: number, userId: number, relId: number, delta: number) =>
    call(() => draftService.moveQuestion(draftId, userId, relId, delta)),
  updateRelScore: (draftId: number, userId: number, relId: number, score: number) =>
    call(() => draftService.updateRelScore(draftId, userId, relId, score)),
  deleteQuestion: (userId: number, questionId: number) =>
    call(() => draftService.deleteQuestion(userId, questionId)),
  questionBank: (filter?: { keyword?: string; tagId?: number | null; questionType?: number | null }) =>
    query(() => draftService.listQuestionBank(filter)),
  adminUpdateQuestionTags: (operatorId: number, questionId: number, tagIds: number[]) =>
    call(() => categoryService.adminUpdateQuestionTags(operatorId, questionId, tagIds)),
}

/* ------------------------------ 答题记录 ------------------------------ */
export const examApi = {
  start: (userId: number, draftId: number) => call(() => examService.startExam(userId, draftId)),
  detail: (examId: number, userId: number) => query(() => examService.getExamDetail(examId, userId)),
  detailForViewer: (examId: number, viewerId: number | null, isAdmin = false) =>
    query(() => examService.getExamDetailForViewer(examId, viewerId, isAdmin)),
  saveAnswer: (examId: number, userId: number, examQuestionId: number, userAnswer: string | null) =>
    call(() => examService.saveAnswer(examId, userId, examQuestionId, userAnswer)),
  submit: (examId: number, userId: number) => call(() => examService.submitExam(examId, userId)),
  listMine: (userId: number) => query(() => examService.listMyExams(userId)),
  listUnsubmitted: (userId: number) => query(() => examService.listUnsubmitted(userId)),
  remove: (examId: number, userId: number) => call(() => examService.deleteExam(examId, userId)),
  abandon: (examId: number, userId: number) => call(() => examService.abandonExam(examId, userId)),
  clearAnswers: (examId: number, userId: number) =>
    call(() => examService.clearExamAnswers(examId, userId)),
}

/* ------------------------------ 错题 / 已掌握 ------------------------------ */
export const wrongApi = {
  list: (userId: number, filter?: { categoryId?: number | null; isMaster?: number | null; keyword?: string }) =>
    query(() => wrongService.listRecords(userId, filter)),
  counts: (userId: number) => query(() => wrongService.countBySet(userId)),
  details: (userId: number, recordId: number) => query(() => wrongService.listDetails(userId, recordId)),
  remove: (userId: number, recordId: number) => call(() => wrongService.deleteRecord(userId, recordId)),
  state: (userId: number, questionId: number, categoryId: number) =>
    query(() => wrongService.recordState(userId, questionId, categoryId)),
}

/* -------------------------------- 组卷 -------------------------------- */
export const composeApi = {
  preview: (userId: number, params: ComposeParams) => query(() => composeService.preview(userId, params)),
  validate: (userId: number, params: ComposeParams) =>
    query(() => composeService.validateParams(userId, params)),
  generate: (userId: number, params: ComposeParams) =>
    call(() => composeService.generate(userId, params)),
  generateAndEnable: (userId: number, params: ComposeParams) =>
    call(() => composeService.generateAndEnable(userId, params)),
  suggestName: (userId: number, categoryId: number) =>
    query(() => composeService.suggestDraftName(userId, categoryId)),
}

/* ------------------------------ 知识点（v1-plus 模块1） ------------------------------ */
export const knowledgeApi = {
  /** 广场列表：仅公开、未删除；支持标题前缀搜索 / 分类 / 标签 / 排序 */
  listPublic: (filter?: KnowledgeFilter) =>
    query(() => knowledgeService.listPublicKnowledge(filter)),
  /** 我的知识点（私有 + 公开） */
  listMine: (userId: number) => query(() => knowledgeService.listMyKnowledge(userId)),
  /** 详情：私有仅作者；viewerId 为查看者（游客传 null） */
  detail: (knowledgeId: number, viewerId: number | null) =>
    query(() => knowledgeService.getKnowledgeDetail(knowledgeId, viewerId)),
  create: (userId: number, payload: knowledgeService.KnowledgePayload) =>
    call(() => knowledgeService.createKnowledge(userId, payload)),
  update: (knowledgeId: number, userId: number, payload: knowledgeService.KnowledgePayload) =>
    call(() => knowledgeService.updateKnowledge(knowledgeId, userId, payload)),
  remove: (knowledgeId: number, userId: number) =>
    call(() => knowledgeService.deleteKnowledge(knowledgeId, userId)),
  /** 保存前的标题查重与相似提示（仅提示，不阻止保存） */
  checkTitle: (title: string, excludeId?: number) =>
    query(() => knowledgeService.checkKnowledgeTitle(title, excludeId)),
  /** 保存本人批注（用户 + 知识点唯一，空内容视为删除） */
  saveAnnotation: (knowledgeId: number, userId: number, content: string) =>
    call(() => knowledgeService.saveMyAnnotation(knowledgeId, userId, content)),
  /** 供错题页 / 答题回顾页：某题关联的、当前访问者可见的知识点 */
  listByQuestion: (questionId: number, viewerId: number | null) =>
    query(() => knowledgeService.listKnowledgeByQuestion(questionId, viewerId)),
  /** 批量版（一屏多题，避免逐题请求） */
  listByQuestions: (questionIds: number[], viewerId: number | null) =>
    query(() => knowledgeService.listKnowledgeByQuestions(questionIds, viewerId)),
  /** 某个用户创建的公开知识点（他人主页展示；私有永不外露） */
  listPublicByUser: (userId: number) =>
    query(() => knowledgeService.listPublicKnowledgeByUser(userId)),
  /** 编辑页「关联题目」搜索（范围：本人全部底稿 + 公开底稿） */
  searchQuestions: (userId: number, keyword?: string) =>
    query(() => knowledgeService.searchSelectableQuestions(userId, keyword)),
}

/* ------------------------------ 反馈工单（v1-plus 模块4） ------------------------------ */
export const feedbackApi = {
  /** 提交题目报错反馈（题目已失效时拒绝） */
  submit: (userId: number, questionId: number, description: string) =>
    call(() => feedbackService.submitFeedback(userId, questionId, description)),
  /** 我提交过的工单（用户只读自查） */
  listMine: (userId: number) => query(() => feedbackService.listMyFeedback(userId)),
  /* --- 管理端：权限以会话为准，不接收「操作者 id」 --- */
  /** 工单列表（状态 + 时间范围筛选） */
  list: (filter?: FeedbackFilter) => query(() => feedbackService.listFeedback(filter)),
  /** 处理工单：改状态 + 写备注（已处理/忽略 时备注必填）；**不改题目数据** */
  handle: (ticketId: number, status: FeedbackStatus, remark: string) =>
    call(() => feedbackService.handleFeedback(ticketId, status, remark)),
  /** 待处理工单数 */
  pendingCount: () => query(() => feedbackService.pendingFeedbackCount()),
}

/* ------------------------------ 多态收藏（v1-plus 模块3） ------------------------------ */
export const favoriteApi = {
  /** 是否已收藏某资源 */
  isFavorited: (userId: number, targetType: FavoriteTargetType, targetId: number) =>
    query(() => favoriteService.isFavorited(userId, targetType, targetId)),
  /** 批量查某类资源中已收藏的 id（列表页批量标注星标状态） */
  listIds: (userId: number, targetType: FavoriteTargetType) =>
    query(() => favoriteService.listFavoriteIds(userId, targetType)),
  /** 切换收藏状态，返回切换后的状态（true = 已收藏） */
  toggle: (userId: number, targetType: FavoriteTargetType, targetId: number) =>
    call(() => favoriteService.toggleFavorite(userId, targetType, targetId)),
  /** 我的收藏列表（按资源类型分 Tab；可用性已判定） */
  list: (userId: number, targetType: FavoriteTargetType) =>
    query(() => favoriteService.listFavorites(userId, targetType)),
  /** 收藏总数（三类合计） */
  count: (userId: number) => query(() => favoriteService.favoriteCount(userId)),
}

/* ------------------------------ 题目私有笔记（v1-plus 模块2） ------------------------------ */
export const noteApi = {
  /** 读取本人对某题的笔记（没写过返回 null） */
  get: (userId: number, questionId: number) =>
    query(() => noteService.getMyNote(userId, questionId)),
  /** 批量读取本人笔记（答题回顾页一屏多题，避免逐题请求） */
  list: (userId: number, questionIds: number[]) =>
    query(() => noteService.listMyNotes(userId, questionIds)),
  /** 保存本人笔记（编辑覆盖，唯一键 = 用户 + 题目；空内容视为删除） */
  save: (userId: number, questionId: number, content: string) =>
    call(() => noteService.saveMyNote(userId, questionId, content)),
}

/* ------------------------------ 统计与主页 ------------------------------ */
export const statApi = {
  accuracy: (userId: number) => query(() => statService.accuracy(userId)),
  profile: (viewerId: number | null, targetUserId: number) =>
    query(() => statService.profileView(viewerId, targetUserId)),
  pending: (userId: number) => query(() => statService.pendingSummary(userId)),
  /** v1-plus 模块5：个人学习统计大盘（**仅本人可见**，他人访问由页面按 403 拦截） */
  dashboard: (userId: number) => query(() => statService.dashboard(userId)),
}

/* ============================================================================
 * Actor 一致性校验（批次 3 补齐的安全缺口）
 *
 * 问题：多数方法以 `userId`（发起者）作为参数，Mock 服务层按该 id 直接操作数据。
 * 因此「已登录用户传入他人的 id」时会以他人身份读写 —— 属于越权（13 号 §5.3）。
 *
 * 做法：**显式清单 + 统一包装**，而不是逐个改 32 个方法的签名
 * （逐个改最容易出现「漏改一个」这种最危险的错误；清单集中一处、便于审计）。
 *
 * 清单值 = 该方法的**发起者参数下标**。为什么必须显式写下标：
 *   - `draft.createQuestion(draftId, userId, payload)`：发起者在**第 2 个**参数；
 *   - `exam.detail(examId, userId)`：首参是资源 id，不是发起者；
 *   - `user.adminResetPassword(targetUserId, …)`：首参是**被操作对象**、不是发起者 —— 故不入清单
 *     （管理端方法的发起者一律由服务层 requireAdmin() 从会话推导）。
 * 靠「猜第一个数字参数是发起者」会同时误伤读方法与上述方法，故不可取。
 *
 * 覆盖范围：写方法 + 「以本人为主体」的私有读方法（错题集、答题记录、组卷预览、准确率）。
 * 跨用户读取一律走 `stat.profile(viewerId, targetUserId)` / `exam.detailForViewer(...)` 这类
 * 带 viewer 语义的接口，它们**不**在清单内（由隐私裁剪规则控制）。
 *
 * Phase 2 换成真实后端后，发起者由 JWT 决定，这份清单随之作废（对应 13 号 §10.4）。
 * ========================================================================== */
const ACTOR_ARG_INDEX: Record<string, Record<string, number>> = {
  user: { updateProfile: 0, changePassword: 0, deactivate: 0 },
  category: { create: 0, update: 0, remove: 0 },
  tag: { create: 0, update: 0, remove: 0 },
  draft: {
    listMine: 0,
    create: 0,
    deleteQuestion: 0,
    adminUpdateQuestionTags: 0,
    updateMeta: 1,
    switchStatus: 1,
    discard: 1,
    saveAs: 1,
    createQuestion: 1,
    updateQuestion: 1,
    copyAsNew: 1,
    attachQuestion: 1,
    detachQuestion: 1,
    moveQuestion: 1,
    updateRelScore: 1,
  },
  exam: {
    start: 0,
    listMine: 0,
    listUnsubmitted: 0,
    detail: 1,
    saveAnswer: 1,
    submit: 1,
    remove: 1,
    abandon: 1,
    clearAnswers: 1,
  },
  wrong: { list: 0, counts: 0, details: 0, remove: 0, state: 0 },
  compose: { preview: 0, validate: 0, generate: 0, generateAndEnable: 0, suggestName: 0 },
  stat: { accuracy: 0, pending: 0, dashboard: 0 },
  knowledge: {
    listMine: 0,
    create: 0,
    searchQuestions: 0,
    update: 1,
    remove: 1,
    saveAnnotation: 1,
  },
  note: { get: 0, list: 0, save: 0 },
  favorite: { isFavorited: 0, listIds: 0, toggle: 0, list: 0, count: 0 },
  feedback: { submit: 0, listMine: 0 },
}

/** 发起者必须是当前会话用户本人 */
function assertActor(actorId: number): void {
  const me = authService.currentUser()
  if (!me) throw new ApiError('未登录或登录已失效', ApiCode.SESSION)
  if (me.id !== actorId) throw new ApiError('无权以他人身份执行该操作', ApiCode.NO_PERMISSION)
}

type ApiGroup = Record<string, unknown>

/**
 * 给清单内的方法套上 actor 校验（其余方法原样透传）
 *
 * 注意必须用泛型 `T` 并把结果断言回 `T`：否则包装后整组 API 的类型会被
 * `Record<string, unknown>` 擦掉，页面里 `api.exam.start(...)` 全部退化成 unknown
 * （vue-tsc 会立刻报一片 TS18046 —— 这条门禁正是用来兜住这类「运行时正确、类型层崩塌」的改动）。
 */
function guardActor<T extends ApiGroup>(group: string, apiGroup: T): T {
  const spec = ACTOR_ARG_INDEX[group] ?? {}
  const guarded: ApiGroup = { ...apiGroup }
  for (const [name, index] of Object.entries(spec)) {
    const original = apiGroup[name]
    if (typeof original !== 'function') continue
    guarded[name] = async (...args: unknown[]) => {
      const actorId = args[index]
      if (typeof actorId === 'number') assertActor(actorId)
      return (original as (...rest: unknown[]) => unknown)(...args)
    }
  }
  return guarded as T
}

export const api = {
  auth: authApi,
  user: guardActor('user', userApi),
  category: guardActor('category', categoryApi),
  tag: guardActor('tag', tagApi),
  draft: guardActor('draft', draftApi),
  exam: guardActor('exam', examApi),
  wrong: guardActor('wrong', wrongApi),
  compose: guardActor('compose', composeApi),
  knowledge: guardActor('knowledge', knowledgeApi),
  note: guardActor('note', noteApi),
  favorite: guardActor('favorite', favoriteApi),
  feedback: guardActor('feedback', feedbackApi),
  /*
   * ⚠ 必须套 guardActor：`ACTOR_ARG_INDEX.stat` 已登记 accuracy / pending / dashboard 三项，
   * 早期这里写成 `stat: statApi` 导致清单形同虚设（学情大盘的「仅本人」校验实际未生效）。
   * `stat.profile(viewerId, targetUserId)` 是跨用户读取，**故意不在清单内**，因此不受影响。
   */
  stat: guardActor('stat', statApi),
}
