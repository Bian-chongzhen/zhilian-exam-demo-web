import type {
  CategoryScoreWeight,
  CategoryTagRel,
  DraftQuestionRel,
  Favorite,
  FeedbackTicket,
  Knowledge,
  KnowledgeAnnotation,
  KnowledgeQuestionRel,
  KnowledgeTagRel,
  PaperCategory,
  PaperDraft,
  PaperExam,
  PaperExamQuestion,
  Question,
  QuestionNote,
  QuestionTag,
  QuestionTagRel,
  SysUser,
  UserQuestionRecord,
  UserWrongDetail,
} from '@/types/models'
import { buildSeed } from './seed'

export const DB_KEY = 'zhilian-qbank-demo-db-v1'
export const SESSION_KEY = 'zhilian-qbank-demo-session-v1'
/** 各用户的会话版本号（用于「全部在线会话失效」；属会话基础设施，不是业务表） */
export const SESSION_EPOCH_KEY = 'zhilian-qbank-demo-session-epoch-v1'
/** 续答位置（纯 UI 状态，不属业务数据；按答题记录 id 记忆上次停留的题号） */
export const EXAM_POS_KEY = 'zhilian-qbank-demo-exam-pos-v1'

/** Mock 内存库的表集合：前 13 张与《5、数据库设计》一一对应，其后为 v1-plus 新增集合 */
export interface MockTables {
  users: SysUser[]
  categories: PaperCategory[]
  categoryTagRels: CategoryTagRel[]
  categoryWeights: CategoryScoreWeight[]
  tags: QuestionTag[]
  drafts: PaperDraft[]
  draftQuestionRels: DraftQuestionRel[]
  questions: Question[]
  questionTagRels: QuestionTagRel[]
  exams: PaperExam[]
  examQuestions: PaperExamQuestion[]
  records: UserQuestionRecord[]
  wrongDetails: UserWrongDetail[]
  /* --- v1-plus 模块1：知识点知识库（14 号 §10.4 集合 1~4）--- */
  knowledge: Knowledge[]
  knowledgeTagRels: KnowledgeTagRel[]
  knowledgeQuestionRels: KnowledgeQuestionRel[]
  knowledgeAnnotations: KnowledgeAnnotation[]
  /* --- v1-plus 模块2：题目私有笔记（14 号 §10.4 集合 5）--- */
  questionNotes: QuestionNote[]
  /* --- v1-plus 模块3：多态收藏（14 号 §10.4 集合 6）--- */
  favorites: Favorite[]
  /* --- v1-plus 模块4：题目报错反馈工单（14 号 §10.4 集合 7）--- */
  feedbackTickets: FeedbackTicket[]
}

export type TableName = keyof MockTables

export interface MockDb extends MockTables {
  seq: Record<string, number>
}

export interface SessionState {
  userId: number | null
  token: string | null
  loginTime: string | null
  /**
   * 登录时快照的角色（等价于 Phase 2 里 JWT / Redis Session 携带的角色声明）。
   * 用途（13 号 §6.1 UM-07）：管理员在后台改了某人的角色，**该用户当前会话不实时变化**，
   * 重新登录后才生效 —— 靠这份快照实现。
   */
  roleType?: number
  /**
   * 会话版本号：与 `sessionEpochOf(userId)` 不一致即视为已作废。
   * 用途（13 号 §6.1 UM-06）：管理员重置某用户密码后，该用户**全部在线会话立即失效**。
   * Phase 2 由 Redis Session 的全量失效承担，这里用版本号做等价模拟。
   */
  epoch?: number
}

let cache: MockDb | null = null

export function nowIso(): string {
  return new Date().toISOString()
}

/** 生成统一时间戳字段 */
export function newStamp(): { createTime: string; updateTime: string } {
  const t = nowIso()
  return { createTime: t, updateTime: t }
}

/** 全部表名（用于旧数据兼容：缺失的集合补空数组） */
const TABLE_KEYS: TableName[] = [
  'users',
  'categories',
  'categoryTagRels',
  'categoryWeights',
  'tags',
  'drafts',
  'draftQuestionRels',
  'questions',
  'questionTagRels',
  'exams',
  'examQuestions',
  'records',
  'wrongDetails',
  'knowledge',
  'knowledgeTagRels',
  'knowledgeQuestionRels',
  'knowledgeAnnotations',
  'questionNotes',
  'favorites',
  'feedbackTickets',
]

/**
 * 旧版本地数据兼容（**升级必备**）
 *
 * 场景：浏览器 localStorage 里存的是旧版本文档（例如 v0.5 时期，还没有 v1-plus 的知识点集合）。
 * 新代码直接 `db.knowledge.filter(...)` 会因为 `undefined` 抛错 —— 表现为「升级后一打开就崩」。
 * 这里在载入时把缺失的集合补成空数组、缺失的 seq 补成空对象，随后由种子数据或用户操作填充。
 */
export function migrateLegacyDb(db: MockDb): MockDb {
  const target = db as unknown as Record<string, unknown>
  for (const key of TABLE_KEYS) {
    if (!Array.isArray(target[key])) target[key] = []
  }
  if (!target.seq || typeof target.seq !== 'object') target.seq = {}
  return db
}

function loadFromStorage(): MockDb | null {
  try {
    const raw = localStorage.getItem(DB_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as MockDb
    return parsed && parsed.users ? migrateLegacyDb(parsed) : null
  } catch {
    return null
  }
}

function persist(): void {
  if (!cache) return
  try {
    localStorage.setItem(DB_KEY, JSON.stringify(cache))
  } catch (e) {
    console.warn('[mock-db] 持久化失败', e)
  }
}

export function getDb(): MockDb {
  if (!cache) {
    cache = loadFromStorage() ?? buildSeed()
    persist()
  }
  return cache
}

export function saveDb(): void {
  persist()
}

/** 重置为初始假数据（含会话、会话版本号与续答位置清理） */
export function resetDb(): void {
  cache = buildSeed()
  persist()
  clearSession()
  clearSessionEpochs()
  clearExamPositions()
}

export function bootstrapMockDb(): void {
  getDb()
}

/** 自增主键（对应数据库 bigint AUTO_INCREMENT） */
export function nextId(table: TableName): number {
  const db = getDb()
  db.seq[table] = (db.seq[table] ?? 0) + 1
  return db.seq[table]
}

/** 过滤逻辑删除记录（deleted = 0 为正常） */
export function active<T extends { deleted: number }>(rows: T[]): T[] {
  return rows.filter((r) => r.deleted === 0)
}

/**
 * 逻辑删除：deleted 置为该行 id（对应设计文档 3.3 节）
 * 该方案使 UNIQUE KEY (a, b, deleted) 在反复删除重建时依然成立。
 */
export function softDelete<T extends { id: number; deleted: number; deleteTime?: string | null }>(
  rows: T[],
  id: number,
): boolean {
  const row = rows.find((r) => r.id === id && r.deleted === 0)
  if (!row) return false
  row.deleted = row.id
  row.deleteTime = nowIso()
  return true
}

/* ------------------------------ 会话 ------------------------------ */

export function getSession(): SessionState {
  try {
    const raw = localStorage.getItem(SESSION_KEY)
    if (raw) return JSON.parse(raw) as SessionState
  } catch {
    /* ignore */
  }
  return { userId: null, token: null, loginTime: null }
}

export function setSession(state: SessionState): void {
  localStorage.setItem(SESSION_KEY, JSON.stringify(state))
}

export function clearSession(): void {
  localStorage.removeItem(SESSION_KEY)
}

/* ------------------- 会话版本号（「全部在线会话失效」语义） ------------------- */
/*
 * 为什么放在会话基础设施而不是业务表：
 * 「踢下线」是会话层的语义（Phase 2 由 Redis Session 承担），不属于《5、数据库设计》的 13 张表。
 * 因此与续答位置一样，单独存一个 localStorage 键，`resetDb()` 会一并清理。
 */

function readSessionEpochs(): Record<string, number> {
  try {
    const raw = localStorage.getItem(SESSION_EPOCH_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, number>) : {}
  } catch {
    return {}
  }
}

/** 某用户当前的会话版本号（未提升过则为 0） */
export function sessionEpochOf(userId: number): number {
  return readSessionEpochs()[String(userId)] ?? 0
}

/** 提升某用户的会话版本号 → 该用户**所有已发出的会话立即失效**（对应「重置密码后踢下线」） */
export function bumpSessionEpoch(userId: number): void {
  try {
    const all = readSessionEpochs()
    all[String(userId)] = (all[String(userId)] ?? 0) + 1
    localStorage.setItem(SESSION_EPOCH_KEY, JSON.stringify(all))
  } catch (e) {
    console.warn('[mock-db] 会话版本号持久化失败', e)
  }
}

export function clearSessionEpochs(): void {
  localStorage.removeItem(SESSION_EPOCH_KEY)
}

/** 会话是否已被作废：会话记录的版本号与当前版本号不一致即失效 */
export function isSessionStale(session: SessionState): boolean {
  if (!session.userId) return false
  return (session.epoch ?? 0) !== sessionEpochOf(session.userId)
}

/* --------------------- 续答位置（界面状态，非业务数据） --------------------- */
/*
 * 「上次答到第几题」属于界面状态，因此不进 Mock 库的 13 张表（与《5、数据库设计》保持一致），
 * 单独存一个 localStorage 键。`resetDb()` 会一并清掉，避免重置演示数据后题号串位。
 */

export function getExamPositions(): Record<string, number> {
  try {
    const raw = localStorage.getItem(EXAM_POS_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, number>) : {}
  } catch {
    return {}
  }
}

export function setExamPosition(examId: number, index: number): void {
  try {
    const all = getExamPositions()
    all[String(examId)] = index
    localStorage.setItem(EXAM_POS_KEY, JSON.stringify(all))
  } catch (e) {
    console.warn('[mock-db] 续答位置持久化失败', e)
  }
}

export function removeExamPosition(examId: number): void {
  try {
    const all = getExamPositions()
    delete all[String(examId)]
    localStorage.setItem(EXAM_POS_KEY, JSON.stringify(all))
  } catch (e) {
    console.warn('[mock-db] 续答位置清理失败', e)
  }
}

export function clearExamPositions(): void {
  localStorage.removeItem(EXAM_POS_KEY)
}
