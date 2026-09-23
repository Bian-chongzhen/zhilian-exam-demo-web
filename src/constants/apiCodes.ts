/**
 * 契约面错误码
 *
 * 目的：让页面能按**语义**区分「无权限 / 资源不存在 / 会话失效」，而不是去匹配错误文案
 * （匹配文案一旦改文案就会静默失效，与《16、样式优化.md》§9 的文案风格化直接冲突）。
 *
 * 依据：《13、知练题库 v0.5 需求规格文档.md》§9.2
 *   - S3 拦截态需要「原地渲染无权限提示」→ 需要 NO_PERMISSION
 *   - S4 资源不可用态需要「提示资源已不存在」→ 需要 NOT_FOUND
 *   - PER-02 会话失效需要与「从未登录（游客）」区分 → 需要 SESSION
 *
 * 这是纯前端语义码，Phase 2 换成 axios 时映射为 HTTP 401 / 403 / 404。
 */
export const ApiCode = {
  /** 未分类的业务失败（默认） */
  GENERIC: 1,
  /** 会话失效或未登录 */
  SESSION: 401,
  /** 已登录但无权限 */
  NO_PERMISSION: 403,
  /** 资源不存在或对当前身份不可见 */
  NOT_FOUND: 404,
} as const

export type ApiCode = (typeof ApiCode)[keyof typeof ApiCode]
