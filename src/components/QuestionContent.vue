<script setup lang="ts">
import { computed } from 'vue'
import { JudgeResult, JudgeStatus, QuestionType } from '@/constants/enums'
import type { QuestionOption } from '@/types/models'
import { joinMulti, splitMulti } from '@/mock/rules/judge'

/**
 * 题干与选项的唯一渲染入口（设计约定 6.2 节）
 * 按 title_format 分发：v1 仅支持纯文本，v2 扩展 Markdown / HTML 时只替换本组件。
 */
const props = withDefaults(
  defineProps<{
    title: string
    options?: QuestionOption[]
    questionType: QuestionType
    answer?: string | null
    userAnswer?: string | null
    judgeStatus?: number | null
    judgeResult?: number | null
    obtainedScore?: number | null
    score?: number
    showAnswer?: boolean
    compact?: boolean
    /** 可交互模式：选项「整块可点」并渲染单选 / 多选选择控件（答题页使用） */
    selectable?: boolean
  }>(),
  {
    options: () => [],
    answer: null,
    userAnswer: null,
    judgeStatus: null,
    judgeResult: null,
    obtainedScore: null,
    score: 0,
    showAnswer: false,
    compact: false,
    selectable: false,
  },
)

/** 选项被点击时抛出（仅 selectable 模式），由调用方写回答题会话 */
const emit = defineEmits<{ select: [key: string] }>()

const isShortAnswer = computed(() => props.questionType === QuestionType.SHORT_ANSWER)

const selectedKeys = computed(() => {
  if (!props.userAnswer) return [] as string[]
  if (props.questionType === QuestionType.MULTIPLE) return splitMulti(props.userAnswer)
  return [String(props.userAnswer).trim().toUpperCase()]
})

const answerKeys = computed(() => {
  if (!props.answer) return [] as string[]
  if (props.questionType === QuestionType.MULTIPLE) return splitMulti(props.answer)
  return [String(props.answer).trim().toUpperCase()]
})

const isMultiple = computed(() => props.questionType === QuestionType.MULTIPLE)

/** 单选 / 判断的当前选中项，供 el-radio 受控回显（脱离 radio-group 时 EP 取 props.modelValue） */
const singleSelected = computed(() => selectedKeys.value[0] ?? '')

/** 某选项是否被选中（大小写不敏感） */
function isSelected(key: string): boolean {
  return selectedKeys.value.includes(key.toUpperCase())
}

/** 选项整块可点：仅可交互模式派发选择事件 */
function onOptionClick(key: string): void {
  if (!props.selectable) return
  emit('select', key)
}

function optionState(key: string): 'selected' | 'correct' | 'wrong' | 'plain' {
  const upper = key.toUpperCase()
  const selected = selectedKeys.value.includes(upper)
  if (!props.showAnswer) return selected ? 'selected' : 'plain'
  const correct = answerKeys.value.includes(upper)
  if (selected && correct) return 'correct'
  if (selected && !correct) return 'wrong'
  if (!selected && correct) return 'correct'
  return 'plain'
}

const answerText = computed(() => {
  if (!props.showAnswer || !props.answer) return ''
  if (props.questionType === QuestionType.MULTIPLE) return joinMulti(splitMulti(props.answer))
  if (props.questionType === QuestionType.JUDGE) return props.answer === '1' ? '正确' : '错误'
  return props.answer
})

const resultTag = computed(() => {
  if (props.judgeStatus !== JudgeStatus.JUDGED) return null
  if (props.judgeResult === JudgeResult.RIGHT) return { type: 'success' as const, text: '正确' }
  if (props.judgeResult === JudgeResult.WRONG) return { type: 'danger' as const, text: '错误' }
  return null
})
</script>

<template>
  <div class="question-content">
    <div class="ql-question-title" :class="{ compact }">{{ title }}</div>

    <div v-if="!isShortAnswer" class="options" :class="{ 'is-selectable': selectable }">
      <div
        v-for="option in options"
        :key="option.key"
        class="ql-option"
        :class="[`state-${optionState(option.key)}`, { 'is-selected': isSelected(option.key) }]"
        @click="onOptionClick(option.key)"
      >
        <!-- 选择控件：仅可交互模式渲染。EP 原生控件保证与全局风格一致；
             @click.prevent 阻断控件自身切换，改由整行点击统一处理 -->
        <el-radio
          v-if="selectable && !isMultiple"
          class="ql-option__pick"
          :model-value="singleSelected"
          :value="option.key"
          @click.prevent
        />
        <el-checkbox
          v-else-if="selectable && isMultiple"
          class="ql-option__pick"
          :model-value="isSelected(option.key)"
          @click.prevent
        />
        <span class="option-key">({{ option.key }})</span>
        <span class="option-text">{{ option.content }}</span>
        <Icon v-if="showAnswer && optionState(option.key) === 'correct'" icon="ph:check" class="mark ok" />
        <Icon v-if="showAnswer && optionState(option.key) === 'wrong'" icon="ph:x" class="mark bad" />
      </div>
    </div>
    <div v-else class="short-answer-tip text-sub">
      简答题 · v1 不自动判分，交卷后对照参考答案自评
    </div>

    <div v-if="showAnswer" class="answer-block">
      <el-descriptions :column="compact ? 1 : 2" size="small" border>
        <el-descriptions-item label="参考答案">
          <span class="text-mono">{{ answerText || '—' }}</span>
        </el-descriptions-item>
        <el-descriptions-item label="我的作答">
          <span class="text-mono">{{ userAnswer || '未作答' }}</span>
        </el-descriptions-item>
        <el-descriptions-item v-if="resultTag" label="判分结果">
          <el-tag :type="resultTag.type" size="small">{{ resultTag.text }}</el-tag>
          <span v-if="obtainedScore !== null" class="score-text">
            得分 {{ obtainedScore }} / {{ score }}
          </span>
        </el-descriptions-item>
        <el-descriptions-item v-else-if="judgeStatus === 1" label="判分结果">
          <el-tag type="info" size="small">待判分（AI 判分将于后续版本开放）</el-tag>
        </el-descriptions-item>
      </el-descriptions>
    </div>
  </div>
</template>

<style scoped>
.options {
  margin: 10px 0 4px;
}

.ql-option {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 7px 10px;
  border-radius: 4px;
  line-height: 1.6;
  white-space: pre-wrap;
  border: 1px solid transparent;
}

.ql-option.state-selected {
  background: var(--ql-primary-soft);
  border-color: var(--ql-primary-line);
}

.ql-option.state-correct {
  background: var(--ql-success-soft);
  border-color: var(--ql-success-line);
}

.ql-option.state-wrong {
  background: var(--ql-danger-soft);
  border-color: var(--ql-danger-line);
}

/* ---------- 可交互模式（答题页）：选项整块可点，行样式与卡片式选项一致 ---------- */
.options.is-selectable {
  display: flex;
  flex-direction: column;
  gap: var(--ql-s1);
}

.options.is-selectable .ql-option {
  padding: 10px 14px;
  border-color: var(--ql-border);
  border-radius: var(--ql-radius-sm);
  cursor: pointer;
  transition: background-color var(--ql-dur-fast) var(--ql-ease-spring),
    border-color var(--ql-dur-fast) var(--ql-ease-spring);
}

.options.is-selectable .ql-option:hover {
  border-color: var(--ql-primary);
  background: var(--ql-primary-soft);
}

/*
 * 选择控件与首行文字垂直对齐
 * - `.ql-option` 行高 1.6 → 首行行盒 14 × 1.6 = 22.4px，文字视觉中心在 11.2px 处
 * - EP 的 `.el-radio__input` 盒高就是圆圈自身 14px、`.el-checkbox` 默认盒高 32px，
 *   直接放在 `align-items: flex-start` 的行里会与文字错开
 * 修法：控件盒高统一取首行行高并在盒内居中（EP 控件自身 align-items: center），
 * 不写死偏移量；选项文字换行时仍对齐「首行」而非整块居中。
 */
.ql-option__pick {
  flex: none;
  height: calc(var(--ql-fs-body) * 1.6);
  margin-right: 0;
}

/* 只需要圆圈 / 方框本身：隐藏 EP 控件自带的空 label，避免多撑出 8px 间距 */
.ql-option__pick :deep(.el-radio__label),
.ql-option__pick :deep(.el-checkbox__label) {
  display: none;
}

.option-key {
  font-weight: 600;
  min-width: 26px;
}

.option-text {
  flex: 1;
}

.mark {
  margin-top: 3px;
}

.mark.ok {
  color: var(--ql-success);
}

.mark.bad {
  color: var(--ql-danger);
}

.short-answer-tip {
  margin: 8px 0;
  font-size: 13px;
}

.answer-block {
  margin-top: 12px;
}

.score-text {
  margin-left: 8px;
  color: var(--ql-muted);
  font-size: 12px;
}

.compact {
  font-size: 13px;
}
</style>
