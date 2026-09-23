import { Copy } from '@/constants/copy'
import { getDb, newStamp, nextId, nowIso, softDelete } from '../db'
import { notFound } from '../errors'

/**
 * 题目私有笔记服务（v1-plus 模块2）
 *
 * 依据《14、v1 plus.md》模块2：
 *   - 一个用户对同一道题**只有一份笔记**，编辑覆盖，不产生多条
 *   - 笔记**完全私有**，其他用户（含查看你错题记录的人）看不到
 *   - 删除答题记录**不删笔记**；题目被锁定 / 废弃，笔记依然保留
 *     （实现上笔记独立成表，不挂在答题记录或题目上，因此这些操作天然影响不到它）
 *   - 未登录不可写；面板对游客隐藏（页面侧 S2）
 *
 * 与「知识点批注」的区别：批注针对一份知识点文档，笔记针对一道题。
 */

/** 读取本人对某题的笔记；没写过返回 null */
export function getMyNote(userId: number, questionId: number): string | null {
  const row = getDb().questionNotes.find(
    (n) => n.deleted === 0 && n.userId === userId && n.questionId === questionId,
  )
  return row ? row.content : null
}

/**
 * 批量读取本人笔记（答题回顾页一屏多题，避免逐题请求）
 * 返回 questionId → content 的映射，只包含写过的题。
 */
export function listMyNotes(userId: number, questionIds: number[]): Record<number, string> {
  const wanted = new Set(questionIds)
  const map: Record<number, string> = {}
  getDb()
    .questionNotes.filter((n) => n.deleted === 0 && n.userId === userId && wanted.has(n.questionId))
    .forEach((n) => {
      map[n.questionId] = n.content
    })
  return map
}

/**
 * 保存本人笔记（编辑覆盖，唯一键 = 用户 + 题目）
 * 内容为空视为删除笔记（与批注一致，界面上「清空保存」= 删掉）
 */
export function saveMyNote(userId: number, questionId: number, content: string): void {
  const db = getDb()
  if (!db.questions.some((q) => q.id === questionId && q.deleted === 0)) {
    // 题目已不存在（例如被删除）时不允许新建笔记；已存在的笔记仍可读取与编辑（NT-04 语义）
    const existing = db.questionNotes.find(
      (n) => n.deleted === 0 && n.userId === userId && n.questionId === questionId,
    )
    if (!existing) throw notFound('题目不存在或已被删除')
  }

  const existing = db.questionNotes.find(
    (n) => n.deleted === 0 && n.userId === userId && n.questionId === questionId,
  )
  const text = content.trim()

  if (!text) {
    if (existing) softDelete(db.questionNotes, existing.id)
    return
  }
  if (existing) {
    existing.content = text
    existing.updateTime = nowIso()
    return
  }
  db.questionNotes.push({
    ...newStamp(),
    id: nextId('questionNotes'),
    deleted: 0,
    userId,
    questionId,
    content: text,
  })
}

/** 供界面提示用的文案（保持单一来源） */
export const NOTE_EMPTY_HINT = Copy.noteEmpty
