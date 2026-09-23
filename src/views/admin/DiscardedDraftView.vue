<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { api } from '@/api'
import { PaperTypeLabel } from '@/constants/enums'
import { usePagination } from '@/composables/usePagination'
import type { DraftListItem } from '@/types/models'

const router = useRouter()

const loading = ref(false)
const drafts = ref<DraftListItem[]>([])

/** 废弃试卷会持续累积，统一分页 */
const { currentPage, pageSize, total, pagedList } = usePagination(drafts)

async function load() {
  loading.value = true
  try {
    drafts.value = await api.draft.listDiscarded()
  } catch (e) {
    ElMessage.error((e as Error).message)
  } finally {
    loading.value = false
  }
}

onMounted(load)
</script>

<template>
  <div class="page">
    <div class="page-header">
      <div>
        <h2 class="page-title">废弃试卷审计</h2>
        <p class="page-desc">
          用户执行删除后，试卷标记为废弃：<b>原创建者不再可见</b>，管理员在此查看全部废弃试卷。
          废弃试卷<b>不支持恢复</b>，本页为只读审计用途。
        </p>
      </div>
      <el-button @click="load">刷新</el-button>
    </div>

    <div class="rule-tip warn mb24">
      废弃试卷<b>不可恢复</b>，且<b>原创建者不可见</b>：本页仅供管理员只读审计，不提供任何编辑或恢复入口。
    </div>

    <div class="ql-panel ql-panel--tight discarded-panel">
      <el-table v-loading="loading" :data="pagedList">
        <el-table-column prop="id" label="ID" width="76" align="center">
          <template #default="{ row }">
            <span class="id-cell text-mono">{{ row.id }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="draftName" label="试卷名称" min-width="260" show-overflow-tooltip />
        <el-table-column prop="categoryName" label="分类" width="150">
          <template #default="{ row }">
            <el-tag size="small" effect="plain" type="info">{{ row.categoryName }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="类型" width="100">
          <template #default="{ row }">
            <span class="text-body">{{ PaperTypeLabel[row.paperType] }}</span>
          </template>
        </el-table-column>
        <el-table-column label="可见性" width="95">
          <template #default="{ row }">
            <span class="text-body">{{ row.visibility === 2 ? '公开' : '私有' }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="questionCount" label="题量" width="80" align="center" />
        <el-table-column label="创建者" width="140">
          <template #default="{ row }">
            <el-link type="primary" @click="router.push(`/u/${row.userId}`)">{{ row.ownerName }}</el-link>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="120" align="center" fixed="right">
          <template #default="{ row }">
            <el-button size="small" text type="primary" @click="router.push(`/drafts/${row.id}`)">查看内容</el-button>
          </template>
        </el-table-column>
        <template #empty>
          <div class="empty-hint">暂无废弃试卷</div>
        </template>
      </el-table>

      <!-- 分页常驻（有数据即显示），为后续废弃试卷累积预留 -->
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
      废弃试卷不影响历史答题记录：已生成的答题记录仍可正常回顾，其题目内容因锁定机制而保持不变。
    </div>
  </div>
</template>

<style scoped>
.discarded-panel {
  padding: var(--ql-s1) var(--ql-s1) 0;
  overflow: hidden;
}

.id-cell {
  color: var(--ql-muted);
}
</style>
