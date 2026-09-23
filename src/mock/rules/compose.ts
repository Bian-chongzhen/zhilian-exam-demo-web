import { ComposeScope, ComposeStrategy, MASTERED_SCOPE_FACTOR, MasterStatus } from '@/constants/enums'
import type { ComposeCandidate, ComposeParams, ComposePreview } from '@/types/models'
import {
  categoryTagIds,
  categoryWeightMap,
  findCategory,
  findQuestion,
  questionTagIds,
  questionTagNames,
  recordsOfUser,
} from '../repo'

/**
 * 错题组卷：候选集构建 + 双重加权抽题
 * 对应设计文档 6.3 节：
 *   P(q) = base_weight(q) × (1 + wrong_count) × scope_factor
 *   base_weight = 该题命中标签在分类权重配置中的平均值（无配置按 1.00）
 *   scope_factor = 1.0（错题集合） | 0.3（已掌握集合）
 */

/** 构建候选集（含权重计算） */
export function buildCandidates(userId: number, params: ComposeParams): {
  candidates: ComposeCandidate[]
  warnings: string[]
} {
  const warnings: string[] = []
  const category = findCategory(params.categoryId)
  if (!category) return { candidates: [], warnings: ['试卷分类不存在'] }

  const categoryTags = categoryTagIds(params.categoryId)
  const weightMap = categoryWeightMap(params.categoryId)
  const selectedTags = params.tagIds.filter((id) => categoryTags.includes(id))
  if (params.tagIds.length !== selectedTags.length) {
    warnings.push('已自动忽略不属于当前分类的考点标签')
  }

  const scopeRecords = recordsOfUser(userId).filter((r) => {
    if (r.categoryId !== params.categoryId) return false
    if (params.scope === ComposeScope.WRONG_ONLY) return r.isMaster === MasterStatus.WRONG_SET
    return true
  })

  const candidates: ComposeCandidate[] = []

  scopeRecords.forEach((record) => {
    const question = findQuestion(record.questionId)
    if (!question) return // 题目已删除则跳过（组卷跳过失效题）

    const tagIds = questionTagIds(question.id)

    // 标签过滤：任意匹配取并集，全部匹配取交集
    if (selectedTags.length > 0) {
      if (params.matchMode === 2) {
        const allMatched = selectedTags.every((id) => tagIds.includes(id))
        if (!allMatched) return
      } else {
        const anyMatched = selectedTags.some((id) => tagIds.includes(id))
        if (!anyMatched) return
      }
    }

    // base_weight：命中标签（选中标签优先，否则分类内全部标签）权重的平均值
    const baseTagPool = selectedTags.length > 0
      ? tagIds.filter((id) => selectedTags.includes(id))
      : tagIds.filter((id) => categoryTags.includes(id))
    const weights = baseTagPool.map((id) => weightMap.get(id) ?? 1.0)
    const baseWeight = weights.length > 0
      ? weights.reduce((sum, w) => sum + w, 0) / weights.length
      : 1.0

    const scopeFactor = record.isMaster === MasterStatus.MASTERED_SET ? MASTERED_SCOPE_FACTOR : 1.0
    const weight = baseWeight * (1 + record.wrongCount) * scopeFactor

    candidates.push({
      questionId: question.id,
      title: question.title,
      questionType: question.questionType,
      categoryId: params.categoryId,
      isMaster: record.isMaster,
      wrongCount: record.wrongCount,
      weight: Number(weight.toFixed(4)),
      lastWrongTime: record.lastWrongTime ?? null,
      tagNames: questionTagNames(question.id),
    })
  })

  return { candidates, warnings }
}

/** 组卷预览（不落库） */
export function previewCompose(userId: number, params: ComposeParams): ComposePreview {
  const category = findCategory(params.categoryId)
  const { candidates, warnings } = buildCandidates(userId, params)
  const targetCount = params.targetCount ?? category?.fixedQuestionCount ?? candidates.length
  if (candidates.length < targetCount) {
    warnings.push(
      `可抽题目 ${candidates.length} 道，少于目标题量 ${targetCount} 道，将按实际数量生成`,
    )
  }
  return {
    candidates,
    targetCount,
    availableCount: candidates.length,
    categoryName: category?.categoryName ?? '—',
    warnings,
  }
}

/** 无放回抽样（去重：同一题目仅出现一次） */
function drawWithoutReplacement(
  pool: ComposeCandidate[],
  count: number,
  pick: (remaining: ComposeCandidate[]) => number,
): ComposeCandidate[] {
  const remaining = [...pool]
  const picked: ComposeCandidate[] = []
  while (picked.length < count && remaining.length > 0) {
    const index = pick(remaining)
    picked.push(remaining[index])
    remaining.splice(index, 1)
  }
  return picked
}

/** 按权重抽取 */
function drawByWeight(pool: ComposeCandidate[], count: number): ComposeCandidate[] {
  return drawWithoutReplacement(pool, count, (remaining) => {
    const total = remaining.reduce((sum, c) => sum + c.weight, 0)
    if (total <= 0) return Math.floor(Math.random() * remaining.length)
    let r = Math.random() * total
    for (let i = 0; i < remaining.length; i += 1) {
      r -= remaining[i].weight
      if (r <= 0) return i
    }
    return remaining.length - 1
  })
}

/** 随机抽取 */
function drawByRandom(pool: ComposeCandidate[], count: number): ComposeCandidate[] {
  return drawWithoutReplacement(pool, count, (remaining) =>
    Math.floor(Math.random() * remaining.length),
  )
}

/** 按时间抽取（最近答错优先；无时间的排在最后） */
function drawByTime(pool: ComposeCandidate[], count: number): ComposeCandidate[] {
  return [...pool]
    .sort((a, b) => {
      const ta = a.lastWrongTime ?? ''
      const tb = b.lastWrongTime ?? ''
      return tb.localeCompare(ta)
    })
    .slice(0, count)
}

/** 执行抽取 */
export function drawQuestions(
  candidates: ComposeCandidate[],
  strategy: number,
  targetCount: number,
): ComposeCandidate[] {
  if (candidates.length === 0) return []
  const count = Math.min(targetCount, candidates.length)
  if (strategy === ComposeStrategy.RANDOM) return drawByRandom(candidates, count)
  if (strategy === ComposeStrategy.TIME) return drawByTime(candidates, count)
  return drawByWeight(candidates, count)
}

/** 计算题目在当前分类下的抽样权重（用于界面展示，便于验证公式） */
export function explainWeight(userId: number, categoryId: number, questionId: number): {
  baseWeight: number
  wrongCount: number
  scopeFactor: number
  weight: number
} | null {
  const candidate = buildCandidates(userId, {
    categoryId,
    paperType: 1,
    tagIds: [],
    matchMode: 1,
    scope: ComposeScope.WRONG_AND_MASTERED,
    strategy: ComposeStrategy.WEIGHT,
    visibility: 1,
    draftName: '',
  }).candidates.find((c) => c.questionId === questionId)
  if (!candidate) return null
  const scopeFactor = candidate.isMaster === MasterStatus.MASTERED_SET ? MASTERED_SCOPE_FACTOR : 1.0
  return {
    baseWeight: Number((candidate.weight / ((1 + candidate.wrongCount) * scopeFactor)).toFixed(4)),
    wrongCount: candidate.wrongCount,
    scopeFactor,
    weight: candidate.weight,
  }
}
