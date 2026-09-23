/**
 * 运行时身份（**不落库、不新增数据库枚举**）
 *
 * 依据《13、知练题库 v0.5 需求规格文档.md》§2：
 *   - 三种身份：游客 / 普通登录用户 / 管理员
 *   - 游客只是**运行时会话身份**，没有用户 id，不写入数据库
 *   - 数据库角色字段依旧只有两种（见 `constants/enums.ts` 的 `RoleType`）
 *
 * 判定规则（§2 补充约定）：**先看是否登录，再看角色**；
 * 唯一判定入口是 `stores/user.ts` 的 `identity` getter，页面禁止自行读取 roleType 拼装身份。
 */
export const Identity = {
  /** 未登录、未注册的临时浏览身份 */
  GUEST: 'guest',
  /** 角色为普通用户 */
  USER: 'user',
  /** 角色为管理员 */
  ADMIN: 'admin',
} as const

export type Identity = (typeof Identity)[keyof typeof Identity]

export const IdentityLabel: Record<Identity, string> = {
  guest: '游客',
  user: '普通登录用户',
  admin: '管理员',
}
