import { DraftStatus, PrivacyType, RoleType, Visibility } from '@/constants/enums'
import { Copy } from '@/constants/copy'
import type { SysUser } from '@/types/models'
import {
  bumpSessionEpoch,
  clearSession,
  getDb,
  getSession,
  isSessionStale,
  newStamp,
  nextId,
  nowIso,
  sessionEpochOf,
  setSession,
} from '../db'
import { noPermission, notFound, sessionInvalid } from '../errors'
import { findUser, findUserByName, findUsersByPhone } from '../repo'
import { hashPassword, verifyPassword } from '../rules/password'

/** 账号与权限服务（对应业务需求文档第一章） */

export interface RegisterParams {
  username: string
  password: string
  phone: string
}

export interface LoginParams {
  mode: 'username' | 'phone'
  username: string
  password: string
  /** 手机号登录时必须额外提供用户名以消除账号歧义（P0-9 决策） */
  phone?: string
}

export interface LoginResult {
  token: string
  user: SysUser
}

const PHONE_RE = /^\d{11}$/

function assertPhone(phone: string): void {
  if (!phone) throw new Error('手机号必填')
  if (!PHONE_RE.test(phone)) throw new Error('手机号格式不正确（应为 11 位数字）')
}

/** 用户名唯一性校验：注销账号的用户名不可复用 */
export function isUsernameTaken(username: string): boolean {
  return getDb().users.some((u) => u.username === username)
}

export function checkUsernameAvailable(username: string): { available: boolean; message: string } {
  if (!username.trim()) return { available: false, message: '用户名不能为空' }
  if (isUsernameTaken(username)) return { available: false, message: '该用户名已被占用（注销账号的用户名同样不可复用）' }
  return { available: true, message: '该用户名可使用' }
}

export function register(params: RegisterParams): SysUser {
  const username = params.username.trim()
  if (!username) throw new Error('用户名不能为空')
  if (!params.password) throw new Error('密码不能为空')
  if (params.password.length > 128) throw new Error('密码长度不能超过 128 字符')
  assertPhone(params.phone)
  if (isUsernameTaken(username)) throw new Error('该用户名已被占用')

  const db = getDb()
  const stamp = newStamp()
  const user: SysUser = {
    id: nextId('users'),
    deleted: 0,
    ...stamp,
    username,
    password: hashPassword(params.password),
    phone: params.phone,
    roleType: RoleType.USER,
    profile: null,
    privacyType: PrivacyType.PRIVATE,
    lastLoginTime: null,
  }
  db.users.push(user)
  return user
}

/**
 * 登录
 * - 用户名登录：用户名 + 密码
 * - 手机号登录：手机号 + 用户名 + 密码（手机号允许重复，需二元匹配消除歧义）
 */
export function login(params: LoginParams): LoginResult {
  let user: SysUser | null = null

  if (params.mode === 'phone') {
    const phone = (params.phone ?? '').trim()
    if (!phone) throw new Error('请输入手机号')
    if (!params.username.trim()) throw new Error('手机号登录需同时填写用户名以确定账号')
    const candidates = findUsersByPhone(phone).filter((u) => u.username === params.username.trim())
    if (candidates.length === 0) throw new Error('手机号与用户名不匹配')
    user = candidates[0]
  } else {
    user = findUserByName(params.username.trim())
  }

  if (!user) throw new Error('账号或密码错误')
  if (user.deleted !== 0) throw new Error('该账号已注销，无法登录')
  if (!verifyPassword(params.password, user.password)) throw new Error('账号或密码错误')

  user.lastLoginTime = nowIso()
  const token = `demo-token-${user.id}-${Date.now().toString(36)}`
  // 会话里快照角色与会话版本号：
  //   角色快照 → 后台改角色「下次登录生效」（UM-07）
  //   版本号   → 后台重置密码可让该用户所有会话立即失效（UM-06）
  setSession({
    userId: user.id,
    token,
    loginTime: nowIso(),
    roleType: user.roleType,
    epoch: sessionEpochOf(user.id),
  })
  return { token, user }
}

export function logout(): void {
  clearSession()
}

/** 当前登录用户（会话失效时返回 null） */
export function currentUser(): SysUser | null {
  const session = getSession()
  if (!session.userId) return null
  const user = findUser(session.userId)
  if (!user || user.deleted !== 0) {
    // 注销 / 不存在 → 会话立即失效（对应 Q19 决策）
    clearSession()
    return null
  }
  // 会话版本不一致 → 该用户已被管理员重置密码，所有会话作废（UM-06）
  if (isSessionStale(session)) {
    clearSession()
    return null
  }
  /*
   * 角色以「登录时的快照」为准（等价于 JWT 里的角色声明）：
   * 管理员改了某人的角色，该用户**已建立的会话不实时变化**，重新登录后才生效（UM-07）。
   * 注意返回副本，避免把快照角色写回数据库。
   */
  if (session.roleType && session.roleType !== user.roleType) {
    return { ...user, roleType: session.roleType as SysUser['roleType'] }
  }
  return user
}

export function requireUser(): SysUser {
  const user = currentUser()
  if (!user) throw sessionInvalid()
  return user
}

export function requireAdmin(): SysUser {
  const user = requireUser()
  if (user.roleType !== RoleType.ADMIN) throw noPermission('需要管理员权限')
  return user
}

/**
 * 会话记录存在、但对应账号已失效（被注销或不存在）
 *
 * 用途（13 号 §6.3 PER-02）：区分「从未登录的游客」与「登录已失效」，
 * 两者都跳登录页，但登录页需要给出不同提示（固定文案见 `constants/copy.ts`）。
 * 注意不能直接用 currentUser() 判断——它会把失效会话顺手清掉。
 */
export function isSessionExpired(): boolean {
  const session = getSession()
  if (!session.userId) return false
  const user = findUser(session.userId)
  if (!user || user.deleted !== 0) return true
  // 被管理员重置密码而作废的会话，同属「登录已失效」
  return isSessionStale(session)
}

/** 找回密码：手机号 + 用户名 二元匹配（无短信验证） */
export function resetPassword(params: {
  phone: string
  username: string
  newPassword: string
}): void {
  const phone = params.phone.trim()
  const username = params.username.trim()
  if (!phone || !username) throw new Error('手机号与用户名均需填写')
  if (!params.newPassword) throw new Error('新密码不能为空')

  const user = getDb().users.find(
    (u) => u.deleted === 0 && u.phone === phone && u.username === username,
  )
  if (!user) throw new Error('手机号与用户名不匹配，无法重置密码')

  user.password = hashPassword(params.newPassword)
  user.updateTime = nowIso()
  // 重置成功后所有在线会话失效
  clearSession()
}

export function updateProfile(userId: number, params: { profile?: string | null; privacyType?: number }): SysUser {
  const db = getDb()
  const user = db.users.find((u) => u.id === userId && u.deleted === 0)
  if (!user) throw new Error('用户不存在')
  if (params.profile !== undefined) {
    if ((params.profile ?? '').length > 500) throw new Error('个人简介最多 500 字')
    user.profile = params.profile
  }
  if (params.privacyType !== undefined) {
    if (![PrivacyType.PRIVATE, PrivacyType.PUBLIC].includes(params.privacyType as PrivacyType)) {
      throw new Error('隐私设置取值非法')
    }
    user.privacyType = params.privacyType as PrivacyType
  }
  user.updateTime = nowIso()
  return user
}

export function changePassword(userId: number, oldPassword: string, newPassword: string): void {
  const user = findUser(userId)
  if (!user) throw new Error('用户不存在')
  if (!verifyPassword(oldPassword, user.password)) throw new Error('原密码不正确')
  if (!newPassword) throw new Error('新密码不能为空')
  user.password = hashPassword(newPassword)
  user.updateTime = nowIso()
}

/**
 * 账号注销（逻辑删除）
 * - 私有试卷随账号失效（置废弃，不展示）
 * - 公开试卷保留，可供其他用户继续使用
 * - 历史答题记录、错题、准确率全部保留，供他人主页展示（标注"已注销"）
 */
export function deactivateAccount(userId: number, password: string): void {
  const db = getDb()
  const user = db.users.find((u) => u.id === userId && u.deleted === 0)
  if (!user) throw new Error('用户不存在')
  if (!verifyPassword(password, user.password)) throw new Error('密码不正确，无法注销')

  const now = nowIso()
  user.deleted = user.id
  user.deleteTime = now
  user.updateTime = now

  db.drafts
    .filter((d) => d.userId === userId && d.visibility === Visibility.PRIVATE && d.deleted === 0)
    .forEach((d) => {
      d.draftStatus = DraftStatus.DISCARDED
      d.updateTime = now
    })

  clearSession()
}

/** 用户列表（管理端与主页跳转使用） */
export function listUsers(): SysUser[] {
  return getDb().users.filter((u) => u.deleted === 0)
}

/* ------------------------- 管理端：用户账号管理（v0.5） ------------------------- */
/*
 * 依据《13、知练题库 v0.5 需求规格文档.md》§3 与 §6.1：
 *   UM-01/02 仅管理员可访问      → requireAdmin() 抛 403（界面另有菜单隐藏 + 无权限提示块）
 *   UM-03/04 已注销账号不可操作  → **服务层直接拒绝**，不只靠按钮置灰
 *   UM-05 不能取消自己的管理员角色
 *   UM-06 重置密码 → 该用户全部会话立即失效
 *   UM-07 切换角色 → 对已登录用户「下次登录生效」（不触碰其已建立的会话）
 *
 * 注意：以下方法**不接受「操作者 id」参数** —— 权限判定一律以会话为准（requireAdmin），
 * 不能让调用方声明自己是谁。这也是 13 号 §5.3 安全约束在服务层的落地。
 */

/** 管理员视角的用户列表项（**不含密码哈希**，只输出管理端需要的字段） */
export interface AdminUserItem {
  id: number
  username: string
  phone: string
  createTime: string
  /** 逻辑删除时间；正常账号为 null */
  deleteTime: string | null
  /** 账号状态由逻辑删除派生（13 号：不新增枚举）：deleted = 0 正常，非 0 已逻辑注销 */
  deactivated: boolean
  roleType: RoleType
  /** 是否为当前操作者本人（用于「不能取消自己的管理员角色」的界面表达） */
  isSelf: boolean
}

/** 账号状态筛选（查询参数，非数据库枚举） */
export type AccountStatusFilter = 'all' | 'normal' | 'deactivated'

export interface AdminUserFilter {
  /** 用户名关键字（包含匹配、忽略大小写） */
  keyword?: string
  accountStatus?: AccountStatusFilter
}

/**
 * 用户账号列表（**包含已注销账号**）
 * 与 `listUsers()` 的差别：后者只返回正常账号；管理端必须能看到已注销账号（13 号 §3 核心约束 2）。
 */
export function listUsersForAdmin(filter: AdminUserFilter = {}): AdminUserItem[] {
  const operator = requireAdmin()
  const keyword = (filter.keyword ?? '').trim().toLowerCase()
  const status = filter.accountStatus ?? 'all'

  return getDb()
    .users.filter((u) => {
      if (keyword && !u.username.toLowerCase().includes(keyword)) return false
      if (status === 'normal') return u.deleted === 0
      if (status === 'deactivated') return u.deleted !== 0
      return true
    })
    .map((u) => ({
      id: u.id,
      username: u.username,
      phone: u.phone,
      createTime: u.createTime,
      deleteTime: u.deleteTime ?? null,
      deactivated: u.deleted !== 0,
      roleType: u.roleType,
      isSelf: u.id === operator.id,
    }))
    .sort((a, b) => a.id - b.id)
}

/** 重置指定用户密码（UM-06）：成功后该用户**全部在线会话立即失效**，必须重新登录 */
export function adminResetPassword(targetUserId: number, newPassword: string): void {
  requireAdmin()
  const target = getDb().users.find((u) => u.id === targetUserId)
  if (!target) throw notFound('用户不存在')
  if (target.deleted !== 0) throw noPermission(Copy.accountDeactivated)
  if (!newPassword) throw new Error('新密码不能为空')

  target.password = hashPassword(newPassword)
  target.updateTime = nowIso()
  // 提升会话版本号 → 该用户所有已发出的会话（含其它标签页）立即作废
  bumpSessionEpoch(target.id)
}

/**
 * 切换指定用户角色（普通用户 ↔ 管理员），返回切换后的角色
 * - UM-05：**不允许操作自己**（管理员把自己降级会让平台失去管理员）
 * - UM-07：只改数据库角色，不触碰目标用户已建立的会话 → 其重新登录后才生效
 */
export function adminSwitchRole(targetUserId: number): RoleType {
  const operator = requireAdmin()
  const target = getDb().users.find((u) => u.id === targetUserId)
  if (!target) throw notFound('用户不存在')
  if (target.deleted !== 0) throw noPermission(Copy.accountDeactivated)
  if (target.id === operator.id) throw noPermission(Copy.cannotCancelOwnAdmin)

  target.roleType = target.roleType === RoleType.ADMIN ? RoleType.USER : RoleType.ADMIN
  target.updateTime = nowIso()
  return target.roleType
}
