import { JudgeResult, QuestionType } from '@/constants/enums'
import type { Question, QuestionOption } from '@/types/models'

/** 解析 options JSON（简答题为 null） */
export function parseOptions(raw?: string | null): QuestionOption[] {
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? (parsed as QuestionOption[]) : []
  } catch {
    return []
  }
}

export function stringifyOptions(options: QuestionOption[]): string {
  return JSON.stringify(options)
}

/** 判断题的固定选项（设计文档 6.1 节格式契约） */
export const JUDGE_OPTIONS: QuestionOption[] = [
  { key: '1', content: '正确' },
  { key: '0', content: '错误' },
]

export function defaultOptionsFor(type: QuestionType): QuestionOption[] {
  if (type === QuestionType.JUDGE) return JUDGE_OPTIONS.map((o) => ({ ...o }))
  if (type === QuestionType.SHORT_ANSWER) return []
  return [
    { key: 'A', content: '' },
    { key: 'B', content: '' },
    { key: 'C', content: '' },
    { key: 'D', content: '' },
  ]
}

/** 多选答案拆分：大写、逗号分隔、升序 */
export function splitMulti(value: string): string[] {
  return value
    .split(/[,，]/)
    .map((v) => v.trim().toUpperCase())
    .filter(Boolean)
    .sort()
}

export function joinMulti(values: string[]): string {
  return [...values].map((v) => v.trim().toUpperCase()).filter(Boolean).sort().join(',')
}

export function sameSet(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false
  const sa = [...a].sort()
  const sb = [...b].sort()
  return sa.every((v, i) => v === sb[i])
}

/**
 * 客观题判分（设计文档 5.2 节）
 * - 单选 / 判断：字符串相等
 * - 多选：集合相等（多选、少选、错选均为错）
 * - 未作答：交卷时判为错误
 */
export function judgeObjective(
  type: QuestionType,
  answer: string,
  userAnswer?: string | null,
): JudgeResult {
  const ua = (userAnswer ?? '').trim()
  if (!ua) return JudgeResult.WRONG
  if (type === QuestionType.MULTIPLE) {
    return sameSet(splitMulti(answer), splitMulti(ua)) ? JudgeResult.RIGHT : JudgeResult.WRONG
  }
  return answer.trim().toUpperCase() === ua.toUpperCase()
    ? JudgeResult.RIGHT
    : JudgeResult.WRONG
}

/** 题型是否为客观题（简答题走 AI 判分，v1 不判分） */
export function isObjective(type: QuestionType): boolean {
  return type !== QuestionType.SHORT_ANSWER
}

/** 单题得分 = 分值 × 判题结果（简答题 v1 不判分 → 得分为 null） */
export function scoreOf(score: number, result: JudgeResult | null | undefined): number | null {
  if (result === null || result === undefined) return null
  return result === JudgeResult.RIGHT ? score : 0
}

/**
 * 题目录入 / 试卷启用前的合法性校验（设计文档 2.2 节启用前置校验）
 * 返回错误信息列表，空数组表示通过。
 */
export function validateQuestion(question: Question): string[] {
  const errors: string[] = []
  const label = `题目#${question.id}`
  if (!question.title.trim()) errors.push(`${label}：题干不能为空`)
  if (question.score <= 0) errors.push(`${label}：分值必须大于 0`)

  if (question.questionType === QuestionType.SINGLE || question.questionType === QuestionType.MULTIPLE) {
    const options = parseOptions(question.options)
    if (options.length < 2) errors.push(`${label}：单选/多选至少需要 2 个选项`)
    if (options.some((o) => !o.content.trim())) errors.push(`${label}：存在内容为空的选项`)
    const keys = options.map((o) => o.key.toUpperCase())
    if (new Set(keys).size !== keys.length) errors.push(`${label}：选项 key 重复`)
    const answerKeys = question.questionType === QuestionType.MULTIPLE
      ? splitMulti(question.answer)
      : [question.answer.trim().toUpperCase()]
    if (answerKeys.some((k) => !k || !keys.includes(k))) {
      errors.push(`${label}：参考答案与选项不匹配`)
    }
    if (question.questionType === QuestionType.MULTIPLE && answerKeys.length < 2) {
      errors.push(`${label}：多选题参考答案至少需包含 2 个选项`)
    }
    if (question.questionType === QuestionType.SINGLE && answerKeys.length !== 1) {
      errors.push(`${label}：单选题参考答案只能有 1 个选项`)
    }
  }

  if (question.questionType === QuestionType.JUDGE) {
    if (!['0', '1'].includes(question.answer.trim())) {
      errors.push(`${label}：判断题参考答案必须为 1（正确）或 0（错误）`)
    }
  }

  if (question.questionType === QuestionType.SHORT_ANSWER && !question.answer.trim()) {
    errors.push(`${label}：简答题必须填写参考答案（用于交卷后自评对照）`)
  }

  return errors
}

/** 已作答？ */
export function isAnswered(userAnswer?: string | null): boolean {
  return typeof userAnswer === 'string' && userAnswer.trim().length > 0
}
