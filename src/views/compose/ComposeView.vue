<script setup lang="ts">
import { computed, nextTick, onMounted, reactive, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { api, type KnowledgeListItem } from '@/api'
import { Copy } from '@/constants/copy'
import {
  ComposeScope,
  ComposeScopeOptions,
  ComposeStrategy,
  ComposeStrategyOptions,
  MASTERED_SCOPE_FACTOR,
  PaperType,
  PaperTypeOptions,
  QuestionTypeLabel,
  TagMatchMode,
  TagMatchModeOptions,
  Visibility,
} from '@/constants/enums'
import { useUserStore } from '@/stores/user'
import type { CategoryDetail, ComposePreview, QuestionTag } from '@/types/models'

const router = useRouter()
const userStore = useUserStore()

const categories = ref<CategoryDetail[]>([])
const tags = ref<QuestionTag[]>([])
const preview = ref<ComposePreview | null>(null)
/** 预览区锚点：点击预览后滚动定位 */
const previewRef = ref<HTMLElement | null>(null)
const previewing = ref(false)
const generating = ref(false)

/* ---------- v1-plus 模块1：组卷成功弹窗（含推荐复习知识点） ---------- */
const successVisible = ref(false)
const successInfo = ref<null | {
  draftId: number
  draftName: string
  pickedCount: number
  enabled: boolean
  warnings: string[]
}>(null)
/** 按本次分类 + 标签匹配到的公开知识点；可能为空（此时给固定文案，不阻断弹窗） */
const successKnowledge = ref<KnowledgeListItem[]>([])

const form = reactive({
  categoryId: null as number | null,
  paperType: null as number | null,
  tagIds: [] as number[],
  matchMode: TagMatchMode.ANY as number,
  scope: ComposeScope.WRONG_ONLY as number,
  strategy: ComposeStrategy.WEIGHT as number,
  targetCount: 0,
  draftName: '',
  visibility: Visibility.PRIVATE as number,
  startImmediately: true,
})

/** 标签选项仅限当前分类白名单（PRD 四.5） */
const availableTags = computed(() => {
  if (!form.categoryId) return []
  const config = categories.value.find((c) => c.id === form.categoryId)
  if (!config) return []
  return tags.value.filter((t) => config.tagIds.includes(t.id))
})

const selectedCategory = computed(() =>
  categories.value.find((c) => c.id === form.categoryId) ?? null,
)

const weightMap = computed(() => {
  const map = new Map<number, number>()
  selectedCategory.value?.weights.forEach((w) => map.set(w.tagId, w.weight))
  return map
})

function weightText(tagId: number): string {
  const weight = weightMap.value.get(tagId)
  return weight === undefined ? '未配置（按均权 1.00）' : `${weight.toFixed(2)}`
}

watch(
  () => form.categoryId,
  async (value) => {
    preview.value = null
    form.tagIds = []
    if (!value) return
    form.targetCount = selectedCategory.value?.fixedQuestionCount ?? 0
    form.draftName = await api.compose.suggestName(userStore.userId, value)
  },
)

async function doPreview() {
  if (!form.categoryId) {
    ElMessage.warning('请先选择试卷分类')
    return
  }
  previewing.value = true
  try {
    preview.value = await api.compose.preview(userStore.userId, {
      ...form,
      categoryId: form.categoryId,
      paperType: (form.paperType ?? 0) as PaperType,
      visibility: form.visibility as Visibility,
    })
    // 扁平版式下预览区在表单下方，预览后自动滚动到结果，避免用户手动找
    await nextTick()
    previewRef.value?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  } catch (e) {
    ElMessage.error((e as Error).message)
  } finally {
    previewing.value = false
  }
}

async function doGenerate() {
  if (!form.categoryId) {
    ElMessage.warning('请先选择试卷分类')
    return
  }
  if (!form.paperType) {
    ElMessage.warning('请手动选择试卷类型：竞技型 / 练习型（无默认值）')
    return
  }
  generating.value = true
  try {
    const params = {
      ...form,
      categoryId: form.categoryId,
      paperType: form.paperType as PaperType,
      visibility: form.visibility as Visibility,
    }
    const result = form.startImmediately
      ? await api.compose.generateAndEnable(userStore.userId, params)
      : await api.compose.generate(userStore.userId, params)

    // v1-plus 模块1：组卷成功后推荐配套复习知识点
    // 匹配口径 = 本次选中的分类 + 考点标签；无匹配时给固定文案，**不阻断弹窗**（15 号 CL-02）
    let recommended: KnowledgeListItem[] = []
    try {
      const candidates = await api.knowledge.listPublic({
        categoryId: form.categoryId,
        tagIds: [...form.tagIds],
        sort: 'updated',
      })
      recommended = candidates.slice(0, 5)
    } catch {
      // 推荐失败不应影响组卷结果展示
      recommended = []
    }

    successInfo.value = {
      draftId: result.draft.id,
      draftName: result.draft.draftName,
      pickedCount: result.picked.length,
      enabled: form.startImmediately,
      warnings: result.warnings ?? [],
    }
    successKnowledge.value = recommended
    successVisible.value = true
  } catch (e) {
    ElMessage({ type: 'error', message: (e as Error).message, duration: 6000, showClose: true })
  } finally {
    generating.value = false
  }
}

/** 组卷成功弹窗的两个出口 */
async function goAnswer() {
  const info = successInfo.value
  if (!info) return
  successVisible.value = false
  const exam = await api.exam.start(userStore.userId, info.draftId)
  router.push(`/exam/${exam.id}`)
}

function goEditDraft() {
  const info = successInfo.value
  if (!info) return
  successVisible.value = false
  router.push(`/drafts/${info.draftId}/edit`)
}

function selectAllTags() {
  form.tagIds = availableTags.value.map((t) => t.id)
}

function clearTags() {
  form.tagIds = []
}

onMounted(async () => {
  categories.value = await api.category.list()
  tags.value = (await api.tag.list()).filter((t) => t.isEnabled === 1)
})
</script>

<template>
  <div class="page page--column">
    <div class="page-header">
      <div>
        <h2 class="page-title">错题组卷</h2>
        <p class="page-desc">
          抽题概率 = 分类考点分值占比 × 个人错题次数（双重加权）。
          已掌握题目参与混合抽取时权重按 {{ MASTERED_SCOPE_FACTOR }} 折减。
        </p>
      </div>
    </div>

    <!-- 扁平版式：不使用卡片外框，内容直接铺在页面底色上，用分割线分段 -->
    <section class="flat-section">
      <div class="flat-section__head">
        <h3 class="flat-section__title">组卷条件</h3>
        <span class="flat-section__extra">考点标签仅限当前分类白名单</span>
      </div>

      <!-- 用 CSS Grid 排列字段：所有字段都是 el-form 的直接子元素，
           避免 el-col 内边距造成标签错位；列间距 32px 保证两列之间有呼吸感 -->
      <el-form label-position="left" label-width="88px" class="compose-form">
        <el-form-item label="试卷分类" class="f-6">
          <el-select v-model="form.categoryId" placeholder="请选择分类" style="width: 100%">
            <el-option v-for="c in categories" :key="c.id" :label="c.categoryName" :value="c.id" />
          </el-select>
          <div v-if="selectedCategory" class="hint">
            固定题量 {{ selectedCategory.fixedQuestionCount }} 题 · 包含
            {{ selectedCategory.tagIds.length }} 个考点
          </div>
        </el-form-item>

        <el-form-item label="试卷类型" class="f-6">
          <div class="field-inline">
            <el-radio-group v-model="form.paperType">
              <el-radio-button v-for="o in PaperTypeOptions" :key="o.value" :value="o.value">
                {{ o.label }}
              </el-radio-button>
            </el-radio-group>
            <span v-if="!form.paperType" class="hint warn inline">不自动默认，必须手动选择</span>
          </div>
        </el-form-item>

        <el-form-item label="考点标签" class="f-12">
          <div class="field-inline">
            <el-select v-model="form.tagIds" multiple filterable collapse-tags collapse-tags-tooltip
              placeholder="不选则按分类考点分值占比加权抽题" class="tag-select" :disabled="!form.categoryId">
              <el-option v-for="tag in availableTags" :key="tag.id" :label="tag.tagName" :value="tag.id">
                <span>{{ tag.tagName }}</span>
                <span class="text-sub"> · 权重 {{ weightText(tag.id) }}</span>
              </el-option>
            </el-select>
            <el-button size="small" link type="primary" @click="selectAllTags">全选</el-button>
            <el-button size="small" link @click="clearTags">清空</el-button>
          </div>
          <div class="hint">仅限当前分类包含的考点；不选标签时按分类考点分值占比加权抽题</div>
        </el-form-item>

        <el-form-item label="匹配模式" class="f-6">
          <el-radio-group v-model="form.matchMode">
            <el-radio-button v-for="o in TagMatchModeOptions" :key="o.value" :value="o.value">
              {{ o.label }}
            </el-radio-button>
          </el-radio-group>
        </el-form-item>

        <el-form-item label="题目来源" class="f-6">
          <el-radio-group v-model="form.scope">
            <el-radio-button v-for="o in ComposeScopeOptions" :key="o.value" :value="o.value">
              {{ o.label }}
            </el-radio-button>
          </el-radio-group>
        </el-form-item>

        <el-form-item label="抽取策略" class="f-12">
          <el-radio-group v-model="form.strategy">
            <el-radio-button v-for="o in ComposeStrategyOptions" :key="o.value" :value="o.value">
              {{ o.label }}
            </el-radio-button>
          </el-radio-group>
        </el-form-item>

        <el-form-item label="目标题量" class="f-4">
          <el-input-number v-model="form.targetCount" :min="1" :max="200" style="width: 160px" />
        </el-form-item>

        <el-form-item label="可见性" class="f-4">
          <el-radio-group v-model="form.visibility">
            <el-radio :value="Visibility.PRIVATE">私有</el-radio>
            <el-radio :value="Visibility.PUBLIC">公开</el-radio>
          </el-radio-group>
        </el-form-item>

        <el-form-item label="试卷名称" class="f-4">
          <el-input v-model="form.draftName" />
        </el-form-item>

        <el-form-item label="生成设置" class="f-12">
          <div class="field-inline">
            <el-switch v-model="form.startImmediately" />
            <span class="text-body">生成后立即启用并开始答题</span>
          </div>
          <div class="hint">
            启用会触发<b>永久锁定</b>；关闭则生成一份停用未锁定的试卷，可先调整题目
          </div>
        </el-form-item>

        <div class="actions">
          <el-button :loading="previewing" @click="doPreview">预览候选题目</el-button>
          <el-button type="primary" :loading="generating" @click="doGenerate">生成错题试卷</el-button>
          <span class="hint inline-hint">目标题量默认取分类固定题量；可抽数量不足时按实际数量生成</span>
        </div>
      </el-form>
    </section>

    <section ref="previewRef" class="flat-section">
      <div class="flat-section__head">
        <h3 class="flat-section__title">候选与权重预览</h3>
        <span class="flat-section__extra">按抽样权重由高到低参考候选集合</span>
      </div>

      <div v-if="preview" class="preview-meta">
        <span class="preview-meta__item">
          目标题量 <b>{{ preview.targetCount }}</b> 题
        </span>
        <span class="preview-meta__item">
          可抽数量 <b>{{ preview.availableCount }}</b> 题
        </span>
        <span class="preview-meta__item text-tip">{{ preview.categoryName }}</span>
      </div>

      <el-alert v-for="(warning, index) in preview?.warnings ?? []" :key="index" type="warning" :closable="false"
        class="mb8" :title="warning" />

      <el-table v-if="preview" :data="preview.candidates" max-height="520" size="small" class="preview-table">
        <el-table-column label="#" type="index" width="50" align="center" />
        <el-table-column label="题型" width="70">
          <template #default="{ row }">{{ QuestionTypeLabel[row.questionType] }}</template>
        </el-table-column>
        <el-table-column label="题干" min-width="240" show-overflow-tooltip>
          <template #default="{ row }">{{ row.title }}</template>
        </el-table-column>
        <el-table-column label="集合" width="90" align="center">
          <template #default="{ row }">
            <el-tag size="small" :type="row.isMaster === 1 ? 'success' : 'danger'" effect="plain">
              {{ row.isMaster === 1 ? '已掌握' : '错题' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="错题次数" width="90" align="center" prop="wrongCount" />
        <el-table-column label="抽样权重" width="100" align="center">
          <template #default="{ row }">
            <span class="weight-text">{{ row.weight }}</span>
          </template>
        </el-table-column>
        <el-table-column label="最近答错" width="120">
          <template #default="{ row }">
            {{ row.lastWrongTime ? new Date(row.lastWrongTime).toLocaleDateString('zh-CN') : '—' }}
          </template>
        </el-table-column>
      </el-table>

      <div v-else class="empty-hint">点击「预览候选题目」查看加权抽题的候选集与权重</div>
    </section>

    <!-- v1-plus 模块1：组卷成功弹窗 + 配套复习知识点推荐（14 号 模块1「老页面增量改动」） -->
    <el-dialog v-model="successVisible" title="错题试卷已生成" width="620px">
      <template v-if="successInfo">
        <p class="success-line">
          已生成《<b>{{ successInfo.draftName }}</b>》，共 <b>{{ successInfo.pickedCount }}</b> 题{{
            successInfo.enabled ? '，并已启用锁定（启用后内容永久只读）' : '（停用状态，可继续调整后再启用）'
          }}。
        </p>

        <el-alert
          v-for="(warning, index) in successInfo.warnings"
          :key="index"
          type="warning"
          :closable="false"
          show-icon
          class="mb8"
          :title="warning"
        />

        <div class="ql-panel__head recommended-head">
          <span class="ql-panel__title">配套复习知识点</span>
          <span class="ql-panel__extra">按本次分类与考点标签匹配的公开知识点</span>
        </div>
        <div v-if="successKnowledge.length > 0" class="recommended-list">
          <button
            v-for="item in successKnowledge"
            :key="item.id"
            type="button"
            class="recommended-item"
            @click="successVisible = false; router.push(`/knowledge/${item.id}`)"
          >
            <span class="recommended-title">{{ item.title }}</span>
            <span v-if="item.tagNames.length > 0" class="text-tip">
              {{ item.tagNames.join('、') }}
            </span>
          </button>
        </div>
        <!-- 15 号 CL-02：无匹配时只提示，不报错、不阻断弹窗 -->
        <div v-else class="empty-hint">{{ Copy.composeNoKnowledge }}</div>
      </template>

      <template #footer>
        <el-button @click="successVisible = false">先不处理</el-button>
        <el-button @click="goEditDraft">去编辑试卷</el-button>
        <el-button type="primary" @click="goAnswer">开始答题</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
/* v1-plus：组卷成功弹窗 */
.success-line {
  margin: 0 0 var(--ql-s2);
  font-size: var(--ql-fs-body);
  line-height: 1.7;
  color: var(--ql-text);
}

.recommended-head {
  margin-top: var(--ql-s2);
}

.recommended-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.recommended-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--ql-s2);
  width: 100%;
  padding: 8px 12px;
  border: 1px solid var(--ql-border-light);
  border-radius: var(--ql-radius-sm);
  background: var(--ql-surface);
  text-align: left;
  cursor: pointer;
  transition: border-color var(--ql-dur-fast) var(--ql-ease-spring),
    background var(--ql-dur-fast) var(--ql-ease-spring);
}

.recommended-item:hover {
  border-color: var(--ql-primary-line);
  background: var(--ql-primary-soft);
}

.recommended-title {
  font-size: var(--ql-fs-small);
  font-weight: 500;
  color: var(--ql-title);
}
/*
 * 字段栅格：12 列 CSS Grid
 * - 所有 el-form-item 都是 grid 的直接子项 → 标签起始位置严格对齐
 * - 列间距 32px：避免左侧控件与右侧标签挤在一起
 */
.compose-form {
  display: grid;
  grid-template-columns: repeat(12, minmax(0, 1fr));
  column-gap: var(--ql-s4);
  /*
   * 顶部对齐（不用 center）：同一行两个字段的高度经常不等
   * （如「试卷分类」多一行固定题量提示、「试卷类型」只有一行），
   * center 会把较矮的那一项整体下移约 12px，两个标签就不在同一条水平线上。
   */
  align-items: start;
}

.compose-form>.el-form-item {
  margin-bottom: var(--ql-s2);
}

.f-4 {
  grid-column: span 4;
}

.f-6 {
  grid-column: span 6;
}

.f-12 {
  grid-column: span 12;
}

/* 横向表单：标签在左、控件在右 */
.compose-form :deep(.el-form-item__label) {
  font-size: var(--ql-fs-body);
  font-weight: 500;
  line-height: 1.6;
  color: var(--ql-title);
  justify-content: flex-end;
  /* 标签与控件垂直居中 */
  align-items: center;
  display: flex;
}

.compose-form :deep(.el-form-item__content) {
  display: block;
  line-height: 1.6;
}

/* 行内控件组：单选按钮、按钮在同一行，垂直居中 */
.field-inline {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

/* 考点标签下拉：取消固定宽度，自适应 */
.tag-select {
  flex: 1;
  min-width: 300px;
}

.hint.inline {
  margin-top: 0;
  white-space: nowrap;
}

/* 操作行：按钮与说明同一行，省掉一整行高度 */
.actions {
  grid-column: 1 / -1;
  display: flex;
  align-items: center;
  gap: var(--ql-s1);
  padding-top: var(--ql-s2);
  border-top: 1px solid var(--ql-border-light);
}

.inline-hint {
  margin-left: var(--ql-s2);
}

/* 预览区：目标题量 / 可抽数量摘要条 */
.preview-meta {
  display: flex;
  align-items: center;
  gap: var(--ql-s3);
  padding: 10px var(--ql-s2);
  margin-bottom: var(--ql-s2);
  background: var(--ql-surface-soft);
  border: 1px solid var(--ql-border-light);
  border-radius: var(--ql-radius-sm);
  font-size: var(--ql-fs-small);
  color: var(--ql-text);
}

.preview-meta__item {
  display: inline-flex;
  align-items: baseline;
  gap: 4px;
}

.preview-meta b {
  font-size: var(--ql-fs-section);
  font-weight: 600;
  color: var(--ql-primary);
  font-variant-numeric: tabular-nums;
}

.preview-table {
  width: 100%;
}

.weight-text {
  font-weight: 600;
  color: var(--ql-title);
  font-variant-numeric: tabular-nums;
}
</style>