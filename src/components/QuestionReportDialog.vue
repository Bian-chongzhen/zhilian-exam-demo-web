<script setup lang="ts">
/**
 * 题目报错入口（v1-plus 模块4，全站收口）
 *
 * 依据 14 号 模块4 与 15 号 FB-U1 / FB-U2 / FB-05：
 *   - 出现在底稿预览页与答题回顾页，每道题一个【题目报错】按钮
 *   - 未登录：按钮置灰 + tooltip + 点击弹登录（复用 v0.5 的 GuestGuard）
 *   - 弹窗只收集文字描述；内容为空禁止提交（FB-05）
 *   - 题目已被删除：提交时服务层拒绝并提示「该题目已失效，不能提交反馈」（FB-U2）
 *   - 普通用户**不能直接改题**：工单只流转信息，管理员要改题仍走「复制为新题」流程
 */
import { ref } from 'vue'
import { ElMessage } from 'element-plus'
import { api, ApiError } from '@/api'
import { ApiCode } from '@/constants/apiCodes'
import { Copy } from '@/constants/copy'
import { useUserStore } from '@/stores/user'
import GuestGuard from '@/components/GuestGuard.vue'

const props = withDefaults(
  defineProps<{
    questionId: number
    questionTitle?: string
    /** 紧凑模式：只显示图标与短文案（回顾页题头空间有限） */
    compact?: boolean
  }>(),
  { questionTitle: '', compact: true },
)

const userStore = useUserStore()

const visible = ref(false)
const submitting = ref(false)
const description = ref('')

function open() {
  description.value = ''
  visible.value = true
}

async function submit() {
  if (!description.value.trim()) {
    ElMessage.error('请填写问题描述')
    return
  }
  submitting.value = true
  try {
    await api.feedback.submit(userStore.userId, props.questionId, description.value)
    visible.value = false
    ElMessage.success('反馈已提交，管理员处理后会更新状态')
  } catch (e) {
    const err = e as ApiError
    if (err instanceof ApiError && err.code === ApiCode.NOT_FOUND) {
      // FB-U2：题目已失效
      ElMessage.warning(Copy.reportQuestionGone)
    } else {
      ElMessage.error(err.message)
    }
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <GuestGuard>
    <el-button
      size="small"
      text
      :disabled="userStore.isGuest"
      class="report-btn"
      @click="open"
    >
      <Icon icon="ph:flag" class="report-icon" />
      {{ compact ? '题目报错' : '发现题目有误？点这里反馈' }}
    </el-button>
  </GuestGuard>

  <el-dialog v-model="visible" title="题目报错反馈" width="560px">
    <div class="rule-tip mb16">
      反馈只用来收集问题，<b>不会直接修改题目</b>。管理员核对后如需修正，会走「复制为新题」流程，
      原题与已锁定内容保持不变。
    </div>

    <div v-if="questionTitle" class="question-preview">
      <span class="question-preview__label">题目</span>
      <span class="question-preview__text">{{ questionTitle }}</span>
    </div>

    <el-form label-position="top">
      <el-form-item label="问题描述（必填）">
        <el-input
          v-model="description"
          type="textarea"
          :rows="4"
          maxlength="500"
          show-word-limit
          placeholder="例如：选项 C 与 D 表述重复；解析里的公式与结论不一致；参考答案应该是 B"
        />
      </el-form-item>
    </el-form>

    <template #footer>
      <el-button @click="visible = false">取消</el-button>
      <el-button type="primary" :loading="submitting" @click="submit">提交反馈</el-button>
    </template>
  </el-dialog>
</template>

<style scoped>
.report-btn {
  color: var(--ql-muted);
  padding: 0 4px;
}

.report-btn:hover {
  color: var(--ql-primary);
}

.report-icon {
  margin-right: 4px;
  font-size: 13px;
}

.question-preview {
  display: flex;
  align-items: flex-start;
  gap: var(--ql-s1);
  margin-bottom: var(--ql-s2);
  padding: 10px var(--ql-s2);
  background: var(--ql-surface-soft);
  border: 1px solid var(--ql-border-light);
  border-radius: var(--ql-radius-sm);
  font-size: var(--ql-fs-small);
  line-height: 1.7;
  color: var(--ql-text);
}

.question-preview__label {
  flex-shrink: 0;
  padding: 1px 6px;
  border-radius: var(--ql-radius-sm);
  background: var(--ql-primary-soft);
  color: var(--ql-on-primary-container);
  font-size: var(--ql-fs-tip);
}

.question-preview__text {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
</style>
