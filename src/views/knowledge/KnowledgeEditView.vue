<script setup lang="ts">
/**
 * 知识点新建 / 编辑页 `/knowledge/:id/edit`（新建时 id 传 `new`）
 *
 * 依据《14、v1 plus.md》§4.3：
 *   - 新建/编辑复用同一页面；仅创建者本人可访问
 *   - 可见性：普通用户新建默认私有、管理员默认公开
 *   - 绑定考点标签（只能用全局已有标签，普通用户不能新建）
 *   - 关联题目：范围 = 本人全部底稿（含私有）+ 公开底稿；**不能选他人私有底稿里的题目**
 *   - 保存前提示：标题完全同名（公开）→ 二次确认；标题相近 → 仅列表提示，不阻止保存
 *   - 弹窗内不能新建知识点；搜不到时给跳转入口（这里就在编辑页，故不重复给）
 */
import { computed, onMounted, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { api, type KnowledgeQuestionItem } from '@/api'
import { Copy } from '@/constants/copy'
import { QuestionTypeLabel, Visibility } from '@/constants/enums'
import { useUserStore } from '@/stores/user'
import MarkdownViewer from '@/components/MarkdownViewer.vue'
import NoPermissionBlock from '@/components/NoPermissionBlock.vue'

const route = useRoute()
const router = useRouter()
const userStore = useUserStore()

/** 路由参数为 `new` 时是新建（14 号 §4.3「新建/编辑复用同一页面」） */
const isCreate = computed(() => route.params.id === 'new')
const knowledgeId = computed(() => (isCreate.value ? 0 : Number(route.params.id)))

const loading = ref(false)
const saving = ref(false)
const blocked = ref<null | { title: string; desc: string; icon: string }>(null)

const form = reactive({
  title: '',
  summary: '',
  content: '',
  visibility: Visibility.PRIVATE as Visibility,
  tagIds: [] as number[],
})
const allTags = ref<Array<{ id: number; tagName: string; isEnabled: number }>>([])
const linkedQuestions = ref<KnowledgeQuestionItem[]>([])
const similar = ref<Array<{ id: number; title: string }>>([])

/* --------------------------- 关联题目的选择 --------------------------- */
const pickerVisible = ref(false)
const pickerLoading = ref(false)
const pickerKeyword = ref('')
const pickerList = ref<KnowledgeQuestionItem[]>([])
const pickerSelected = ref<number[]>([])

async function load() {
  loading.value = true
  blocked.value = null
  try {
    allTags.value = (await api.tag.list()).filter((t) => t.isEnabled === 1)

    if (isCreate.value) {
      // 新建默认可见性按角色（普通用户私有、管理员公开）
      form.visibility = userStore.isAdmin ? Visibility.PUBLIC : Visibility.PRIVATE
      return
    }

    const detail = await api.knowledge.detail(knowledgeId.value, userStore.viewerId)
    if (!detail.canEdit) {
      blocked.value = {
        title: Copy.noPermission,
        desc: '知识点编辑页仅创建者本人可进入。',
        icon: 'ph:lock-simple',
      }
      return
    }
    form.title = detail.knowledge.title
    form.summary = detail.knowledge.summary ?? ''
    form.content = detail.knowledge.content
    form.visibility = detail.knowledge.visibility
    form.tagIds = [...detail.tagIds]
    linkedQuestions.value = [...detail.questions]
  } catch (e) {
    blocked.value = {
      title: Copy.resourceDeleted,
      desc: (e as Error).message,
      icon: 'ph:file-dashed',
    }
  } finally {
    loading.value = false
  }
}

/** 标题输入即给相近提示（仅提示，不阻止保存） */
async function onTitleBlur() {
  if (!form.title.trim() || form.visibility === Visibility.PRIVATE) {
    similar.value = []
    return
  }
  const result = await api.knowledge.checkTitle(form.title, isCreate.value ? undefined : knowledgeId.value)
  similar.value = result.similar
}

async function save() {
  if (!form.title.trim()) {
    ElMessage.error('请填写标题')
    return
  }
  if (!form.content.trim()) {
    ElMessage.error('请填写正文')
    return
  }
  saving.value = true
  try {
    // 保存为公开时：存在完全同名的公开知识点 → 二次确认（确认后仍可保存）
    if (form.visibility === Visibility.PUBLIC) {
      const check = await api.knowledge.checkTitle(
        form.title,
        isCreate.value ? undefined : knowledgeId.value,
      )
      if (check.exactDuplicate) {
        await ElMessageBox.confirm(
          `已存在标题完全相同的公开知识点「${form.title}」，继续保存会并存两篇。`,
          '标题重复',
          { confirmButtonText: '仍然保存', cancelButtonText: '返回修改', type: 'warning' },
        )
      }
    }

    const payload = {
      title: form.title,
      summary: form.summary,
      content: form.content,
      visibility: form.visibility,
      tagIds: [...form.tagIds],
      questionIds: linkedQuestions.value.map((q) => q.questionId),
    }
    if (isCreate.value) {
      const created = await api.knowledge.create(userStore.userId, payload)
      ElMessage.success('知识点已创建')
      void router.replace(`/knowledge/${created.id}`)
    } else {
      await api.knowledge.update(knowledgeId.value, userStore.userId, payload)
      ElMessage.success('已保存')
      void router.push(`/knowledge/${knowledgeId.value}`)
    }
  } catch (e) {
    if (e !== 'cancel') ElMessage.error((e as Error).message)
  } finally {
    saving.value = false
  }
}

/* ---------------------------- 关联题目弹窗 ---------------------------- */

async function openPicker() {
  pickerVisible.value = true
  pickerKeyword.value = ''
  pickerSelected.value = linkedQuestions.value.map((q) => q.questionId)
  await searchQuestions()
}

async function searchQuestions() {
  pickerLoading.value = true
  try {
    pickerList.value = await api.knowledge.searchQuestions(userStore.userId, pickerKeyword.value)
  } catch (e) {
    ElMessage.error((e as Error).message)
  } finally {
    pickerLoading.value = false
  }
}

function confirmPicker() {
  const byId = new Map(pickerList.value.map((q) => [q.questionId, q]))
  // 已选但当前搜索结果里没有的，需要保留原信息（避免换关键词后丢关联）
  linkedQuestions.value = pickerSelected.value.map(
    (id) => byId.get(id) ?? linkedQuestions.value.find((q) => q.questionId === id)!,
  )
  pickerVisible.value = false
}

function removeQuestion(questionId: number) {
  linkedQuestions.value = linkedQuestions.value.filter((q) => q.questionId !== questionId)
}

onMounted(load)
</script>

<template>
  <div v-loading="loading" class="page">
    <NoPermissionBlock
      v-if="blocked"
      :title="blocked.title"
      :desc="blocked.desc"
      :icon="blocked.icon"
    />

    <template v-else>
      <div class="page-header">
        <div>
          <h2 class="page-title">{{ isCreate ? '创建知识点' : '编辑知识点' }}</h2>
          <p class="page-desc">
            正文用 Markdown 写。公开后所有人可读，私有只有自己看得到；两种状态随时可切换。
          </p>
        </div>
        <div class="page-actions">
          <el-button @click="router.back()">返回</el-button>
          <el-button type="primary" :loading="saving" @click="save">保存</el-button>
        </div>
      </div>

      <div class="edit-layout">
        <!-- 左：表单 -->
        <section class="ql-panel">
          <el-form label-position="top">
            <el-form-item label="标题">
              <el-input
                v-model="form.title"
                placeholder="例如：子网划分与 CIDR 速查"
                maxlength="120"
                show-word-limit
                @blur="onTitleBlur"
              />
            </el-form-item>

            <!-- 主题相近的公开知识点：仅提示，不阻止保存（14 号 §4.3） -->
            <div v-if="similar.length > 0" class="rule-tip mb16">
              已有相近主题的公开知识点，动笔前可以先去扫一眼，别重复造轮子：
              <ul class="similar-list">
                <li v-for="item in similar" :key="item.id">
                  <router-link :to="`/knowledge/${item.id}`">{{ item.title }}</router-link>
                </li>
              </ul>
            </div>

            <el-form-item label="摘要">
              <el-input
                v-model="form.summary"
                type="textarea"
                :rows="2"
                maxlength="200"
                show-word-limit
                placeholder="一句话说清这篇讲什么，会显示在广场卡片上"
              />
            </el-form-item>

            <el-form-item label="可见性">
              <el-radio-group v-model="form.visibility">
                <el-radio :value="Visibility.PRIVATE">私有（只有自己可见）</el-radio>
                <el-radio :value="Visibility.PUBLIC">公开（所有人可读）</el-radio>
              </el-radio-group>
            </el-form-item>

            <el-form-item label="考点标签">
              <el-select
                v-model="form.tagIds"
                multiple
                filterable
                placeholder="只能选择系统已有的考点标签"
                style="width: 100%"
              >
                <el-option
                  v-for="tag in allTags"
                  :key="tag.id"
                  :label="tag.tagName"
                  :value="tag.id"
                />
              </el-select>
              <div class="hint">标签由管理员统一维护，普通用户不能新建标签。</div>
            </el-form-item>

            <el-form-item label="关联题目">
              <div class="linked-list">
                <div v-for="item in linkedQuestions" :key="item.questionId" class="linked-item">
                  <el-tag size="small" effect="plain">
                    {{ QuestionTypeLabel[item.questionType] }}
                  </el-tag>
                  <span class="linked-title">{{ item.title }}</span>
                  <el-button size="small" text type="danger" @click="removeQuestion(item.questionId)">
                    移除
                  </el-button>
                </div>
                <div v-if="linkedQuestions.length === 0" class="hint">还没有关联题目。</div>
              </div>
              <el-button class="mt8" @click="openPicker">选择题目</el-button>
              <div class="hint">
                可选范围：你全部试卷（含私有）+ 全部公开试卷中的题目；他人私有试卷里的题目不会出现。
              </div>
            </el-form-item>

            <el-form-item label="正文（Markdown）">
              <el-input
                v-model="form.content"
                type="textarea"
                :rows="16"
                placeholder="## 小标题&#10;&#10;正文段落，支持列表、表格、代码块、引用"
              />
            </el-form-item>
          </el-form>
        </section>

        <!-- 右：Markdown 渲染预览（复用全站唯一渲染组件） -->
        <aside class="ql-panel preview-panel">
          <div class="ql-panel__head">
            <span class="ql-panel__title">预览</span>
            <span class="ql-panel__extra">与详情页同一套渲染</span>
          </div>
          <MarkdownViewer v-if="form.content.trim()" :source="form.content" />
          <div v-else class="empty-hint">左侧写点什么，这里会实时渲染。</div>
        </aside>
      </div>
    </template>

    <!-- 关联题目选择弹窗：不提供新建知识的入口，也没有新建题目入口 -->
    <el-dialog v-model="pickerVisible" title="选择关联题目" width="720px">
      <div class="field-inline mb16">
        <el-input
          v-model="pickerKeyword"
          placeholder="按题目内容搜索"
          clearable
          @keyup.enter="searchQuestions"
        />
        <el-button type="primary" @click="searchQuestions">搜索</el-button>
      </div>
      <el-table v-loading="pickerLoading" :data="pickerList" height="360" row-key="questionId">
        <el-table-column width="52" align="center">
          <template #default="{ row }">
            <el-checkbox
              :model-value="pickerSelected.includes(row.questionId)"
              @change="(checked: boolean) => checked
                ? pickerSelected.push(row.questionId)
                : (pickerSelected = pickerSelected.filter((id) => id !== row.questionId))"
            />
          </template>
        </el-table-column>
        <el-table-column label="题型" width="80" align="center">
          <template #default="{ row }">
            <el-tag size="small" effect="plain">{{ QuestionTypeLabel[row.questionType] }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="title" label="题干" show-overflow-tooltip />
        <el-table-column label="所在试卷" width="180" show-overflow-tooltip>
          <template #default="{ row }">
            <span class="text-sub">{{ row.draftName ?? '（未挂试卷）' }}</span>
          </template>
        </el-table-column>
        <template #empty>
          <div class="empty-hint">没有搜到可关联的题目（已删除或其他人的私有题目不会出现）</div>
        </template>
      </el-table>
      <template #footer>
        <span class="text-tip">已选 {{ pickerSelected.length }} 道</span>
        <el-button @click="pickerVisible = false">取消</el-button>
        <el-button type="primary" @click="confirmPicker">确定</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
/* 表单 + 预览双栏：非对称（左宽右窄），窄于此宽度时纵向堆叠 */
.edit-layout {
  display: grid;
  grid-template-columns: minmax(0, 1.6fr) minmax(0, 1fr);
  gap: var(--ql-s2);
  align-items: start;
}

.preview-panel {
  position: sticky;
  top: var(--ql-s2);
  max-height: calc(100vh - 120px);
  overflow: auto;
}

.similar-list {
  margin: 6px 0 0;
  padding-left: 20px;
}

.linked-list {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.linked-item {
  display: flex;
  align-items: center;
  gap: var(--ql-s1);
  padding: 6px 10px;
  border: 1px solid var(--ql-border-light);
  border-radius: var(--ql-radius-sm);
  background: var(--ql-surface-soft);
}

.linked-title {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: var(--ql-fs-small);
  color: var(--ql-text);
}
</style>
