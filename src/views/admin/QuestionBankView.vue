<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { api } from '@/api'
import { QuestionTypeLabel, QuestionTypeOptions } from '@/constants/enums'
import { usePagination } from '@/composables/usePagination'
import { useUserStore } from '@/stores/user'
import type { QuestionTag } from '@/types/models'

const userStore = useUserStore()

interface BankRow {
  question: { id: number; title: string; questionType: number; score: number; isLocked: number; answer: string }
  tagNames: string[]
  usedByDraftCount: number
  usedByExamCount: number
  lockedDraftNames: string[]
}

const loading = ref(false)
const rows = ref<BankRow[]>([])
const tags = ref<QuestionTag[]>([])
const filter = ref<{ keyword: string; tagId: number | null; questionType: number | null }>({
  keyword: '',
  tagId: null,
  questionType: null,
})

const dialogVisible = ref(false)
const current = ref<BankRow | null>(null)
const currentTagIds = ref<number[]>([])
const saving = ref(false)

/** 题库可能上百条，必须分页，避免页面过长 */
const { currentPage, pageSize, total, pagedList, resetPage } = usePagination(rows, 10)

async function load() {
  loading.value = true
  try {
    rows.value = (await api.draft.questionBank({
      keyword: filter.value.keyword,
      tagId: filter.value.tagId,
      questionType: filter.value.questionType,
    })) as unknown as BankRow[]
  } catch (e) {
    ElMessage.error((e as Error).message)
  } finally {
    loading.value = false
  }
}

/** 查询：回到第一页 */
function search() {
  resetPage()
  load()
}

function openTagDialog(row: BankRow) {
  current.value = row
  currentTagIds.value = tags.value.filter((t) => row.tagNames.includes(t.tagName)).map((t) => t.id)
  dialogVisible.value = true
}

async function saveTags() {
  if (!current.value) return
  saving.value = true
  try {
    await api.draft.adminUpdateQuestionTags(userStore.userId, current.value.question.id, currentTagIds.value)
    ElMessage.success('题目标签已更新（不受题目锁定限制，错题权重将随之重算）')
    dialogVisible.value = false
    await load()
  } catch (e) {
    ElMessage.error((e as Error).message)
  } finally {
    saving.value = false
  }
}

onMounted(async () => {
  tags.value = (await api.tag.list()).filter((t) => t.isEnabled === 1)
  await load()
})
</script>

<template>
  <div class="page">
    <div class="page-header">
      <div>
        <h2 class="page-title">题库纠错</h2>
        <p class="page-desc">
          管理员可直接调整<b>任意题目的考点标签</b>——标签是锁定机制的唯一例外，用于修正分类归属与抽题权重。
        </p>
      </div>
    </div>

    <div class="filter-bar">
      <el-input v-model="filter.keyword" placeholder="按题干搜索" style="width: 260px" clearable @keyup.enter="search" />
      <el-select v-model="filter.tagId" placeholder="全部标签" clearable style="width: 170px">
        <el-option v-for="tag in tags" :key="tag.id" :label="tag.tagName" :value="tag.id" />
      </el-select>
      <el-select v-model="filter.questionType" placeholder="全部题型" clearable style="width: 140px">
        <el-option v-for="o in QuestionTypeOptions" :key="o.value" :label="o.label" :value="o.value" />
      </el-select>
      <el-button type="primary" @click="search">查询</el-button>
      <div class="filter-bar__spacer"></div>
      <span class="text-tip">共 {{ total }} 道题</span>
    </div>

    <div class="ql-panel ql-panel--tight bank-panel">
      <el-table v-loading="loading" :data="pagedList">
        <el-table-column prop="question.id" label="ID" width="76" align="center">
          <template #default="{ row }">
            <span class="id-cell text-mono">{{ row.question.id }}</span>
          </template>
        </el-table-column>
        <el-table-column label="题型" width="90">
          <template #default="{ row }">
            <el-tag size="small" effect="plain" type="info">{{ QuestionTypeLabel[row.question.questionType] }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="题干" min-width="340">
          <template #default="{ row }">
            <div class="title-cell">{{ row.question.title }}</div>
          </template>
        </el-table-column>
        <el-table-column label="考点标签" min-width="200">
          <template #default="{ row }">
            <div v-if="row.tagNames.length > 0" class="tag-wrap">
              <el-tag v-for="tag in row.tagNames" :key="tag" size="small" effect="plain" class="tag-item">
                {{ tag }}
              </el-tag>
            </div>
            <span v-else class="text-sub">未绑定</span>
          </template>
        </el-table-column>
        <el-table-column label="引用 / 锁定" width="190">
          <template #default="{ row }">
            <div class="ref-cell text-sub">试卷 {{ row.usedByDraftCount }} · 历史答题记录 {{ row.usedByExamCount }}</div>
            <el-tag v-if="row.question.isLocked === 1" type="warning" size="small" effect="plain">
              已锁定（{{ row.lockedDraftNames.length }} 份试卷）
            </el-tag>
            <el-tag v-else type="success" size="small" effect="plain">未锁定</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="120" align="center" fixed="right">
          <template #default="{ row }">
            <el-button size="small" text type="primary" @click="openTagDialog(row)">维护标签</el-button>
          </template>
        </el-table-column>
        <template #empty>
          <div class="empty-hint">没有匹配的题目，试试调整搜索关键词或筛选条件</div>
        </template>
      </el-table>

      <!-- 分页常驻（有数据即显示） -->
      <div v-if="total > 0" class="table-pager">
        <el-pagination
          v-model:current-page="currentPage"
          v-model:page-size="pageSize"
          :page-sizes="[10, 20, 50]"
          :total="total"
          :pager-count="7"
          layout="total, sizes, prev, pager, next, jumper"
          background
        />
      </div>
    </div>

    <el-dialog v-model="dialogVisible" title="维护题目标签（管理员纠错）" width="620px">
      <div class="rule-tip mb16">
        题目内容锁定后<b>标签仍可调整</b>：修改后 Web 端错题记录的标签与抽题权重会实时重算。
      </div>
      <div class="current-box mb16">
        <div class="current-title">{{ current?.question.title }}</div>
        <div class="text-tip">
          当前状态：{{ current?.question.isLocked === 1 ? '已锁定（内容只读）' : '未锁定' }}
        </div>
      </div>
      <el-form label-position="top">
        <el-form-item label="考点标签">
          <el-select v-model="currentTagIds" multiple filterable style="width: 100%">
            <el-option v-for="tag in tags" :key="tag.id" :label="tag.tagName" :value="tag.id" />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="saveTags">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.bank-panel {
  padding: var(--ql-s1) var(--ql-s1) 0;
  overflow: hidden;
}

.id-cell {
  color: var(--ql-muted);
}

/* 题干：允许换行但限制 3 行，避免长题干撑高整行 */
.title-cell {
  white-space: pre-wrap;
  word-break: break-word;
  line-height: 1.7;
  color: var(--ql-text);
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.tag-wrap {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.tag-item {
  margin: 0;
}

.ref-cell {
  font-size: var(--ql-fs-tip);
  margin-bottom: 4px;
}

/* 弹窗内当前题目信息块 */
.current-box {
  padding: var(--ql-s2);
  background: var(--ql-surface-soft);
  border: 1px solid var(--ql-border-light);
  border-radius: var(--ql-radius-sm);
}

.current-title {
  font-size: var(--ql-fs-small);
  color: var(--ql-title);
  line-height: 1.7;
  margin-bottom: 4px;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
</style>
