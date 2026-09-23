/**
 * Demo 环境密码处理
 * 注意：真实后端使用 bcrypt（见《6、技术选型与技术方案》D6）。
 * 此处仅为 Demo 模拟"密码不以明文存储"的语义，不做安全承诺。
 */
export function hashPassword(plain: string): string {
  let h = 2166136261
  for (let i = 0; i < plain.length; i += 1) {
    h ^= plain.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return `$demo$${(h >>> 0).toString(16)}$${plain.length}`
}

export function verifyPassword(plain: string, hashed: string): boolean {
  return hashPassword(plain) === hashed
}

/** Demo 统一初始密码 */
export const DEMO_PASSWORD = '123456'
