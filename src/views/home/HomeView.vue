<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { api } from '@/api'
import { PaperTypeLabel, PaperTypeOptions } from '@/constants/enums'
import { usePagination } from '@/composables/usePagination'
import { useStartExam } from '@/composables/useStartExam'
import { useLoginPrompt } from '@/composables/useLoginPrompt'
import { useUserStore } from '@/stores/user'
import GuestGuard from '@/components/GuestGuard.vue'
import type { CategoryDetail, DraftListItem, ExamListItem } from '@/types/models'

const router = useRouter()
const userStore = useUserStore()
const { resumeUnfinishedIfAny } = useStartExam()
const { promptLogin } = useLoginPrompt()

const loading = ref(false)
const drafts = ref<DraftListItem[]>([])
const categories = ref<CategoryDetail[]>([])
const unfinished = ref<ExamListItem[]>([])
const filter = reactive<{ categoryId: number | null; paperType: number | null; keyword: string }>({
  categoryId: null,
  paperType: null,
  keyword: '',
})

/** 每页 10 条，避免试卷多时页面过长 */
const { currentPage, pageSize, total, pagedList, resetPage } = usePagination(drafts)

async function load() {
  loading.value = true
  try {
    // 游客可浏览公开试卷（13 号 §4.2）；「未完成答题记录」属个人数据，游客不查询
    drafts.value = await api.draft.listPublic({ ...filter })
    unfinished.value = userStore.isLogin ? await api.exam.listUnsubmitted(userStore.userId) : []
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

async function startExam(draft: DraftListItem) {
  // 双保险：按钮已置灰并由 GuestGuard 承接点击，这里再挡一次，
  // 避免通过其他路径触发；服务层同样会拒绝游客写入（13 号 §5.3 安全约束）
  if (userStore.isGuest) {
    void promptLogin()
    return
  }
  try {
    // 该试卷若已有未完成的答题记录，先让用户选「继续上次 / 重新开始」，避免误开一份空白答题记录
    if (await resumeUnfinishedIfAny(draft)) return
    await ElMessageBox.confirm(
      `将基于《${draft.draftName}》生成一份独立的答题记录，开始后支持中途保存、退出后续答。`,
      '开始答题',
      { confirmButtonText: '开始答题', cancelButtonText: '取消' },
    )
    const exam = await api.exam.start(userStore.userId, draft.id)
    ElMessage.success('已开始答题')
    router.push(`/exam/${exam.id}`)
  } catch (e) {
    if (e !== 'cancel') ElMessage.error((e as Error).message)
  }
}

function resetFilter() {
  filter.categoryId = null
  filter.paperType = null
  filter.keyword = ''
  search()
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
        <h2 class="page-title">公开试卷广场</h2>
        <p class="page-desc">
          仅展示<b>启用状态</b>的公开试卷；废弃试卷不展示。试卷启用后即永久锁定，题目与分值不会再变化。
        </p>
      </div>
      <div class="page-actions">
        <el-button v-if="userStore.isAdmin" type="primary" @click="router.push('/my-drafts')">
          去创建试卷
        </el-button>
      </div>
    </div>

    <!-- 未完成答题记录：继续作答入口 -->
    <div v-if="unfinished.length > 0" class="ql-panel ql-panel--tight resume-panel">
      <div class="resume-head">
        <Icon icon="ph:clock" class="resume-icon" />
        <span class="resume-title">你有 {{ unfinished.length }} 份未完成的答题记录</span>
        <span class="text-sub">退出后可随时回来继续作答，答案已自动保存</span>
      </div>
      <div
        v-for="item in unfinished"
        :key="item.id"
        class="resume-item"
        @click="router.push(`/exam/${item.id}`)"
      >
        <div class="resume-item-main">
          <span class="resume-item-name">{{ item.draftName }}</span>
          <span class="text-sub">{{ item.categoryName }} · 共 {{ item.questionCount }} 题</span>
        </div>
        <el-button type="primary" link>继续作答</el-button>
      </div>
    </div>

    <!-- 筛选区 -->
    <div class="filter-bar">
      <el-select v-model="filter.categoryId" placeholder="全部试卷分类" clearable style="width: 200px">
        <el-option
          v-for="category in categories"
          :key="category.id"
          :label="category.categoryName"
          :value="category.id"
        />
      </el-select>
      <el-select v-model="filter.paperType" placeholder="全部试卷类型" clearable style="width: 168px">
        <el-option
          v-for="option in PaperTypeOptions"
          :key="option.value"
          :label="option.label"
          :value="option.value"
        />
      </el-select>
      <el-input
        v-model="filter.keyword"
        placeholder="按试卷名称搜索"
        style="width: 240px"
        clearable
        @keyup.enter="search"
      />
      <el-button type="primary" @click="search">查询</el-button>
      <el-button text @click="resetFilter">重置</el-button>
      <div class="filter-bar__spacer"></div>
      <span class="text-tip">共 {{ total }} 份可用试卷</span>
    </div>

    <!-- 列表 -->
    <div class="ql-panel table-panel">
      <el-table v-loading="loading" :data="pagedList" row-key="id">
        <el-table-column label="试卷名称" min-width="300">
          <template #default="{ row }">
            <div class="draft-cell">
              <span class="draft-name" @click="router.push(`/drafts/${row.id}`)">{{ row.draftName }}</span>
              <span class="text-tip">{{ row.questionCount }} 题 · {{ row.categoryName }}</span>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="试卷类型" width="120">
          <template #default="{ row }">
            <span class="type-chip" :class="row.paperType === 1 ? 'is-competitive' : 'is-practice'">
              {{ PaperTypeLabel[row.paperType] }}
            </span>
          </template>
        </el-table-column>
        <el-table-column label="题量" width="90" align="center">
          <template #default="{ row }">
            <span class="text-body">{{ row.questionCount }}</span>
          </template>
        </el-table-column>
        <el-table-column label="创建者" width="140">
          <template #default="{ row }">
            <el-link type="primary" :underline="false" @click="router.push(`/u/${row.userId}`)">
              {{ row.ownerName }}
            </el-link>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="170" align="center">
          <template #default="{ row }">
            <el-button size="small" text @click="router.push(`/drafts/${row.id}`)">预览</el-button>
            <!-- S1：游客置灰 + tooltip「登录后可用」+ 点击弹登录（13 号 §9.2 S1 / §4.4 方式A） -->
            <GuestGuard>
              <el-button
                size="small"
                type="primary"
                :disabled="userStore.isGuest"
                @click="startExam(row)"
              >
                开始答题
              </el-button>
            </GuestGuard>
          </template>
        </el-table-column>
        <template #empty>
          <div class="empty-hint">没有符合条件的公开试卷，试试调整筛选条件</div>
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
/* 未完成答题记录面板 */
.resume-panel {
  border-left: 3px solid var(--ql-warning);
}

.resume-head {
  display: flex;
  align-items: center;
  gap: var(--ql-s1);
  margin-bottom: var(--ql-s2);
}

.resume-icon {
  color: var(--ql-warning);
}

.resume-title {
  font-size: var(--ql-fs-body);
  font-weight: 600;
  color: var(--ql-title);
}

.resume-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 12px;
  border-radius: var(--ql-radius-sm);
  cursor: pointer;
  transition: background-color var(--ql-dur-fast) var(--ql-ease-spring);
}

.resume-item:hover {
  background: var(--ql-surface-sunken);
}

.resume-item-main {
  display: flex;
  align-items: center;
  gap: var(--ql-s2);
}

.resume-item-name {
  font-size: var(--ql-fs-body);
  color: var(--ql-title);
}

/* 表格卡片：去掉内边距让表格铺满 */
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
  cursor: pointer;
  line-height: 1.6;
}

.draft-name:hover {
  color: var(--ql-primary);
}

/* 类型胶囊 .type-chip 已收敛到 global.css §11（16 号 C-1），此处不再重复定义 */
</style>
