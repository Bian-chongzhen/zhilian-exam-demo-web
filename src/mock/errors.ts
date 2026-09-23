/**
 * 领域错误（带语义错误码）
 *
 * 为什么需要：Mock service 层原来只抛 `new Error(中文文案)`，页面拿到错误只能靠**匹配文案**
 * 判断是「无权限」还是「资源不存在」。而 v0.5 要求
 *   - S3：无权限 → 原地渲染无权限提示块（不跳首页）
 *   - S4：资源已删除/已转私有 → 提示「该资源已不存在或已被删除」
 * 靠文案匹配会在改文案时静默失效，所以把语义提升为错误码。
 *
 * 流转：service 抛 `DomainError` → `api/index.ts` 映射为 `ApiError.code` → 页面按码分支。
 * Phase 2 换成真实后端时，这里对应 HTTP 403 / 404 / 401。
 */
import { ApiCode } from '@/constants/apiCodes'

export class DomainError extends Error {
  code: ApiCode

  constructor(message: string, code: ApiCode = ApiCode.GENERIC) {
    super(message)
    this.name = 'DomainError'
    this.code = code
  }
}

/** 已登录但无权访问该资源（S3） */
export function noPermission(message = '无权访问该资源'): DomainError {
  return new DomainError(message, ApiCode.NO_PERMISSION)
}

/** 资源不存在，或对当前身份不可见（S4） */
export function notFound(message = '资源不存在'): DomainError {
  return new DomainError(message, ApiCode.NOT_FOUND)
}

/** 未登录或会话已失效（PER-02） */
export function sessionInvalid(message = '未登录或登录已失效'): DomainError {
  return new DomainError(message, ApiCode.SESSION)
}
