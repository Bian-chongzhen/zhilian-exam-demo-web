/**
 * 业务枚举统一定义
 * 严格对齐《5、数据库设计（修订初版V1.0）.md》第 4 节，取值与数据库 tinyint 一致。
 */

/** 4.1 角色类型 */
export const RoleType = { ADMIN: 1, USER: 2 } as const
export type RoleType = (typeof RoleType)[keyof typeof RoleType]
export const RoleTypeLabel: Record<number, string> = { 1: '管理员', 2: '普通用户' }

/** 4.2 用户隐私类型 */
export const PrivacyType = { PRIVATE: 1, PUBLIC: 2 } as const
export type PrivacyType = (typeof PrivacyType)[keyof typeof PrivacyType]
export const PrivacyTypeLabel: Record<number, string> = { 1: '隐私', 2: '公开' }

/** 4.3 试卷类型（分类不绑定类型，为试卷自身属性） */
export const PaperType = { COMPETITIVE: 1, PRACTICE: 2 } as const
export type PaperType = (typeof PaperType)[keyof typeof PaperType]
export const PaperTypeLabel: Record<number, string> = { 1: '竞技型', 2: '练习型' }

/** 4.4 试卷可见性 */
export const Visibility = { PRIVATE: 1, PUBLIC: 2 } as const
export type Visibility = (typeof Visibility)[keyof typeof Visibility]
export const VisibilityLabel: Record<number, string> = { 1: '私有', 2: '公开' }

/** 4.5 试卷状态 */
export const DraftStatus = { ENABLED: 1, DISABLED: 2, DISCARDED: 3 } as const
export type DraftStatus = (typeof DraftStatus)[keyof typeof DraftStatus]
export const DraftStatusLabel: Record<number, string> = { 1: '启用', 2: '停用', 3: '废弃' }

/** 4.6 锁定标识（首次启用后永久置 1，不可回退） */
export const LockFlag = { UNLOCKED: 0, LOCKED: 1 } as const

/** 4.7 题型 */
export const QuestionType = { SINGLE: 1, MULTIPLE: 2, JUDGE: 3, SHORT_ANSWER: 4 } as const
export type QuestionType = (typeof QuestionType)[keyof typeof QuestionType]
export const QuestionTypeLabel: Record<number, string> = {
  1: '单选',
  2: '多选',
  3: '判断',
  4: '简答',
}

/** 4.8 判题状态（v1 不产生 WAIT_RETRY——AI 判分后置 v1.5） */
export const JudgeStatus = { PENDING: 1, JUDGED: 2, WAIT_RETRY: 3 } as const
export type JudgeStatus = (typeof JudgeStatus)[keyof typeof JudgeStatus]
export const JudgeStatusLabel: Record<number, string> = {
  1: '待判分',
  2: '已判分',
  3: '待重试',
}

/** 4.9 判题结果 */
export const JudgeResult = { WRONG: 0, RIGHT: 1 } as const
export type JudgeResult = (typeof JudgeResult)[keyof typeof JudgeResult]
export const JudgeResultLabel: Record<number, string> = { 0: '错误', 1: '正确' }

/** 4.10 错题掌握状态 */
export const MasterStatus = { WRONG_SET: 0, MASTERED_SET: 1 } as const
export type MasterStatus = (typeof MasterStatus)[keyof typeof MasterStatus]
export const MasterStatusLabel: Record<number, string> = { 0: '错题集合', 1: '已掌握集合' }

/** 4.11 答题记录来源 */
export const ExamSourceType = { NORMAL: 1, WRONG_COMPOSE: 2 } as const
export type ExamSourceType = (typeof ExamSourceType)[keyof typeof ExamSourceType]
export const ExamSourceTypeLabel: Record<number, string> = { 1: '普通答题', 2: '错题组卷' }

/** 4.12 试卷来源 */
export const DraftSourceType = { MANUAL: 1, WRONG_COMPOSE: 2 } as const
export type DraftSourceType = (typeof DraftSourceType)[keyof typeof DraftSourceType]
export const DraftSourceTypeLabel: Record<number, string> = { 1: '手工创建', 2: '错题组卷生成' }

/** 4.13 标签启用状态 */
export const EnabledFlag = { DISABLED: 0, ENABLED: 1 } as const

/** 题干内容格式（v1 固定为纯文本，为 v2 富文本/图片预留） */
export const TitleFormat = { PLAIN: 1, MARKDOWN: 2, HTML: 3 } as const
export type TitleFormat = (typeof TitleFormat)[keyof typeof TitleFormat]

/* ------------------------------------------------------------------ */
/* v1-plus 新增枚举（14 号 §10.4 集合 6）                                */
/* ⚠ 新增枚举须同步《5、数据库设计》第 4 节（项目硬性约束）                */
/* ------------------------------------------------------------------ */

/** 收藏对象类型（多态收藏：试卷底稿 / 题目 / 知识点） */
export const FavoriteTargetType = { DRAFT: 1, QUESTION: 2, KNOWLEDGE: 3 } as const
export type FavoriteTargetType = (typeof FavoriteTargetType)[keyof typeof FavoriteTargetType]
export const FavoriteTargetTypeLabel: Record<number, string> = {
  1: '试卷',
  2: '题目',
  3: '知识点',
}

/** 反馈工单状态（14 号 模块4：待处理 / 已处理 / 忽略） */
export const FeedbackStatus = { PENDING: 1, HANDLED: 2, IGNORED: 3 } as const
export type FeedbackStatus = (typeof FeedbackStatus)[keyof typeof FeedbackStatus]
export const FeedbackStatusLabel: Record<number, string> = {
  1: '待处理',
  2: '已处理',
  3: '忽略',
}

/* ------------------------------------------------------------------ */
/* 以下为业务过程枚举（不落库，仅用于组卷请求与界面交互）                 */
/* ------------------------------------------------------------------ */

/** 错题组卷：考点标签匹配模式 */
export const TagMatchMode = { ANY: 1, ALL: 2 } as const
export type TagMatchMode = (typeof TagMatchMode)[keyof typeof TagMatchMode]
export const TagMatchModeLabel: Record<number, string> = { 1: '匹配任意选中标签', 2: '必须同时匹配全部标签' }

/** 错题组卷：题目来源范围 */
export const ComposeScope = { WRONG_ONLY: 1, WRONG_AND_MASTERED: 2 } as const
export type ComposeScope = (typeof ComposeScope)[keyof typeof ComposeScope]
export const ComposeScopeLabel: Record<number, string> = {
  1: '仅错题集合',
  2: '错题集合 + 已掌握集合',
}

/** 错题组卷：抽取策略 */
export const ComposeStrategy = { WEIGHT: 1, RANDOM: 2, TIME: 3 } as const
export type ComposeStrategy = (typeof ComposeStrategy)[keyof typeof ComposeStrategy]
export const ComposeStrategyLabel: Record<number, string> = {
  1: '按权重抽取',
  2: '随机抽取',
  3: '按时间抽取（最近答错优先）',
}

/** 已掌握题在混合抽取中的权重折减系数（设计文档 6.3 节） */
export const MASTERED_SCOPE_FACTOR = 0.3

/** AI 自动重试上限（v1.5 启用，v1 不产生该状态） */
export const AI_MAX_RETRY = 3

/* ------------------------------------------------------------------ */
/* 下拉选项（供管理端与筛选使用）                                        */
/* ------------------------------------------------------------------ */

export const toOptions = (labelMap: Record<number, string>) =>
  Object.entries(labelMap).map(([value, label]) => ({ value: Number(value), label }))

export const PaperTypeOptions = toOptions(PaperTypeLabel)
export const VisibilityOptions = toOptions(VisibilityLabel)
export const DraftStatusOptions = toOptions(DraftStatusLabel)
export const QuestionTypeOptions = toOptions(QuestionTypeLabel)
export const TagMatchModeOptions = toOptions(TagMatchModeLabel)
export const ComposeScopeOptions = toOptions(ComposeScopeLabel)
export const ComposeStrategyOptions = toOptions(ComposeStrategyLabel)
export const FeedbackStatusOptions = toOptions(FeedbackStatusLabel)
