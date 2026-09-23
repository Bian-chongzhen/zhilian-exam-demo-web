<script setup lang="ts">
/**
 * 反馈工单管理 `/admin/feedback`（v1-plus 模块4）
 *
 * 依据《14、v1 plus.md》模块4 与 15 号 FB-01 ~ FB-05：
 *   - 仅管理员可访问（守卫放过、外壳渲染无权限提示块）
 *   - 筛选：工单状态（待处理 / 已处理 / 忽略）+ 时间范围；分页常驻
 *   - 列表：提交用户、题目预览片段、反馈描述、状态、管理员备注
 *   - 管理员操作：修改状态 + 填写处理备注（Q5：已处理/忽略 时备注必填）
 *   - 题目已被删除的工单**仍然保留**，预览处标注「题目已删除」（FB-02）
 *   - **本页只流转信息，不会修改题库任何数据**；要改题请跳题库纠错 / 试卷编辑走原有流程（FB-03）
 */
import { computed, onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { api, type FeedbackItem } from '@/api'
import { FeedbackStatus, FeedbackStatusLabel, FeedbackStatusOptions } from '@/constants/enums'
import { usePagination } from '@/composables/usePagination'
import { useColumnSetting, type ColumnDef } from '@/composables/useColumnSetting'
import ColumnSetting from '@/components/ColumnSetting.vue'

const router = useRouter()

const loading = ref(false)
const rows = ref<FeedbackItem[]>([])
const pendingCount = ref(0)

const filter = reactive<{
  status: FeedbackStatus | 'all'
  dateRange: [string, string] | null
}>({
  status: 'all',
  dateRange: null,
})

const { currentPage, pageSize, total, pagedList, resetPage } = usePagination(rows, 10)

/* ------------------------------ 列表设置（列显隐） ------------------------------ */
/** 列定义：`key` 是持久化标识；「操作」列锁定不可隐藏 */
const columnDefs: ColumnDef[] = [
  { key: 'submitter', label: '提交用户' },
  { key: 'preview', label: '题目预览' },
  { key: 'description', label: '用户反馈' },
  { key: 'status', label: '状态' },
  { key: 'remark', label: '管理员备注' },
  { key: 'createTime', label: '提交时间' },
  { key: 'actions', label: '操作', locked: true },
]

const {
  visibleKeys,
  isVisible,
  toggle: toggleColumn,
  reset: resetColumns,
} = useColumnSetting('admin/feedback', columnDefs)

const statusOptions = computed(() => [
  { value: 'all' as const, label: '全部状态' },
  ...FeedbackStatusOptions,
])

/* ------------------------------ 失效行 ------------------------------ */

/**
 * 提交者已注销的工单行视觉弱化（16 号 C-5 / §6.5.3，不用整体 opacity）。
 * 注意「题目已删除」不参与弱化：那只是引用资源失效，工单本身仍待处理，
 * 预览列已有「题目已删除」标签（S4），整行弱化反而会降低待处理工单的可读性。
 */
function rowClassName({ row }: { row: FeedbackItem }): string {
  return row.submitterDeleted ? 'row-disabled' : ''
}

/* ------------------------------ 处理弹窗 ------------------------------ */
const dialogVisible = ref(false)
const current = ref<FeedbackItem | null>(null)
const form = reactive<{ status: FeedbackStatus; remark: string }>({
  status: FeedbackStatus.PENDING,
  remark: '',
})

async function load() {
  loading.value = true
  try {
    rows.value = await api.feedback.list({
      status: filter.status,
      startDate: filter.dateRange?.[0] ?? null,
      endDate: filter.dateRange?.[1] ?? null,
    })
    pendingCount.value = await api.feedback.pendingCount()
  } catch (e) {
    ElMessage.error((e as Error).message)
  } finally {
    loading.value = false
  }
}

/** 修改任一筛选条件都回到第 1 页 */
function applyFilter() {
  resetPage()
  load()
}

function resetFilter() {
  filter.status = 'all'
  filter.dateRange = null
  applyFilter()
}

function openHandle(row: FeedbackItem) {
  current.value = row
  form.status = row.status
  form.remark = row.adminRemark ?? ''
  dialogVisible.value = true
}

async function submitHandle() {
  const row = current.value
  if (!row) return
  // Q5：已处理 / 忽略 必须写备注（服务层同样会拒绝，这里先给出更快的反馈）
  const needRemark =
    form.status === FeedbackStatus.HANDLED || form.status === FeedbackStatus.IGNORED
  if (needRemark && !form.remark.trim()) {
    ElMessage.error('标记为「已处理 / 忽略」时必须填写处理备注')
    return
  }
  try {
    await api.feedback.handle(row.id, form.status, form.remark)
    dialogVisible.value = false
    ElMessage.success('工单已更新')
    await load()
  } catch (e) {
    ElMessage.error((e as Error).message)
  }
}

/** 跳去题库纠错（改题走原有流程，本页不改题库数据） */
function goFixQuestion(row: FeedbackItem) {
  void router.push({ path: '/admin/questions', query: { questionId: String(row.questionId) } })
}

function formatTime(value: string | null): string {
  return value ? new Date(value).toLocaleString('zh-CN') : '—'
}

onMounted(load)
</script>

<template>
  <div class="page">
    <div class="page-header">
      <div>
        <h2 class="page-title">反馈工单管理</h2>
        <p class="page-desc">
          用户提交的题目报错都在这儿。这里只<span class="text-title">流转信息</span>，
          不会改题库里的任何数据；要修题请点「去题库纠错」，走原来的复制为新题流程。
          <span v-if="pendingCount > 0" class="pending-hint">
            当前有 <b>{{ pendingCount }}</b> 条待处理。
          </span>
        </p>
      </div>
    </div>

    <!-- 筛选区 -->
    <div class="filter-bar">
      <el-select v-model="filter.status" style="width: 160px" @change="applyFilter">
        <el-option
          v-for="option in statusOptions"
          :key="String(option.value)"
          :label="option.label"
          :value="option.value"
        />
      </el-select>
      <el-date-picker
        v-model="filter.dateRange"
        type="daterange"
        range-separator="至"
        start-placeholder="提交起始日"
        end-placeholder="提交截止日"
        value-format="YYYY-MM-DD"
        style="width: 280px"
        @change="applyFilter"
      />
      <el-button text @click="resetFilter">重置</el-button>
      <div class="filter-bar__spacer"></div>
      <span class="text-tip">共 {{ total }} 条工单</span>
      <!-- 列表设置：每个用户可自选显示哪些列，设置按账号持久化在本机 -->
      <ColumnSetting
        :columns="columnDefs"
        :visible-keys="visibleKeys"
        @toggle="toggleColumn"
        @reset="resetColumns"
      />
    </div>

    <!-- 列表 -->
    <div class="ql-panel table-panel">
      <el-table v-loading="loading" :data="pagedList" row-key="id" :row-class-name="rowClassName">
        <!--
          列宽分配：信息列一律 min-width（弹性，按比例吸收容器剩余宽度），只有「操作」列用固定 width。
          若只剩一列是弹性的，它会独吞全部剩余宽度 —— 隐藏几列后就会出现「单列独宽」。
          短内容列（状态 / 提交时间）统一 align="center"，长文本列（反馈、备注）左对齐。
        -->
        <el-table-column v-if="isVisible('submitter')" label="提交用户" min-width="140">
          <template #default="{ row }">
            <div class="user-cell">
              <span class="user-name">{{ row.submitterName }}</span>
              <el-tag v-if="row.submitterDeleted" size="small" type="info" effect="plain">
                已注销
              </el-tag>
            </div>
          </template>
        </el-table-column>
        <el-table-column v-if="isVisible('preview')" label="题目预览" min-width="220">
          <template #default="{ row }">
            <!-- FB-02：题目已删除时工单仍在，只在预览处标注 -->
            <span v-if="row.questionPreview" class="preview-text">{{ row.questionPreview }}</span>
            <el-tag v-else size="small" type="info" effect="light">题目已删除</el-tag>
          </template>
        </el-table-column>
        <el-table-column v-if="isVisible('description')" label="用户反馈" min-width="280">
          <template #default="{ row }">
            <span class="desc-text">{{ row.description }}</span>
          </template>
        </el-table-column>
        <el-table-column
          v-if="isVisible('status')"
          label="状态"
          min-width="100"
          align="center"
        >
          <template #default="{ row }">
            <el-tag
              size="small"
              effect="light"
              :type="
                row.status === FeedbackStatus.PENDING
                  ? 'warning'
                  : row.status === FeedbackStatus.HANDLED
                    ? 'success'
                    : 'info'
              "
            >
              {{ FeedbackStatusLabel[row.status] }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column v-if="isVisible('remark')" label="管理员备注" min-width="200">
          <template #default="{ row }">
            <span v-if="row.adminRemark" class="remark-text">{{ row.adminRemark }}</span>
            <span v-else class="text-tip">—</span>
            <div v-if="row.handledByName" class="text-tip">
              由 {{ row.handledByName }} 处理于 {{ formatTime(row.handledTime) }}
            </div>
          </template>
        </el-table-column>
        <el-table-column
          v-if="isVisible('createTime')"
          label="提交时间"
          min-width="170"
          align="center"
        >
          <template #default="{ row }">
            <span class="mono-cell">{{ formatTime(row.createTime) }}</span>
          </template>
        </el-table-column>
        <el-table-column
          v-if="isVisible('actions')"
          label="操作"
          width="170"
          align="center"
          fixed="right"
        >
          <template #default="{ row }">
            <el-button size="small" text type="primary" @click="openHandle(row)">
              处理
            </el-button>
            <el-dropdown trigger="click">
              <el-button size="small" text class="more-btn">
                更多<Icon icon="ph:caret-down" class="more-icon" />
              </el-button>
              <template #dropdown>
                <el-dropdown-menu>
                  <el-dropdown-item
                    :disabled="!row.questionPreview"
                    @click="goFixQuestion(row)"
                  >
                    去题库纠错（走原有改题流程）
                  </el-dropdown-item>
                  <el-dropdown-item
                    v-if="row.draftId"
                    @click="router.push(`/drafts/${row.draftId}`)"
                  >
                    查看所在试卷
                  </el-dropdown-item>
                </el-dropdown-menu>
              </template>
            </el-dropdown>
          </template>
        </el-table-column>
        <template #empty>
          <div class="empty-hint">没有符合条件的工单，试试调整筛选条件</div>
        </template>
      </el-table>

      <!-- 分页常驻（有数据即显示） -->
      <div v-if="total > 0" class="table-pager">
        <el-pagination
          v-model:current-page="currentPage"
          v-model:page-size="pageSize"
          :page-sizes="[10, 20, 50]"
          :total="total"
          layout="total, sizes, prev, pager, next"
          background
        />
      </div>
    </div>

    <div class="rule-tip mt16">
      标记为「已处理 / 忽略」时<b>必须填写处理备注</b>；退回「待处理」会清掉处理痕迹。
      工单本身不修改题库数据 —— 需要修正题目时，请走题库纠错或试卷编辑的「复制为新题」流程，
      以遵守底稿与题目的锁定规则。
    </div>

    <!-- 处理弹窗 -->
    <el-dialog v-model="dialogVisible" title="处理工单" width="560px">
      <template v-if="current">
        <div class="handle-preview">
          <div class="handle-row">
            <span class="handle-label">题目</span>
            <span v-if="current.questionPreview">{{ current.questionPreview }}</span>
            <el-tag v-else size="small" type="info" effect="light">题目已删除</el-tag>
          </div>
          <div class="handle-row">
            <span class="handle-label">反馈</span>
            <span>{{ current.description }}</span>
          </div>
          <div class="handle-row">
            <span class="handle-label">提交人</span>
            <span>{{ current.submitterName }} · {{ formatTime(current.createTime) }}</span>
          </div>
        </div>

        <el-form label-position="top" class="mt16">
          <el-form-item label="工单状态">
            <el-radio-group v-model="form.status">
              <el-radio :value="FeedbackStatus.PENDING">待处理</el-radio>
              <el-radio :value="FeedbackStatus.HANDLED">已处理</el-radio>
              <el-radio :value="FeedbackStatus.IGNORED">忽略</el-radio>
            </el-radio-group>
          </el-form-item>
          <el-form-item label="处理备注">
            <el-input
              v-model="form.remark"
              type="textarea"
              :rows="3"
              maxlength="300"
              show-word-limit
              :placeholder="
                form.status === FeedbackStatus.PENDING
                  ? '退回待处理时备注可留空'
                  : '必填：写清核实结果与处理方式'
              "
            />
          </el-form-item>
        </el-form>
      </template>

      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="submitHandle">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.table-panel {
  padding: 0;
  overflow: hidden;
}

.pending-hint {
  margin-left: var(--ql-s1);
  color: var(--ql-warning);
}

.user-cell {
  display: flex;
  align-items: center;
  gap: 6px;
}

.user-name {
  font-weight: 500;
  color: var(--ql-title);
}

.preview-text,
.desc-text,
.remark-text {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  font-size: var(--ql-fs-small);
  line-height: 1.6;
  color: var(--ql-text);
}

.remark-text {
  color: var(--ql-title);
}

.mono-cell {
  font-variant-numeric: tabular-nums;
  color: var(--ql-text);
  font-size: var(--ql-fs-small);
}

.more-btn {
  color: var(--ql-text);
  padding: 0 4px;
}

.more-icon {
  margin-left: 2px;
  font-size: 12px;
}

.handle-preview {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: var(--ql-s2);
  background: var(--ql-surface-soft);
  border: 1px solid var(--ql-border-light);
  border-radius: var(--ql-radius-sm);
  font-size: var(--ql-fs-small);
  line-height: 1.7;
  color: var(--ql-text);
}

.handle-row {
  display: flex;
  align-items: flex-start;
  gap: var(--ql-s1);
}

.handle-label {
  flex-shrink: 0;
  width: 48px;
  color: var(--ql-muted);
}
</style>
