<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { api, ApiError } from '@/api'
import { ApiCode } from '@/constants/apiCodes'
import { Copy } from '@/constants/copy'
import {
  DraftStatus,
  DraftStatusLabel,
  PaperTypeLabel,
  QuestionType,
  QuestionTypeLabel,
  QuestionTypeOptions,
} from '@/constants/enums'
import { useUserStore } from '@/stores/user'
import type { CategoryDetail, DraftDetail, DraftQuestionItem, QuestionOption, QuestionTag } from '@/types/models'
import QuestionFormDialog from '@/components/QuestionFormDialog.vue'
import NoPermissionBlock from '@/components/NoPermissionBlock.vue'

const route = useRoute()
const router = useRouter()
const userStore = useUserStore()

const draftId = Number(route.params.id)
const loading = ref(false)
const detail = ref<DraftDetail | null>(null)
/** S3 / S4：编辑页仅本人可进；他人或资源失效时原地提示（13 号 §9.2、§9.8） */
const blocked = ref<null | { title: string; desc: string; icon: string }>(null)
const allTags = ref<QuestionTag[]>([])
const categoryTags = ref<number[]>([])
const enableErrors = ref<string[]>([])

/* --------------------------- 题目表单 --------------------------- */
const dialogVisible = ref(false)
const editingQuestionId = ref<number | null>(null)
const dialogInitial = ref<{
  questionType: QuestionType
  title: string
  options: QuestionOption[]
  answer: string
  analysis?: string | null
  score: number
  tagIds: number[]
} | null>(null)
const dialogReadOnly = ref(false)

/* --------------------------- 题库引用 --------------------------- */
const bankVisible = ref(false)
const bankLoading = ref(false)
const bankKeyword = ref('')
const bankType = ref<number | null>(null)
const bankList = ref<Array<{ question: { id: number; title: string; questionType: number; score: number }; tagNames: string[]; usedByDraftCount: number; usedByExamCount: number; lockedDraftNames: string[] }>>([])
const bankSelected = ref<number[]>([])

const canEdit = computed(() => detail.value?.canEdit ?? false)
const categories = ref<CategoryDetail[]>([])

async function load() {
  loading.value = true
  blocked.value = null
  try {
    detail.value = await api.draft.detail(draftId, userStore.userId)
    /*
     * S3：编辑页仅「试卷创建者本人」可进（13 号 §5.1 资源所有者 / §9.8）。
     * 他人进入时此前会渲染出一个只读编辑器 —— 那等于把参考答案摊给外人看，
     * 这里改为原地无权限提示，把入口彻底关掉。
     */
    if (detail.value.draft.userId !== userStore.userId) {
      blocked.value = {
        title: Copy.noPermission,
        desc: '编辑页仅试卷创建者本人可进入；如需查看内容请走试卷详情页（他人预览不含参考答案与解析）。',
        icon: 'ph:lock-simple',
      }
      detail.value = null
      return
    }
    allTags.value = (await api.tag.list()).filter((t) => t.isEnabled === 1)
    const config = await api.category.tagConfig(detail.value.draft.categoryId)
    categoryTags.value = config.tagIds
    categories.value = await api.category.list()
    enableErrors.value = []
  } catch (e) {
    const code = e instanceof ApiError ? e.code : ApiCode.GENERIC
    const message = (e as Error).message
    if (code === ApiCode.NOT_FOUND) {
      blocked.value = { title: Copy.resourceDeleted, desc: message, icon: 'ph:file-dashed' }
    } else if (code === ApiCode.NO_PERMISSION) {
      blocked.value = { title: Copy.noPermission, desc: message, icon: 'ph:lock-simple' }
    } else {
      blocked.value = { title: Copy.resourceDeleted, desc: message, icon: 'ph:warning-circle' }
    }
  } finally {
    loading.value = false
  }
}

function openCreate() {
  editingQuestionId.value = null
  dialogInitial.value = null
  dialogReadOnly.value = false
  dialogVisible.value = true
}

function openEdit(item: DraftQuestionItem) {
  editingQuestionId.value = item.questionId
  dialogInitial.value = {
    questionType: item.question.questionType,
    title: item.question.title,
    options: item.question.options ? (JSON.parse(item.question.options) as QuestionOption[]) : [],
    answer: item.question.answer,
    analysis: item.question.analysis ?? null,
    score: item.score,
    tagIds: [...item.tagIds],
  }
  dialogReadOnly.value = item.question.isLocked === 1
  dialogVisible.value = true
}

async function submitQuestion(payload: {
  questionType: QuestionType
  title: string
  options: QuestionOption[]
  answer: string
  analysis: string | null
  score: number
  tagIds: number[]
}) {
  try {
    if (editingQuestionId.value) {
      await api.draft.updateQuestion(
        draftId,
        userStore.userId,
        editingQuestionId.value,
        payload,
        payload.score,
      )
      ElMessage.success('题目已更新')
    } else {
      await api.draft.createQuestion(draftId, userStore.userId, payload)
      ElMessage.success('题目已新增')
    }
    await load()
  } catch (e) {
    ElMessage({ type: 'error', message: (e as Error).message, duration: 6000, showClose: true })
  }
}

async function copyAsNew(item: DraftQuestionItem) {
  try {
    await ElMessageBox.confirm(
      '将以该题内容生成一道新题目并在本试卷中引用；原题目及其历史引用保持不变。是否继续？',
      '复制为新题',
      { type: 'info' },
    )
    await api.draft.copyAsNew(draftId, userStore.userId, item.questionId)
    ElMessage.success('已复制为新题，可自由修改')
    await load()
  } catch (e) {
    if (e !== 'cancel') ElMessage.error((e as Error).message)
  }
}

async function detach(item: DraftQuestionItem) {
  try {
    await ElMessageBox.confirm(`将第 ${item.sortNo} 题从本试卷移除（题目本身仍保留在题库中）。`, '移除题目', {
      type: 'warning',
    })
    await api.draft.detachQuestion(draftId, userStore.userId, item.relId)
    ElMessage.success('已移除')
    await load()
  } catch (e) {
    if (e !== 'cancel') ElMessage.error((e as Error).message)
  }
}

async function deleteQuestion(item: DraftQuestionItem) {
  try {
    await ElMessageBox.confirm(
      '将从题库中逻辑删除该题目。若题目已被锁定试卷或历史答题记录引用，系统会阻止删除。',
      '删除题目',
      { type: 'warning' },
    )
    await api.draft.deleteQuestion(userStore.userId, item.questionId)
    ElMessage.success('题目已删除')
    await load()
  } catch (e) {
    if (e !== 'cancel') {
      ElMessage({ type: 'error', message: (e as Error).message, duration: 7000, showClose: true })
    }
  }
}

async function move(item: DraftQuestionItem, delta: number) {
  try {
    await api.draft.moveQuestion(draftId, userStore.userId, item.relId, delta)
    await load()
  } catch (e) {
    ElMessage.error((e as Error).message)
  }
}

async function changeScore(item: DraftQuestionItem, value: number) {
  try {
    await api.draft.updateRelScore(draftId, userStore.userId, item.relId, value)
  } catch (e) {
    ElMessage.error((e as Error).message)
    await load()
  }
}

/** 「更多」下拉命令分发（与"我的试卷"页保持同一风格，避免模板内联三元链） */
function onQuestionMoreCommand(command: string, item: DraftQuestionItem) {
  switch (command) {
    case 'up':
      return void move(item, -1)
    case 'down':
      return void move(item, 1)
    case 'copy':
      return void copyAsNew(item)
    case 'detach':
      return void detach(item)
    case 'delete':
      return void deleteQuestion(item)
    default:
      return undefined
  }
}

async function enableDraft() {
  try {
    await ElMessageBox.confirm(
      '启用后试卷将【永久锁定】：不可再编辑，其题目内容与分值一并锁定。是否继续？',
      '启用试卷',
      { type: 'warning', confirmButtonText: '启用并锁定' },
    )
    const result = await api.draft.switchStatus(draftId, userStore.userId, DraftStatus.ENABLED)
    ElMessage.success(result.message)
    await load()
  } catch (e) {
    if (e === 'cancel') return
    const message = (e as Error).message
    enableErrors.value = message.split('\n')
    ElMessage({ type: 'error', message: '启用前置校验未通过，详见页面提示', duration: 4000 })
  }
}

async function disableDraft() {
  try {
    const result = await api.draft.switchStatus(draftId, userStore.userId, DraftStatus.DISABLED)
    ElMessage.success(result.message)
    await load()
  } catch (e) {
    ElMessage.error((e as Error).message)
  }
}

/* --------------------------- 题库引用逻辑 --------------------------- */
async function openBank() {
  bankVisible.value = true
  bankSelected.value = []
  await searchBank()
}

async function searchBank() {
  bankLoading.value = true
  try {
    bankList.value = await api.draft.questionBank({ keyword: bankKeyword.value, questionType: bankType.value })
  } finally {
    bankLoading.value = false
  }
}

async function attachSelected() {
  if (bankSelected.value.length === 0) {
    ElMessage.warning('请先选择要引用的题目')
    return
  }
  const existing = new Set((detail.value?.questions ?? []).map((q) => q.questionId))
  let ok = 0
  for (const questionId of bankSelected.value) {
    if (existing.has(questionId)) continue
    try {
      await api.draft.attachQuestion(draftId, userStore.userId, questionId)
      ok += 1
    } catch (e) {
      ElMessage.warning(`题目 #${questionId} 引用失败：${(e as Error).message}`)
    }
  }
  ElMessage.success(`已引用 ${ok} 道题目`)
  bankVisible.value = false
  await load()
}

const categoryTagNames = computed(() =>
  allTags.value.filter((t) => categoryTags.value.includes(t.id)).map((t) => t.tagName),
)

onMounted(load)
</script>

<template>
  <div v-loading="loading" class="page">
    <!-- S3 / S4：非本人或资源不可用时原地提示（URL 不变） -->
    <NoPermissionBlock
      v-if="blocked"
      :title="blocked.title"
      :desc="blocked.desc"
      :icon="blocked.icon"
    />
    <template v-else-if="detail">
      <div class="page-header">
        <div>
          <h2 class="page-title">编辑试卷：{{ detail.draft.draftName }}</h2>
          <p class="page-desc">
            {{ detail.category.categoryName }} · {{ PaperTypeLabel[detail.draft.paperType] }} ·
            {{ DraftStatusLabel[detail.draft.draftStatus] }} ·
            {{ detail.draft.isLocked === 1 ? '已锁定' : '未锁定' }} ·
            共 {{ detail.questions.length }} 题
          </p>
        </div>
      </div>

      <!-- ① 基础信息与状态 -->
      <div class="ql-panel">
        <div class="ql-panel__head">
          <span class="ql-panel__title">基础信息与状态</span>
          <div class="panel-actions">
            <el-button size="small" @click="router.push(`/drafts/${draftId}`)">预览</el-button>
            <el-button size="small" @click="router.push('/my-drafts')">返回列表</el-button>
            <el-button v-if="canEdit" size="small" type="primary" @click="enableDraft">启用试卷</el-button>
            <el-button
              v-else-if="detail.draft.draftStatus === DraftStatus.ENABLED"
              size="small"
              @click="disableDraft"
            >
              停用试卷
            </el-button>
          </div>
        </div>

        <div class="info-strip">
          <div class="info-strip__item">
            <span class="info-strip__label">试卷分类</span>
            <span class="info-strip__value">{{ detail.category.categoryName }}</span>
          </div>
          <div class="info-strip__item">
            <span class="info-strip__label">试卷类型</span>
            <span class="info-strip__value">{{ PaperTypeLabel[detail.draft.paperType] }}</span>
          </div>
          <div class="info-strip__item">
            <span class="info-strip__label">试卷状态</span>
            <el-tag
              :type="detail.draft.draftStatus === 1 ? 'success' : detail.draft.draftStatus === 2 ? 'info' : 'danger'"
              size="small"
              effect="light"
            >
              {{ DraftStatusLabel[detail.draft.draftStatus] }}
            </el-tag>
          </div>
          <div class="info-strip__item">
            <span class="info-strip__label">锁定状态</span>
            <el-tag v-if="detail.draft.isLocked === 1" type="warning" size="small" effect="light">已锁定</el-tag>
            <el-tag v-else type="info" size="small" effect="plain">未锁定</el-tag>
          </div>
          <div class="info-strip__item">
            <span class="info-strip__label">题目数量</span>
            <span class="info-strip__value">{{ detail.questions.length }} 题</span>
          </div>
          <div class="info-strip__item">
            <span class="info-strip__label">首次启用时间</span>
            <span class="info-strip__value">
              {{ detail.draft.enableTime ? new Date(detail.draft.enableTime).toLocaleString('zh-CN') : '—' }}
            </span>
          </div>
        </div>

        <el-alert
          v-if="!canEdit"
          type="warning"
          :closable="false"
          class="mt16"
          title="当前试卷不可编辑"
        >
          <div v-if="detail.draft.isLocked === 1">
            试卷已于首次启用时<b>永久锁定</b>。若需调整内容，请回到「我的试卷」使用<b>另存为</b>生成一份新的可编辑试卷。
          </div>
          <div v-else>仅「停用」状态的试卷可以编辑题目。</div>
        </el-alert>

        <el-alert
          v-if="enableErrors.length > 0"
          type="error"
          :closable="false"
          class="mt16"
          title="启用前置校验未通过"
        >
          <ul class="error-list">
            <li v-for="(err, index) in enableErrors" :key="index">{{ err }}</li>
          </ul>
        </el-alert>
      </div>

      <!-- ② 规则提示 -->
      <div class="ql-panel">
        <div class="ql-panel__head">
          <span class="ql-panel__title">规则提示</span>
          <span class="ql-panel__extra">锁定不可逆，启用前请确认题目与分值</span>
        </div>

        <div class="rule-tip">
          规则提示：题目一旦被<b>已锁定试卷</b>引用，即<b>继承锁定</b>，题干、选项、参考答案与解析不可修改；
          但<b>考点标签不受限制</b>，可随时调整。需要修改内容时使用「复制为新题」。
        </div>

        <div v-if="categoryTagNames.length > 0" class="whitelist">
          <span class="whitelist__label">本分类白名单标签</span>
          <div class="whitelist__tags">
            <el-tag v-for="name in categoryTagNames" :key="name" size="small" effect="plain">{{ name }}</el-tag>
          </div>
        </div>
      </div>

      <!-- ③ 题目表格 -->
      <div class="ql-panel table-panel">
        <div class="ql-panel__head">
          <span class="ql-panel__title">题目列表</span>
          <div class="panel-actions">
            <template v-if="canEdit">
              <el-button size="small" type="primary" @click="openCreate">新增题目</el-button>
              <el-button size="small" @click="openBank">从题库引用</el-button>
            </template>
            <span v-else class="text-tip">试卷已锁定，仅可预览题目</span>
          </div>
        </div>

        <el-table :data="detail.questions" row-key="relId" max-height="620">
          <el-table-column prop="sortNo" label="序号" width="80" align="center" />
          <el-table-column label="题型" width="90">
            <template #default="{ row }">
              {{ QuestionTypeLabel[row.question.questionType] }}
            </template>
          </el-table-column>
          <el-table-column label="题干" min-width="320">
            <template #default="{ row }">
              <div class="title-cell">{{ row.question.title }}</div>
              <div class="text-sub tag-line">
                <el-tag v-for="tag in row.tagNames" :key="tag" size="small" class="tag-gap">{{ tag }}</el-tag>
                <span v-if="row.tagNames.length === 0">未绑定标签</span>
              </div>
            </template>
          </el-table-column>
          <el-table-column label="本试卷分值" width="140" align="center">
            <template #default="{ row }">
              <el-input-number
                v-if="canEdit"
                :model-value="row.score"
                :min="0.5"
                :step="0.5"
                size="small"
                controls-position="right"
                style="width: 110px"
                @change="(value: number | undefined) => changeScore(row, value ?? 1)"
              />
              <span v-else>{{ row.score }}</span>
            </template>
          </el-table-column>
          <el-table-column label="状态" width="110" align="center">
            <template #default="{ row }">
              <el-tooltip
                v-if="row.question.isLocked === 1"
                content="该题目已被锁定试卷引用，内容只读"
                placement="top"
              >
                <el-tag type="warning" size="small" effect="light">已锁定</el-tag>
              </el-tooltip>
              <el-tag v-else type="success" size="small" effect="plain">可编辑</el-tag>
            </template>
          </el-table-column>
          <el-table-column label="操作" width="160" align="center" fixed="right">
            <template #default="{ row }">
              <div class="op-cell">
                <el-button
                  size="small"
                  :type="row.question.isLocked === 1 ? 'default' : 'primary'"
                  :plain="row.question.isLocked === 1"
                  @click="openEdit(row)"
                >
                  {{ row.question.isLocked === 1 ? '查看' : '编辑' }}
                </el-button>
                <el-dropdown
                  v-if="canEdit"
                  trigger="click"
                  class="more"
                  @command="(cmd: string) => onQuestionMoreCommand(cmd, row)"
                >
                  <el-button size="small" text class="more-btn">
                    更多<Icon icon="ph:caret-down" class="more-icon" />
                  </el-button>
                  <template #dropdown>
                    <el-dropdown-menu>
                      <el-dropdown-item command="up">上移</el-dropdown-item>
                      <el-dropdown-item command="down">下移</el-dropdown-item>
                      <el-dropdown-item command="copy" divided>复制为新题</el-dropdown-item>
                      <el-dropdown-item command="detach">移除</el-dropdown-item>
                      <el-dropdown-item command="delete" divided>删除</el-dropdown-item>
                    </el-dropdown-menu>
                  </template>
                </el-dropdown>
              </div>
            </template>
          </el-table-column>
          <template #empty>
            <div class="empty-hint">试卷还没有题目，先「新增题目」或「从题库引用」</div>
          </template>
        </el-table>
      </div>
    </template>

    <QuestionFormDialog
      v-model="dialogVisible"
      :tags="allTags"
      :initial="dialogInitial"
      :read-only="dialogReadOnly"
      @submit="submitQuestion"
    />

    <el-dialog v-model="bankVisible" title="从题库引用题目" width="900px" top="6vh">
      <div class="rule-tip mb16">
        题目可被<b>多份试卷共享引用</b>；引用的是同一道题，因此其内容锁定状态会跨试卷生效。
      </div>
      <div class="filter-bar">
        <el-input v-model="bankKeyword" placeholder="按题干搜索" style="width: 280px" clearable />
        <el-select v-model="bankType" placeholder="全部题型" clearable style="width: 140px">
          <el-option v-for="o in QuestionTypeOptions" :key="o.value" :label="o.label" :value="o.value" />
        </el-select>
        <el-button type="primary" @click="searchBank">查询</el-button>
      </div>
      <el-table
        v-loading="bankLoading"
        :data="bankList"
        border
        height="380"
        @selection-change="(rows: Array<{ question: { id: number } }>) => (bankSelected = rows.map((r) => r.question.id))"
      >
        <el-table-column type="selection" width="46" />
        <el-table-column label="题型" width="80">
          <template #default="{ row }">{{ QuestionTypeLabel[row.question.questionType] }}</template>
        </el-table-column>
        <el-table-column label="题干" min-width="320" show-overflow-tooltip>
          <template #default="{ row }">{{ row.question.title }}</template>
        </el-table-column>
        <el-table-column label="标签" width="200">
          <template #default="{ row }">
            <el-tag v-for="tag in row.tagNames" :key="tag" size="small" class="tag-gap">{{ tag }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="引用情况" width="180">
          <template #default="{ row }">
            <div class="text-sub">试卷 {{ row.usedByDraftCount }} · 答题记录 {{ row.usedByExamCount }}</div>
            <div v-if="row.lockedDraftNames.length > 0" class="text-sub">
              已锁定（{{ row.lockedDraftNames.length }} 份试卷）
            </div>
          </template>
        </el-table-column>
      </el-table>
      <template #footer>
        <el-button @click="bankVisible = false">取消</el-button>
        <el-button type="primary" @click="attachSelected">引用所选题目</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
/* 面板头部右侧操作区 */
.panel-actions {
  display: flex;
  align-items: center;
  gap: var(--ql-s1);
  flex-shrink: 0;
}

/* 基础信息的「扁平键值条」样式已下沉到 global.css §16（公共构件） */

/* 规则提示卡：分类白名单标签 */
.whitelist {
  display: flex;
  align-items: flex-start;
  gap: var(--ql-s2);
  margin-top: var(--ql-s2);
  padding-top: var(--ql-s2);
  border-top: 1px dashed var(--ql-border);
}

.whitelist__label {
  flex-shrink: 0;
  font-size: var(--ql-fs-small);
  color: var(--ql-muted);
  line-height: 24px;
}

.whitelist__tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

/* 题目表格卡：表格贴边，头部保留内边距 */
.table-panel {
  padding: 0;
  overflow: hidden;
}

.table-panel .ql-panel__head {
  padding: var(--ql-s2) var(--ql-s3);
  margin-bottom: 0;
}

.table-panel :deep(.el-table th.el-table__cell:first-child),
.table-panel :deep(.el-table td.el-table__cell:first-child) {
  padding-left: var(--ql-s3);
}

.table-panel :deep(.el-table th.el-table__cell:last-child),
.table-panel :deep(.el-table td.el-table__cell:last-child) {
  padding-right: var(--ql-s3);
}

.table-panel :deep(.el-table__empty-block) {
  min-height: 160px;
}

/* 题干单元格 */
.title-cell {
  white-space: pre-wrap;
  line-height: 1.7;
  color: var(--ql-title);
}

.tag-line {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 6px;
  font-size: var(--ql-fs-tip);
}

.tag-gap {
  margin-right: 0;
}

/* 操作列：主按钮 + 「更多」下拉菜单 */
.op-cell {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: var(--ql-s1);
}

.more-btn {
  color: var(--ql-text);
}

.more-btn:hover {
  color: var(--ql-primary);
}

.more-icon {
  margin-left: 2px;
  font-size: 12px;
}

.error-list {
  margin: 4px 0 0;
  padding-left: 18px;
  line-height: 1.8;
}
</style>
