<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { QuestionType, QuestionTypeLabel, QuestionTypeOptions } from '@/constants/enums'
import type { QuestionOption, QuestionTag } from '@/types/models'
import { defaultOptionsFor, parseOptions } from '@/mock/rules/judge'

/** 题目录入 / 编辑表单（试卷编辑与题库纠错共用） */
const props = defineProps<{
  modelValue: boolean
  /** 可选的考点标签（试卷编辑时限定为该分类白名单；管理员纠错时传全部） */
  tags: QuestionTag[]
  /** 只读：题目已被锁定，仅可查看 */
  readOnly?: boolean
  initial?: {
    questionType: QuestionType
    title: string
    options: QuestionOption[]
    answer: string
    analysis?: string | null
    score: number
    tagIds: number[]
  } | null
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
  (e: 'submit', payload: {
    questionType: QuestionType
    title: string
    options: QuestionOption[]
    answer: string
    analysis: string | null
    score: number
    tagIds: number[]
  }): void
}>()

const visible = computed({
  get: () => props.modelValue,
  set: (value: boolean) => emit('update:modelValue', value),
})

const form = reactive({
  questionType: QuestionType.SINGLE as QuestionType,
  title: '',
  options: [] as QuestionOption[],
  answer: '',
  analysis: '',
  score: 1,
  tagIds: [] as number[],
})

const multiAnswer = ref<string[]>([])

function reset() {
  const init = props.initial
  form.questionType = init?.questionType ?? QuestionType.SINGLE
  form.title = init?.title ?? ''
  form.options = init?.options?.length ? init.options.map((o) => ({ ...o })) : defaultOptionsFor(form.questionType)
  form.answer = init?.answer ?? ''
  form.analysis = init?.analysis ?? ''
  form.score = init?.score ?? 1
  form.tagIds = init?.tagIds ? [...init.tagIds] : []
  multiAnswer.value = form.questionType === QuestionType.MULTIPLE
    ? form.answer.split(/[,，]/).map((v) => v.trim().toUpperCase()).filter(Boolean)
    : []
}

watch(
  () => props.modelValue,
  (open) => {
    if (open) reset()
  },
)

watch(
  () => form.questionType,
  (type, old) => {
    if (type === old) return
    if (type === QuestionType.JUDGE) {
      form.options = defaultOptionsFor(QuestionType.JUDGE)
      form.answer = '1'
    } else if (type === QuestionType.SHORT_ANSWER) {
      form.options = []
      form.answer = ''
    } else {
      form.options = defaultOptionsFor(type)
      form.answer = ''
    }
    multiAnswer.value = []
  },
)

function addOption() {
  const nextKey = String.fromCharCode(65 + form.options.length)
  form.options.push({ key: nextKey, content: '' })
}

function removeOption(index: number) {
  form.options.splice(index, 1)
  form.options.forEach((option, i) => {
    option.key = String.fromCharCode(65 + i)
  })
}

function toggleMulti(key: string) {
  const index = multiAnswer.value.indexOf(key)
  if (index >= 0) multiAnswer.value.splice(index, 1)
  else multiAnswer.value.push(key)
}

function submit() {
  if (props.readOnly) {
    visible.value = false
    return
  }
  if (!form.title.trim()) {
    ElMessage.error('题干不能为空')
    return
  }
  if (form.score <= 0) {
    ElMessage.error('分值必须大于 0')
    return
  }

  let answer = form.answer.trim()
  if (form.questionType === QuestionType.MULTIPLE) {
    if (multiAnswer.value.length < 2) {
      ElMessage.error('多选题参考答案至少需包含 2 个选项')
      return
    }
    answer = [...multiAnswer.value].sort().join(',')
  } else if (form.questionType === QuestionType.JUDGE) {
    answer = answer === '1' ? '1' : '0'
  }
  if (!answer) {
    ElMessage.error('请填写参考答案')
    return
  }

  emit('submit', {
    questionType: form.questionType,
    title: form.title,
    options: form.questionType === QuestionType.SHORT_ANSWER ? [] : form.options,
    answer,
    analysis: form.analysis || null,
    score: form.score,
    tagIds: form.tagIds,
  })
  visible.value = false
}
</script>

<template>
  <el-dialog
    v-model="visible"
    :title="readOnly ? '查看题目（已锁定，只读）' : initial ? '编辑题目' : '新增题目'"
    width="760px"
    top="6vh"
  >
    <el-alert
      v-if="readOnly"
      type="warning"
      :closable="false"
      class="mb16"
      title="该题目已被锁定试卷引用，内容不可修改"
      description="如需调整，请在试卷题目列表中使用「复制为新题」生成一道新题目。"
    />

    <el-form label-position="top">
      <el-form-item label="题型">
        <el-radio-group v-model="form.questionType" :disabled="readOnly">
          <el-radio-button
            v-for="option in QuestionTypeOptions"
            :key="option.value"
            :value="option.value"
          >
            {{ option.label }}
          </el-radio-button>
        </el-radio-group>
      </el-form-item>

      <el-form-item label="题干（纯文本，保留换行）">
        <el-input v-model="form.title" type="textarea" :rows="3" :disabled="readOnly" />
      </el-form-item>

      <el-form-item v-if="form.questionType !== QuestionType.SHORT_ANSWER" label="选项">
        <div class="option-editor">
          <div v-for="(option, index) in form.options" :key="option.key" class="option-row">
            <el-tag size="small">{{ option.key }}</el-tag>
            <el-input v-model="option.content" :disabled="readOnly" placeholder="选项内容" />
            <el-button
              v-if="!readOnly && form.questionType !== QuestionType.JUDGE"
              link
              type="danger"
              @click="removeOption(index)"
            >
              删除
            </el-button>
          </div>
          <el-button
            v-if="!readOnly && form.questionType !== QuestionType.JUDGE"
            size="small"
            @click="addOption"
          >
            添加选项
          </el-button>
        </div>
      </el-form-item>

      <el-form-item label="参考答案">
        <div v-if="form.questionType === QuestionType.SINGLE" class="answer-picker">
          <el-radio-group v-model="form.answer" :disabled="readOnly">
            <el-radio v-for="option in form.options" :key="option.key" :value="option.key">
              {{ option.key }}
            </el-radio>
          </el-radio-group>
        </div>
        <div v-else-if="form.questionType === QuestionType.MULTIPLE" class="answer-picker">
          <el-checkbox-group v-model="multiAnswer" :disabled="readOnly">
            <el-checkbox v-for="option in form.options" :key="option.key" :value="option.key">
              {{ option.key }}
            </el-checkbox>
          </el-checkbox-group>
          <div class="hint hint--offset">多选严格判分：全部选对才算正确，错选、漏选均判错</div>
        </div>
        <div v-else-if="form.questionType === QuestionType.JUDGE">
          <el-radio-group v-model="form.answer" :disabled="readOnly">
            <el-radio value="1">正确</el-radio>
            <el-radio value="0">错误</el-radio>
          </el-radio-group>
        </div>
        <el-input
          v-else
          v-model="form.answer"
          type="textarea"
          :rows="4"
          :disabled="readOnly"
          placeholder="简答题参考答案（交卷后供用户自评对照；v1 不自动判分）"
        />
      </el-form-item>

      <el-form-item label="人工解析（可选）">
        <el-input v-model="form.analysis" type="textarea" :rows="2" :disabled="readOnly" />
      </el-form-item>

      <el-row :gutter="16">
        <el-col :span="8">
          <el-form-item label="分值">
            <el-input-number v-model="form.score" :min="0.5" :step="0.5" :disabled="readOnly" />
          </el-form-item>
        </el-col>
        <el-col :span="16">
          <el-form-item label="考点标签（可多选）">
            <el-select
              v-model="form.tagIds"
              multiple
              filterable
              :disabled="readOnly"
              placeholder="选择考点标签"
              style="width: 100%"
            >
              <el-option
                v-for="tag in props.tags"
                :key="tag.id"
                :label="tag.tagName"
                :value="tag.id"
                :disabled="tag.isEnabled === 0"
              >
                <span>{{ tag.tagName }}</span>
                <span v-if="tag.isEnabled === 0" class="text-sub"> （已停用）</span>
              </el-option>
            </el-select>
          </el-form-item>
        </el-col>
      </el-row>

      <div class="rule-tip">
        标签不受题目锁定限制：即使题目已锁定，仍可调整考点标签（对应"错题权重重算、答题记录标签实时更新"规则）。
      </div>
    </el-form>

    <template #footer>
      <el-button text @click="visible = false">{{ readOnly ? '关闭' : '取消' }}</el-button>
      <el-button v-if="!readOnly" type="primary" @click="submit">保存</el-button>
    </template>
  </el-dialog>
</template>

<style scoped>
.option-editor {
  width: 100%;
}

.option-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}

.answer-picker {
  display: flex;
  align-items: center;
  gap: 16px;
}

/*
 * 这里原先把全局 `.hint` 整条重写了一遍（font-size:12px / color / margin-left），
 * 其中字号与字色与全局完全一致，只是多了「相对选项右移 12px」。
 * 重写基础载体名会让同一个 `.hint` 在不同文件里出现第二套定义（16 号 §6.4 要求提示块形态唯一），
 * 故收敛为只声明差异的修饰类；基础字号/字色/行高一律继承全局 `.hint`。
 */
.hint--offset {
  margin-left: 12px;
}
</style>
