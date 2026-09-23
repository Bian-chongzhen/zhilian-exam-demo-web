<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { api, type QuestionKnowledgeLink } from '@/api'
import {
  FavoriteTargetType,
  MasterStatus,
  MasterStatusLabel,
  QuestionTypeLabel,
} from '@/constants/enums'
import { Copy } from '@/constants/copy'
import { useUserStore } from '@/stores/user'
import { usePagination } from '@/composables/usePagination'
import type { CategoryDetail, WrongDetailItem, WrongRecordItem } from '@/types/models'
import QuestionContent from '@/components/QuestionContent.vue'
import QuestionNotePanel from '@/components/QuestionNotePanel.vue'
import FavoriteButton from '@/components/FavoriteButton.vue'
import EmptyState from '@/components/EmptyState.vue'

const router = useRouter()
const userStore = useUserStore()

const loading = ref(false)
const activeTab = ref<'wrong' | 'mastered'>('wrong')
const records = ref<WrongRecordItem[]>([])
const categories = ref<CategoryDetail[]>([])
const counts = reactive({ wrongCount: 0, masteredCount: 0, totalWrongTimes: 0 })
const filter = reactive<{ categoryId: number | null; keyword: string }>({ categoryId: null, keyword: '' })

const detailVisible = ref(false)
const detailLoading = ref(false)
const detailList = ref<WrongDetailItem[]>([])
const detailRecord = ref<WrongRecordItem | null>(null)

const currentSet = computed(() =>
  activeTab.value === 'wrong' ? MasterStatus.WRONG_SET : MasterStatus.MASTERED_SET,
)

/** 错题卡片较高，每页 6 条，避免页面过长 */
const { currentPage, pageSize, total, pagedList, resetPage } = usePagination(records, 6)

/** 查询：回到第一页 */
function search() {
  resetPage()
  load()
}

/** v1-plus 模块1：题目 → 关联知识点（批量预取） */
const knowledgeLinks = ref<Record<number, QuestionKnowledgeLink[]>>({})

/** 切换集合：回到第一页 */
function onTabChange() {
  resetPage()
  load()
}

async function load() {
  loading.value = true
  try {
    records.value = await api.wrong.list(userStore.userId, {
      categoryId: filter.categoryId,
      isMaster: currentSet.value,
      keyword: filter.keyword,
    })
    Object.assign(counts, await api.wrong.counts(userStore.userId))
    // v1-plus 模块1：批量取「本题关联的知识点」，用于【查看关联知识点】入口
    knowledgeLinks.value = await api.knowledge.listByQuestions(
      records.value.map((r) => r.questionId),
      userStore.viewerId,
    )
  } catch (e) {
    ElMessage.error((e as Error).message)
  } finally {
    loading.value = false
  }
}

/**
 * 查看关联知识点（14 号 模块1「老页面增量改动」）
 * - 无关联：按钮置灰 + tooltip 说明原因（S1，不能只隐藏，否则用户不知道这道题本可以关联）
 * - 一条：直接跳详情
 * - 多条：跳到第一条（列表已按 id 稳定排序），避免在这里再堆一层选择弹窗
 */
function openKnowledge(row: WrongRecordItem) {
  const links = knowledgeLinks.value[row.questionId] ?? []
  if (links.length === 0) return
  void router.push(`/knowledge/${links[0].id}`)
}

async function openDetail(row: WrongRecordItem) {
  detailRecord.value = row
  detailVisible.value = true
  detailLoading.value = true
  try {
    detailList.value = await api.wrong.details(userStore.userId, row.recordId)
  } catch (e) {
    ElMessage.error((e as Error).message)
  } finally {
    detailLoading.value = false
  }
}

async function remove(row: WrongRecordItem) {
  try {
    await ElMessageBox.confirm(
      '删除该条记录后，若该题再次答错会重新生成记录，且错题次数将从 1 重新计算。是否继续？',
      '删除记录',
      { type: 'warning' },
    )
    await api.wrong.remove(userStore.userId, row.recordId)
    ElMessage.success('已删除')
    await load()
  } catch (e) {
    if (e !== 'cancel') ElMessage.error((e as Error).message)
  }
}

onMounted(async () => {
  categories.value = await api.category.list()
  await load()
})
</script>

<template>
  <div class="page">
    <div class="page-header">
      <div>
        <h2 class="page-title">错题与已掌握</h2>
        <p class="page-desc">
          记录维度为 <b>用户 + 题目 + 分类</b>：同一题在不同分类下分别计错题次数。
          重做答对 → 标记已掌握；已掌握再次答错 → 移回错题集且次数继续累加。
        </p>
      </div>
      <div class="page-actions">
        <el-button type="primary" @click="router.push('/compose')">用这些错题组卷</el-button>
      </div>
    </div>

    <el-tabs v-model="activeTab" class="set-tabs" @tab-change="onTabChange">
      <el-tab-pane :name="'wrong'">
        <template #label>
          <span>错题集合（{{ counts.wrongCount }}）</span>
        </template>
      </el-tab-pane>
      <el-tab-pane :name="'mastered'">
        <template #label>
          <span>已掌握集合（{{ counts.masteredCount }}）</span>
        </template>
      </el-tab-pane>
    </el-tabs>

    <div class="filter-bar">
      <el-select v-model="filter.categoryId" placeholder="全部分类" clearable style="width: 180px">
        <el-option v-for="c in categories" :key="c.id" :label="c.categoryName" :value="c.id" />
      </el-select>
      <el-input v-model="filter.keyword" placeholder="按题干搜索" style="width: 240px" clearable @keyup.enter="search" />
      <el-button type="primary" @click="search">查询</el-button>
      <div class="filter-bar__spacer"></div>
      <span class="text-tip">累计做错 {{ counts.totalWrongTimes }} 次（用于双重加权抽题）</span>
    </div>

    <div v-loading="loading" class="record-list">
      <div v-for="row in pagedList" :key="row.recordId" class="ql-panel record-card">
        <div class="record-head">
          <div class="record-index">
            <el-tag size="small" effect="plain">{{ QuestionTypeLabel[row.questionType] }}</el-tag>
            <el-tag size="small" type="info" effect="plain">{{ row.categoryName }}</el-tag>
            <el-tag size="small" type="danger" effect="plain">错 {{ row.wrongCount }} 次</el-tag>
            <el-tag size="small" :type="row.isMaster === 1 ? 'success' : 'warning'" effect="plain">
              {{ MasterStatusLabel[row.isMaster] }}
            </el-tag>
            <span class="text-tip">
              {{ row.isMaster === 1
                ? `掌握于 ${row.masterTime ? new Date(row.masterTime).toLocaleDateString('zh-CN') : '—'}`
                : `最近答错 ${row.lastWrongTime ? new Date(row.lastWrongTime).toLocaleString('zh-CN') : '—'}` }}
            </span>
          </div>
          <div class="record-head-right">
            <!--
              v1-plus 模块3：题目收藏入口
              刻意放在卡片右上角、与操作区分开：操作区已按约定收紧为「2 按钮 + 1 更多」，
              收藏属于「个人标记」而不是对记录的处置操作，混进操作列会破坏该约定。
            -->
            <FavoriteButton
              :target-type="FavoriteTargetType.QUESTION"
              :target-id="row.questionId"
              compact
            />
            <div class="record-actions">
              <el-button size="small" @click="openDetail(row)">
                作答历史（{{ row.detailCount }}）
              </el-button>
              <!--
                S1 置灰态：无关联知识点时按钮不可点，并用 tooltip 说明原因（13 号 §9.2 S1）
                —— 不能直接隐藏，否则用户无从知道「这道题本来可以关联知识点」
              -->
              <el-tooltip
                :content="Copy.noKnowledgeLinked"
                :disabled="(knowledgeLinks[row.questionId]?.length ?? 0) > 0"
                placement="top"
              >
                <span class="action-guard">
                  <el-button
                    size="small"
                    :disabled="(knowledgeLinks[row.questionId]?.length ?? 0) === 0"
                    @click="openKnowledge(row)"
                  >
                    查看关联知识点
                  </el-button>
                </span>
              </el-tooltip>
              <!-- 删除收进「更多」：新增入口后仍保持「≤2 按钮 + 1 更多」（14 号 §9.4） -->
              <el-dropdown trigger="click">
                <el-button size="small" text class="more-btn">
                  更多<Icon icon="ph:caret-down" class="more-icon" />
                </el-button>
                <template #dropdown>
                  <el-dropdown-menu>
                    <el-dropdown-item @click="remove(row)">删除记录</el-dropdown-item>
                  </el-dropdown-menu>
                </template>
              </el-dropdown>
            </div>
          </div>
        </div>

        <QuestionContent
          :title="row.title"
          :options="row.options"
          :question-type="row.questionType"
          :answer="row.answer"
          :score="0"
          :show-answer="true"
        />

        <div v-if="row.analysis" class="meta-block">
          <span class="meta-block__label">解析</span>{{ row.analysis }}
        </div>
        <div v-if="row.tagNames.length > 0" class="meta-block meta-block--tags">
          <span class="meta-block__label">考点</span>{{ row.tagNames.join(' / ') }}
        </div>

        <!-- v1-plus 模块2：题目私有笔记（错题页展开单条记录即可写笔记） -->
        <QuestionNotePanel :question-id="row.questionId" />
      </div>

      <div v-if="!loading && records.length === 0" class="ql-panel">
        <EmptyState
          icon="ph:stack"
          title="该集合暂无记录"
          desc="答错的题目会自动进入错题集；重做答对后移入已掌握。"
          action-text="去错题组卷"
          @action="router.push('/compose')"
        />
      </div>

      <!-- 分页常驻（有数据即显示） -->
      <div v-if="total > 0" class="ql-panel pager-panel">
        <el-pagination
          v-model:current-page="currentPage"
          v-model:page-size="pageSize"
          :page-sizes="[6, 12, 24]"
          :total="total"
          layout="total, sizes, prev, pager, next"
          background
        />
      </div>
    </div>

    <el-dialog v-model="detailVisible" title="错题作答历史" width="820px" top="8vh">
      <div class="rule-tip mb16">
        错题记录保存该题<b>每一次</b>作答的答题内容与判分结果，可追溯多次练习历史（对应设计文档 P0-5 的明细表）。
      </div>
      <div v-if="detailRecord" class="mb16 text-body">
        {{ detailRecord.title }}
      </div>
      <el-table v-loading="detailLoading" :data="detailList" size="small">
        <el-table-column label="时间" width="150">
          <template #default="{ row }">{{ new Date(row.answerTime).toLocaleString('zh-CN') }}</template>
        </el-table-column>
        <el-table-column label="来源答题记录" min-width="180" prop="examName" show-overflow-tooltip />
        <el-table-column label="我的作答" min-width="200">
          <template #default="{ row }">{{ row.userAnswer || '未作答' }}</template>
        </el-table-column>
        <el-table-column label="判分" width="90" align="center">
          <template #default="{ row }">
            <el-tag v-if="row.judgeResult === 1" type="success" size="small">正确</el-tag>
            <el-tag v-else-if="row.judgeResult === 0" type="danger" size="small">错误</el-tag>
            <el-tag v-else type="info" size="small">待判分</el-tag>
          </template>
        </el-table-column>
      </el-table>
    </el-dialog>
  </div>
</template>

<style scoped>
/* 集合切换页签：与筛选区间距统一 */
.set-tabs :deep(.el-tabs__header) {
  margin-bottom: var(--ql-s3);
}

.set-tabs :deep(.el-tabs__nav-wrap::after) {
  height: 1px;
  background: var(--ql-border);
}

/* 错题卡片列表：卡片之间固定 16px 间距 */
.record-list {
  display: flex;
  flex-direction: column;
  gap: var(--ql-s2);
  min-height: 160px;
}

.record-list > .ql-panel {
  margin-bottom: 0;
}

.record-card {
  transition: box-shadow var(--ql-dur-fast) var(--ql-ease-spring);
}

.record-card:hover {
  box-shadow: var(--ql-shadow-hover);
}

/* 卡片头部：标签行 + 右侧操作 */
.record-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--ql-s2);
  padding-bottom: var(--ql-s2);
  margin-bottom: var(--ql-s2);
  border-bottom: 1px dashed var(--ql-border);
}

.record-index {
  display: flex;
  align-items: center;
  gap: var(--ql-s1);
  flex-wrap: wrap;
}

.record-actions {
  display: flex;
  align-items: center;
  gap: var(--ql-s1);
  flex-shrink: 0;
}

/* 解析 / 考点：浅底信息块 */
.meta-block {
  display: flex;
  align-items: flex-start;
  gap: var(--ql-s1);
  margin-top: var(--ql-s2);
  padding: 10px var(--ql-s2);
  background: var(--ql-surface-soft);
  border: 1px solid var(--ql-border-light);
  border-radius: var(--ql-radius-sm);
  font-size: var(--ql-fs-small);
  line-height: 1.75;
  color: var(--ql-text);
}

.meta-block__label {
  flex-shrink: 0;
  padding: 1px 6px;
  border-radius: var(--ql-radius-sm);
  background: var(--ql-primary-soft);
  color: var(--ql-primary);
  font-size: var(--ql-fs-tip);
  font-weight: 500;
}

.meta-block--tags .meta-block__label {
  background: var(--ql-surface-sunken);
  color: var(--ql-muted);
}

/* 分页条：卡片列表下方独立面板，右对齐 */
.pager-panel {
  display: flex;
  justify-content: flex-end;
  padding: var(--ql-s2) var(--ql-s3);
}

/* v1-plus：禁用按钮的 tooltip 触发器需要能接收 hover（disabled 元素不派发事件） */
.action-guard {
  display: inline-flex;
}

/* v1-plus：卡片右上角（收藏 + 操作区） */
.record-head-right {
  display: flex;
  align-items: center;
  gap: var(--ql-s1);
  flex-shrink: 0;
}

.more-btn {
  color: var(--ql-text);
  padding: 0 4px;
}

.more-icon {
  margin-left: 2px;
  font-size: 12px;
}
</style>
