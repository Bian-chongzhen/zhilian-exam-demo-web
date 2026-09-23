<script setup lang="ts">
/**
 * 题目私有笔记面板（v1-plus 模块2）
 *
 * 嵌入位置（14 号 模块2）：答题回顾页每题下、错题&已掌握页展开的单条错题。
 * 依据 15 号 NT-01 ~ NT-06：
 *   - 未登录：**整块不渲染**（父级 v-if 控制，组件内也兜一层）
 *   - 一题一份笔记，编辑覆盖，不产生多条
 *   - 从未写过：面板可展开，编辑框为空，提示「暂无个人笔记」
 *   - 笔记完全私有：他人查看我的错题记录也看不到
 *   - 删除答题记录、题目被锁定/废弃：笔记保留（笔记独立成表，天然满足）
 */
import { ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { api } from '@/api'
import { Copy } from '@/constants/copy'
import { useUserStore } from '@/stores/user'
import MarkdownViewer from '@/components/MarkdownViewer.vue'
const props = withDefaults(
  defineProps<{
    questionId: number
    /**
     * 由父级批量预取的笔记内容（回顾页一屏多题时避免逐题请求）。
     * 传 undefined 表示由本组件自己按需拉取（错题页展开时才拉）。
     */
    initialContent?: string
    /** 折叠面板默认是否展开 */
    defaultOpen?: boolean
  }>(),
  { initialContent: undefined, defaultOpen: false },
)

const userStore = useUserStore()

const content = ref(props.initialContent ?? '')
const saved = ref(props.initialContent ?? '')
const loading = ref(false)
const saving = ref(false)
const previewing = ref(false)
/** 是否已经拉取过（避免每次展开都重复请求；空笔记也算「拉取过」） */
const loaded = ref(props.initialContent !== undefined)

/** 父级批量数据后到达时同步（回顾页先渲染再拿到数据） */
watch(
  () => props.initialContent,
  (value) => {
    if (value !== undefined) {
      content.value = value
      saved.value = value
      loaded.value = true
    }
  },
)

const dirty = () => content.value.trim() !== saved.value.trim()

async function ensureLoaded() {
  if (loaded.value) return
  loading.value = true
  try {
    const note = await api.note.get(userStore.userId, props.questionId)
    content.value = note ?? ''
    saved.value = note ?? ''
    loaded.value = true
  } catch (e) {
    ElMessage.error((e as Error).message)
  } finally {
    loading.value = false
  }
}

async function save() {
  saving.value = true
  try {
    await api.note.save(userStore.userId, props.questionId, content.value)
    saved.value = content.value.trim()
    content.value = saved.value
    ElMessage.success(saved.value ? '笔记已保存（只有你自己看得到）' : '笔记已清空')
  } catch (e) {
    ElMessage.error((e as Error).message)
  } finally {
    saving.value = false
  }
}

defineExpose({ ensureLoaded })
</script>

<template>
  <!-- NT-01：未登录整块不渲染 -->
  <el-collapse v-if="userStore.isLogin" class="note-panel" @change="ensureLoaded">
    <el-collapse-item name="note">
      <template #title>
        <span class="note-title">
          我的笔记
          <el-tag v-if="saved" size="small" type="success" effect="plain">已记录</el-tag>
          <span class="text-tip">只有你自己看得到</span>
        </span>
      </template>

      <div v-loading="loading">
        <div v-if="!saved && !content" class="hint mb8">{{ Copy.noteEmpty }}</div>
        <el-input
          v-model="content"
          type="textarea"
          :rows="3"
          placeholder="这道题错在哪、下次怎么避坑，用 Markdown 写下来"
        />
        <div class="note-actions">
          <el-button size="small" text @click="previewing = !previewing">
            {{ previewing ? '收起预览' : '预览 Markdown' }}
          </el-button>
          <div class="note-actions__right">
            <span v-if="dirty()" class="text-tip">有未保存的修改</span>
            <el-button size="small" type="primary" :loading="saving" @click="save">
              保存笔记
            </el-button>
          </div>
        </div>
        <div v-if="previewing && content.trim()" class="note-preview">
          <MarkdownViewer :source="content" compact />
        </div>
      </div>
    </el-collapse-item>
  </el-collapse>
</template>

<style scoped>
/* 折叠面板：无外框（扁平式），与 16 号 §9.3 的折叠面板规范一致 */
.note-panel {
  margin-top: var(--ql-s2);
  border-top: 1px dashed var(--ql-border);
  border-bottom: none;
}

.note-panel :deep(.el-collapse-item__header) {
  height: 40px;
  border-bottom: none;
  background: transparent;
}

.note-panel :deep(.el-collapse-item__wrap) {
  border-bottom: none;
}

.note-title {
  display: flex;
  align-items: center;
  gap: var(--ql-s1);
  font-size: var(--ql-fs-small);
  font-weight: 600;
  color: var(--ql-title);
}

.note-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--ql-s2);
  margin-top: var(--ql-s1);
}

.note-actions__right {
  display: flex;
  align-items: center;
  gap: var(--ql-s1);
}

.note-preview {
  margin-top: var(--ql-s1);
  padding: var(--ql-s2);
  border: 1px solid var(--ql-border-light);
  border-radius: var(--ql-radius-sm);
  background: var(--ql-surface-soft);
}
</style>
