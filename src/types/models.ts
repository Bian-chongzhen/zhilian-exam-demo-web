import type {
  DraftSourceType,
  DraftStatus,
  ExamSourceType,
  FavoriteTargetType,
  FeedbackStatus,
  JudgeResult,
  JudgeStatus,
  MasterStatus,
  PaperType,
  PrivacyType,
  QuestionType,
  RoleType,
  TitleFormat,
  Visibility,
} from '@/constants/enums'

/** 公共字段：逻辑删除规范（deleted = 0 正常，非 0 已删除且值等于 id） */
export interface BaseEntity {
  id: number
  deleted: number
  deleteTime?: string | null
  createTime: string
  updateTime?: string
}

/** 5.1 用户 */
export interface SysUser extends BaseEntity {
  username: string
  password: string
  phone: string
  roleType: RoleType
  profile?: string | null
  privacyType: PrivacyType
  lastLoginTime?: string | null
}

/** 5.2 试卷分类（不含试卷类型，见 P0-6 决策③） */
export interface PaperCategory extends BaseEntity {
  categoryName: string
  fixedQuestionCount: number
  isSystem: number
  sortNo: number
}

/** 5.3 分类-考点归属 */
export interface CategoryTagRel extends BaseEntity {
  categoryId: number
  tagId: number
}

/** 5.4 分类考点权重（无记录时按均权 1.00） */
export interface CategoryScoreWeight extends BaseEntity {
  categoryId: number
  tagId: number
  weight: number
}

/** 5.5 考点标签（扁平结构） */
export interface QuestionTag extends BaseEntity {
  tagName: string
  isEnabled: number
  sortNo: number
}

/** 5.6 试卷 */
export interface PaperDraft extends BaseEntity {
  draftName: string
  userId: number
  categoryId: number
  paperType: PaperType
  visibility: Visibility
  draftStatus: DraftStatus
  /** 锁定三件套之①：首次启用后永久置 1 */
  isLocked: number
  sourceType: DraftSourceType
  randomOrder: number
  questionCount: number
  enableTime?: string | null
}

/** 5.7 试卷-题目关联（题目可被多份试卷共享引用） */
export interface DraftQuestionRel extends BaseEntity {
  draftId: number
  questionId: number
  sortNo: number
  score: number
}

/** 5.8 题目 */
export interface Question extends BaseEntity {
  questionType: QuestionType
  title: string
  titleFormat: TitleFormat
  options?: string | null
  answer: string
  analysis?: string | null
  score: number
  /** 锁定三件套之②：被任一已锁定试卷引用后置 1，永久 */
  isLocked: number
}

/** 选项结构（options 字段的 JSON 解析结果） */
export interface QuestionOption {
  key: string
  content: string
}

/** 5.9 题目-标签关联（不受题目锁定限制） */
export interface QuestionTagRel extends BaseEntity {
  questionId: number
  tagId: number
}

/** 5.10 答题记录 */
export interface PaperExam extends BaseEntity {
  userId: number
  draftId: number
  draftName: string
  categoryId: number
  paperType: PaperType
  sourceType: ExamSourceType
  attemptNo: number
  questionCount: number
  totalScore?: number | null
  obtainedScore?: number | null
  usedSeconds?: number | null
  submitTime?: string | null
}

/** 5.11 答题小题记录 */
export interface PaperExamQuestion extends BaseEntity {
  examId: number
  questionId: number
  sortNo: number
  questionType: QuestionType
  score: number
  userAnswer?: string | null
  judgeStatus: JudgeStatus
  judgeResult?: JudgeResult | null
  obtainedScore?: number | null
  aiExplain?: string | null
  aiRetryTimes: number
  manualRetryTimes: number
  judgeTime?: string | null
}

/** 5.12 用户错题 / 已掌握记录（维度：用户 + 题目 + 分类） */
export interface UserQuestionRecord extends BaseEntity {
  userId: number
  questionId: number
  categoryId: number
  isMaster: MasterStatus
  wrongCount: number
  lastExamId?: number | null
  lastExamQuestionId?: number | null
  lastWrongTime?: string | null
  masterTime?: string | null
}

/** 5.13 错题作答明细（可追溯多次练习历史） */
export interface UserWrongDetail extends BaseEntity {
  recordId: number
  examId: number
  examQuestionId: number
  userAnswer?: string | null
  judgeResult?: JudgeResult | null
  aiExplain?: string | null
  answerTime: string
}

/* ------------------------------------------------------------------ */
/* 视图模型（服务层返回给页面的聚合结构）                                 */
/* ------------------------------------------------------------------ */

/** 试卷列表项 */
export interface DraftListItem extends PaperDraft {
  categoryName: string
  ownerName: string
  canEdit: boolean
}

/** 试卷详情（含题目） */
export interface DraftDetail {
  draft: PaperDraft
  category: PaperCategory
  owner: SysUser
  questions: DraftQuestionItem[]
  canEdit: boolean
  /** 该试卷引用的题目中有多少被锁定（用于界面提示） */
  lockedQuestionCount: number
}

export interface DraftQuestionItem {
  relId: number
  questionId: number
  sortNo: number
  score: number
  question: Question
  tagIds: number[]
  tagNames: string[]
}

/** 答题记录详情（含逐题信息） */
export interface ExamDetail {
  exam: PaperExam
  items: ExamQuestionItem[]
  /** 是否允许继续作答（未提交） */
  editable: boolean
}

export interface ExamQuestionItem {
  examQuestionId: number
  questionId: number
  sortNo: number
  questionType: QuestionType
  score: number
  title: string
  options: QuestionOption[]
  /** 参考答案与解析：仅在已交卷时下发（未交卷时为空，防作弊） */
  answer?: string | null
  analysis?: string | null
  tagNames: string[]
  userAnswer?: string | null
  judgeStatus: JudgeStatus
  judgeResult?: JudgeResult | null
  obtainedScore?: number | null
  aiExplain?: string | null
}

/** 答题记录列表项 */
export interface ExamListItem extends PaperExam {
  categoryName: string
  rightCount: number
  wrongCount: number
  pendingCount: number
}

/** 准确率统计 */
export interface AccuracyStat {
  userId: number
  globalAccuracy: number | null
  judgedCount: number
  rightCount: number
  categories: CategoryAccuracy[]
}

export interface CategoryAccuracy {
  categoryId: number
  categoryName: string
  accuracy: number | null
  judgedCount: number
  rightCount: number
}

/** 个人主页聚合数据（按隐私配置裁剪） */
export interface ProfileView {
  user: Pick<SysUser, 'id' | 'username' | 'profile' | 'privacyType' | 'deleted' | 'createTime'>
  /** 访问者是否能看到统计与记录（本人或对方公开） */
  canViewDetail: boolean
  publicDrafts: DraftListItem[]
  /** 该用户的公开知识点（v1-plus 模块1；**与隐私设置无关，公开知识点对所有人可见**） */
  publicKnowledge: KnowledgeListItem[]
  accuracy?: AccuracyStat | null
  exams?: ExamListItem[]
  wrongRecords?: WrongRecordItem[]
}

/** 错题 / 已掌握集合项 */
export interface WrongRecordItem {
  recordId: number
  questionId: number
  categoryId: number
  categoryName: string
  isMaster: MasterStatus
  wrongCount: number
  lastWrongTime?: string | null
  masterTime?: string | null
  questionType: QuestionType
  title: string
  options: QuestionOption[]
  answer: string
  analysis?: string | null
  tagNames: string[]
  detailCount: number
}

/** 错题作答明细项 */
export interface WrongDetailItem {
  id: number
  examId: number
  examQuestionId: number
  examName?: string
  userAnswer?: string | null
  judgeResult?: JudgeResult | null
  aiExplain?: string | null
  answerTime: string
}

/** 组卷候选预览 */
export interface ComposePreview {
  candidates: ComposeCandidate[]
  targetCount: number
  availableCount: number
  categoryName: string
  warnings: string[]
}

export interface ComposeCandidate {
  questionId: number
  title: string
  questionType: QuestionType
  categoryId: number
  isMaster: MasterStatus
  wrongCount: number
  weight: number
  lastWrongTime?: string | null
  tagNames: string[]
}

/** 组卷参数 */
export interface ComposeParams {
  categoryId: number
  paperType: PaperType
  tagIds: number[]
  matchMode: number
  scope: number
  strategy: number
  targetCount?: number
  visibility: Visibility
  draftName: string
}

/** 分类管理项（含标签与权重配置） */
export interface CategoryDetail extends PaperCategory {
  tagIds: number[]
  weights: Array<{ tagId: number; weight: number }>
  draftCount: number
}

/** 统一响应体（与后端约定一致：{ code, message, data, traceId }） */
export interface ApiResult<T> {
  code: number
  message: string
  data: T
  traceId: string
}

/* ================================================================== */
/* v1-plus 模块1：Markdown 知识点知识库（14 号 §4 / §10.4 集合 1~4）      */
/* ================================================================== */

/** 知识点：用户创作的 Markdown 学习讲义 */
export interface Knowledge extends BaseEntity {
  userId: number
  title: string
  summary?: string | null
  /** Markdown 正文（v1-plus 不做富文本与图片，见 14 号 §7） */
  content: string
  /** 私有 / 公开：与试卷底稿同语义（普通用户新建默认私有，管理员默认公开） */
  visibility: Visibility
}

/** 知识点-考点标签关联（多对多） */
export interface KnowledgeTagRel extends BaseEntity {
  knowledgeId: number
  tagId: number
}

/**
 * 知识点-题目关联（多对多）
 * 与「底稿编辑页题目弹窗里关联知识点」是**同一套关联关系**，两处改动双向同步（14 号 §4.3）。
 */
export interface KnowledgeQuestionRel extends BaseEntity {
  knowledgeId: number
  questionId: number
}

/** 用户对知识点的私有批注（用户 + 知识点唯一；仅本人可见） */
export interface KnowledgeAnnotation extends BaseEntity {
  knowledgeId: number
  userId: number
  content: string
}

/** 广场排序方式（14 号 §4.1：默认最新创建；可选最新更新、标题 A-Z） */
export type KnowledgeSort = 'created' | 'updated' | 'title'

/** 广场筛选条件 */
export interface KnowledgeFilter {
  /** **仅标题前缀匹配**，不搜正文（14 号 §4.1） */
  keyword?: string
  /** 通过「知识点绑定的标签归属的分类」过滤 */
  categoryId?: number | null
  /** 标签多选：命中任一即算匹配 */
  tagIds?: number[]
  sort?: KnowledgeSort
}

/** 知识点列表项（广场卡片 / 我的知识点共用） */
export interface KnowledgeListItem extends Knowledge {
  authorName: string
  /** 作者是否已注销（广场与主页需要标注） */
  authorDeleted: boolean
  tagIds: number[]
  tagNames: string[]
  /** 由标签归属推导出的分类（一个知识点可能跨多个分类） */
  categoryIds: number[]
  categoryNames: string[]
}

/** 知识点关联的题目（用于详情页列表；点击跳转所在试卷预览页） */
export interface KnowledgeQuestionItem {
  questionId: number
  title: string
  questionType: QuestionType
  /** 可跳转的试卷（优先公开/启用）；题目未挂任何可见试卷时为 null */
  draftId: number | null
  draftName: string | null
}

/** 知识点详情 */
export interface KnowledgeDetail {
  knowledge: Knowledge
  author: Pick<SysUser, 'id' | 'username' | 'deleted'>
  tagIds: number[]
  tagNames: string[]
  /** 已逻辑删除的关联题目会被移出列表（15 号 KD-05），不影响知识点本身阅读 */
  questions: KnowledgeQuestionItem[]
  /** 本人批注；未登录或未写过为 null（他人永远看不到） */
  myAnnotation: string | null
  /** 仅作者本人可编辑 */
  canEdit: boolean
}

/** 标题查重与相似提示结果（14 号 §4.3 保存前提示） */
export interface KnowledgeTitleCheck {
  /** 是否已存在标题**完全相同**的公开知识点（保存为公开前需二次确认） */
  exactDuplicate: boolean
  /** 主题相近的公开知识点（仅提示，不阻止保存；最多 5 条） */
  similar: Array<{ id: number; title: string }>
}

/** 错题/回顾页跳转用的「题目 → 关联知识点」轻量项 */
export interface QuestionKnowledgeLink {
  id: number
  title: string
}

/* ================================================================== */
/* v1-plus 模块2：题目私有笔记（14 号 §10.4 集合 5）                     */
/* ================================================================== */

/**
 * 题目私有笔记：用户针对**单道题目**写的 Markdown 笔记，仅本人可见。
 * 唯一性：用户 + 题目（编辑覆盖，不产生多条）。
 * 与知识点批注的区别：批注针对一份知识点文档，笔记针对一道题。
 */
export interface QuestionNote extends BaseEntity {
  userId: number
  questionId: number
  content: string
}

/* ================================================================== */
/* v1-plus 模块3：多态收藏（14 号 §10.4 集合 6）                          */
/* ================================================================== */

/**
 * 收藏记录（多态：试卷底稿 / 题目 / 知识点）
 * 唯一性：用户 + 资源类型 + 资源 id（同一用户不能重复收藏同一资源）。
 * 业务约束：收藏只是**个人标记**，不改变资源本身的业务状态（14 号 模块3）。
 */
export interface Favorite extends BaseEntity {
  userId: number
  targetType: FavoriteTargetType
  targetId: number
}

/** 收藏列表项（已做资源可用性判定，页面据此置灰 / 跳转） */
export interface FavoriteItem {
  id: number
  targetType: FavoriteTargetType
  targetId: number
  title: string
  /** 副标题：试卷显示分类与题量、题目显示题型与所在试卷、知识点显示考点标签 */
  subtitle: string
  favoritedAt: string
  /**
   * 资源当前是否可访问（15 号 FA-02 / FA-03）：
   * 资源被逻辑删除、被废弃、或转为私有且收藏者不是作者时为 false。
   * 不可访问时：条目**保留并置灰**、提示「资源已不可访问」、仍可手动取消收藏。
   */
  available: boolean
  /** 可跳转路由；不可访问时为 null */
  link: string | null
}

/* ================================================================== */
/* v1-plus 模块4：题目报错反馈工单（14 号 §10.4 集合 7）                   */
/* ================================================================== */

/**
 * 反馈工单：用户做题时发现题干/答案/解析有误，提交反馈。
 * **工单只流转信息，不会自动修改题库任何数据**（14 号 模块4）——
 * 管理员要改题仍需走原有「复制为新题」流程，遵守底稿与题目锁定规则。
 */
export interface FeedbackTicket extends BaseEntity {
  userId: number
  questionId: number
  description: string
  status: FeedbackStatus
  adminRemark?: string | null
  /** 处理人（管理员） */
  handledBy?: number | null
  handledTime?: string | null
}

/** 工单列表项（管理端） */
export interface FeedbackItem {
  id: number
  userId: number
  submitterName: string
  submitterDeleted: boolean
  questionId: number
  /** 题目预览片段；题目已被删除时为 null（界面标注「题目已删除」，FB-02） */
  questionPreview: string | null
  questionType: QuestionType | null
  /** 该题当前所在试卷，供管理员跳去题库纠错 / 试卷编辑走原有流程 */
  draftId: number | null
  draftName: string | null
  description: string
  status: FeedbackStatus
  adminRemark: string | null
  handledByName: string | null
  handledTime: string | null
  createTime: string
}

/** 管理端工单筛选（14 号 模块4：状态 + 时间范围） */
export interface FeedbackFilter {
  /** 'all' 表示全部状态 */
  status?: FeedbackStatus | 'all'
  /** 按提交时间的起止（YYYY-MM-DD，含端点） */
  startDate?: string | null
  endDate?: string | null
}

/* ================================================================== */
/* v1-plus 模块5：个人学习统计大盘（14 号 模块5，**不新增业务表**）        */
/* ================================================================== */

/**
 * 统计口径（严格沿用 v1 基线，不得放宽）：
 *   - 只统计**已交卷**记录
 *   - 只统计**已判分**的小题
 *   - **简答题不计入**任何指标（v1 不判分）
 *   - 删除答题记录后统计同步更新
 */

/** 顶部数字卡片 */
export interface StatsTotals {
  /** 总完成试卷数（已交卷的答题记录数） */
  finishedExamCount: number
  /** 总作答客观题数量（已判分小题数，Q4 口径） */
  judgedQuestionCount: number
  /** 总错题数量（错题集合中的题目数） */
  wrongCount: number
  /** 已掌握题目数量（已掌握集合中的题目数） */
  masteredCount: number
  /** 全局准确率（无已判分数据时为 null） */
  globalAccuracy: number | null
}

/** 答题趋势的一天 */
export interface StatsTrendPoint {
  /** YYYY-MM-DD */
  date: string
  /** 当日完成的试卷数（按交卷时间归属） */
  examCount: number
  /** 当日做题量 = 当日已判分客观题小题数（Q4 已定案） */
  questionCount: number
}

/** 考点错题排行项 */
export interface StatsTagWrongItem {
  tagId: number
  tagName: string
  /** 该考点下本人的错题数量（错题集合；一题多标签时各标签分别计数） */
  wrongCount: number
}

/** 错题集 / 已掌握集数量对比（饼图） */
export interface StatsSetCompare {
  wrongCount: number
  masteredCount: number
}

/** 个人学习统计大盘的全部数据 */
export interface StatsDashboard {
  totals: StatsTotals
  /** 答题趋势（按日期升序；仅包含有数据的日期） */
  trend: StatsTrendPoint[]
  /** 各试卷分类正确率（复用 v1 的题级准确率口径） */
  categoryAccuracy: CategoryAccuracy[]
  /** 考点错题排行（按错题数降序） */
  tagWrongRanking: StatsTagWrongItem[]
  setCompare: StatsSetCompare
  /** 是否完全没有数据（界面据此走 ST-02 / ST-05 空状态） */
  empty: boolean
}
