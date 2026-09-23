<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { api } from '@/api'
import { ExamSourceTypeLabel, PaperTypeLabel } from '@/constants/enums'
import { useUserStore } from '@/stores/user'
import { usePagination } from '@/composables/usePagination'
import type { ExamListItem } from '@/types/models'
import { formatAccuracy } from '@/mock/rules/stat'

const router = useRouter()
const userStore = useUserStore()

const loading = ref(false)
const records = ref<ExamListItem[]>([])

/** 每页 10 条，避免记录多时页面过长 */
const { currentPage, pageSize, total, pagedList } = usePagination(records)

/** 顶部概览：仅对已有记录做聚合展示 */
const summary = computed(() => {
  const submitted = records.value.filter((r) => !!r.submitTime)
  const judged = submitted.reduce((sum, r) => sum + r.rightCount + r.wrongCount, 0)
  const right = submitted.reduce((sum, r) => sum + r.rightCount, 0)
  return {
    total: records.value.length,
    submitted: submitted.length,
    unfinished: records.value.length - submitted.length,
    accuracy: judged > 0 ? right / judged : null,
  }
})

async function load() {
  loading.value = true
  try {
    records.value = await api.exam.listMine(userStore.userId)
  } catch (e) {
    ElMessage.error((e as Error).message)
  } finally {
    loading.value = false
  }
}

function accuracyOf(row: ExamListItem): number | null {
  const judged = row.rightCount + row.wrongCount
  return judged > 0 ? row.rightCount / judged : null
}

/** 时间紧凑格式，避免时间列过宽 */
function shortTime(value: string | null | undefined): string {
  if (!value) return '—'
  const d = new Date(value)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

async function remove(row: ExamListItem) {
  try {
    await ElMessageBox.confirm(
      '删除后该答题记录不再计入准确率统计（统计会实时重算）；但错题集与错题明细会保留，可追溯性不受影响。',
      '删除答题记录',
      { type: 'warning' },
    )
    await api.exam.remove(row.id, userStore.userId)
    ElMessage.success('已删除')
    await load()
  } catch (e) {
    if (e !== 'cancel') ElMessage.error((e as Error).message)
  }
}

onMounted(load)
</script>

<template>
  <div class="page">
    <div class="page-header">
      <div>
        <h2 class="page-title">答题记录</h2>
        <p class="page-desc">
          未交卷的答题记录可继续作答；删除答题记录会实时重算准确率，但不会删除错题集与错题明细。
        </p>
      </div>
      <div class="page-actions">
        <el-button @click="router.push('/compose')">去错题组卷</el-button>
      </div>
    </div>

    <div class="stat-grid">
      <div class="stat-card">
        <div class="stat-value primary">{{ summary.total }}</div>
        <div class="stat-label">累计答题记录</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">{{ summary.submitted }}</div>
        <div class="stat-label">已交卷</div>
      </div>
      <div class="stat-card">
        <div class="stat-value pending">{{ summary.unfinished }}</div>
        <div class="stat-label">未完成（可续答）</div>
      </div>
      <div class="stat-card">
        <div class="stat-value ok">{{ formatAccuracy(summary.accuracy) }}</div>
        <div class="stat-label">客观题平均准确率</div>
      </div>
    </div>

    <div class="ql-panel table-panel">
      <el-table v-loading="loading" :data="pagedList" row-key="id">
        <el-table-column label="试卷" min-width="260">
          <template #default="{ row }">
            <div class="draft-cell">
              <span class="draft-name">{{ row.draftName }}</span>
              <span class="text-tip">
                {{ row.categoryName }} · {{ row.questionCount }} 题 · 第 {{ row.attemptNo }} 次作答
              </span>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="来源" width="110">
          <template #default="{ row }">
            <el-tag size="small" effect="plain" :type="row.sourceType === 2 ? 'warning' : 'info'">
              {{ ExamSourceTypeLabel[row.sourceType] }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="得分" width="110" align="center">
          <template #default="{ row }">
            <span v-if="row.submitTime" class="score">
              <b>{{ row.obtainedScore ?? 0 }}</b>
              <span class="text-sub"> / {{ row.totalScore ?? 0 }}</span>
            </span>
            <el-tag v-else size="small" type="warning" effect="light">未交卷</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="准确率" width="100" align="center">
          <template #default="{ row }">
            <span v-if="row.submitTime">{{ formatAccuracy(accuracyOf(row)) }}</span>
            <span v-else class="text-sub">—</span>
          </template>
        </el-table-column>
        <el-table-column label="判分情况" width="160">
          <template #default="{ row }">
            <div v-if="row.submitTime" class="judge-cell">
              <span class="pill pill-ok">对 {{ row.rightCount }}</span>
              <span class="pill pill-bad">错 {{ row.wrongCount }}</span>
              <span v-if="row.pendingCount > 0" class="pill pill-pending">待判 {{ row.pendingCount }}</span>
            </div>
            <span v-else class="text-sub">—</span>
          </template>
        </el-table-column>
        <el-table-column label="时间" width="120">
          <template #default="{ row }">
            <span class="text-sub">{{ shortTime(row.submitTime ?? row.createTime) }}</span>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="150" align="center">
          <template #default="{ row }">
            <el-button
              v-if="row.submitTime"
              size="small"
              type="primary"
              text
              @click="router.push(`/exam/${row.id}/result`)"
            >
              回顾
            </el-button>
            <el-button v-else size="small" type="primary" @click="router.push(`/exam/${row.id}`)">
              继续作答
            </el-button>
            <el-button size="small" type="danger" text @click="remove(row)">删除</el-button>
          </template>
        </el-table-column>
        <template #empty>
          <div class="empty-hint">
            还没有答题记录，去公开试卷广场选一份开始刷题
            <div class="mt8">
              <el-button type="primary" @click="router.push('/')">去选试卷</el-button>
            </div>
          </div>
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
  </div>
</template>

<style scoped>
.table-panel {
  padding: 0;
  overflow: hidden;
}

.draft-cell {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 2px 0;
}

.draft-name {
  font-size: var(--ql-fs-body);
  font-weight: 600;
  color: var(--ql-title);
  line-height: 1.6;
}

.score {
  font-size: var(--ql-fs-body);
  color: var(--ql-title);
  font-variant-numeric: tabular-nums;
}

.judge-cell {
  display: flex;
  align-items: center;
  gap: 6px;
}

.pill {
  display: inline-block;
  padding: 1px 8px;
  border-radius: 999px;
  font-size: var(--ql-fs-tip);
  font-weight: 500;
}

.pill-ok {
  background: var(--ql-success-soft);
  color: var(--ql-success);
}

.pill-bad {
  background: var(--ql-danger-soft);
  color: var(--ql-danger);
}

.pill-pending {
  background: var(--ql-warning-soft);
  color: var(--ql-warning);
}
</style>
