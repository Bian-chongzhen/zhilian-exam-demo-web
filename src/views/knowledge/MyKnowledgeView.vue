<script setup lang="ts">
/**
 * 我的知识点 `/my-knowledge`（v1-plus 模块1）
 *
 * 依据《14、v1 plus.md》§4.4：
 *   - 管理本人创建的全部知识点（私有 + 公开），明确标记可见性
 *   - 操作：查看 / 编辑 / 删除（删除二次确认）
 *   - 分页常驻；空状态提示
 */
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { api, type KnowledgeListItem } from '@/api'
import { usePagination } from '@/composables/usePagination'
import { useUserStore } from '@/stores/user'

const router = useRouter()
const userStore = useUserStore()

const loading = ref(false)
const list = ref<KnowledgeListItem[]>([])
const { currentPage, pageSize, total, pagedList } = usePagination(list, 10)

async function load() {
  loading.value = true
  try {
    list.value = await api.knowledge.listMine(userStore.userId)
  } catch (e) {
    ElMessage.error((e as Error).message)
  } finally {
    loading.value = false
  }
}

async function remove(row: KnowledgeListItem) {
  try {
    await ElMessageBox.confirm(
      `确认删除知识点「${row.title}」？删除后会解除与标签、题目的关联，但不会删除题目本身。`,
      '删除知识点',
      { type: 'warning', confirmButtonText: '删除' },
    )
    await api.knowledge.remove(row.id, userStore.userId)
    ElMessage.success('已删除')
    await load()
  } catch (e) {
    if (e !== 'cancel') ElMessage.error((e as Error).message)
  }
}

function formatTime(value?: string): string {
  return value ? new Date(value).toLocaleString('zh-CN') : '—'
}

onMounted(load)
</script>

<template>
  <div class="page">
    <div class="page-header">
      <div>
        <h2 class="page-title">我的知识点</h2>
        <p class="page-desc">
          这里放你写的全部讲义，公开的会出现在广场，私有的只有自己看得到。
          改完不想给别人看，切成私有就会立刻从广场消失。
        </p>
      </div>
      <div class="page-actions">
        <el-button @click="router.push('/knowledge')">去广场看看</el-button>
        <el-button type="primary" @click="router.push('/knowledge/new/edit')">新建知识点</el-button>
      </div>
    </div>

    <div class="ql-panel table-panel">
      <el-table v-loading="loading" :data="pagedList" row-key="id">
        <el-table-column label="标题" min-width="260">
          <template #default="{ row }">
            <div class="title-cell">
              <span class="title-text" @click="router.push(`/knowledge/${row.id}`)">
                {{ row.title }}
              </span>
              <span class="text-tip">{{ row.summary || '（无摘要）' }}</span>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="可见性" width="100" align="center">
          <template #default="{ row }">
            <el-tag
              size="small"
              :type="row.visibility === 2 ? 'success' : 'info'"
              effect="light"
            >
              {{ row.visibility === 2 ? '公开' : '私有' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="考点标签" min-width="180">
          <template #default="{ row }">
            <span v-if="row.tagNames.length === 0" class="text-tip">—</span>
            <span v-else class="text-sub">{{ row.tagNames.join('、') }}</span>
          </template>
        </el-table-column>
        <el-table-column label="更新时间" width="180">
          <template #default="{ row }">
            <span class="mono-cell">{{ formatTime(row.updateTime) }}</span>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="180" align="center" fixed="right">
          <template #default="{ row }">
            <el-button size="small" text type="primary" @click="router.push(`/knowledge/${row.id}`)">
              查看
            </el-button>
            <el-button
              size="small"
              text
              @click="router.push(`/knowledge/${row.id}/edit`)"
            >
              编辑
            </el-button>
            <el-dropdown trigger="click">
              <el-button size="small" text class="more-btn">
                更多<Icon icon="ph:caret-down" class="more-icon" />
              </el-button>
              <template #dropdown>
                <el-dropdown-menu>
                  <el-dropdown-item @click="remove(row)">删除知识点</el-dropdown-item>
                </el-dropdown-menu>
              </template>
            </el-dropdown>
          </template>
        </el-table-column>
        <template #empty>
          <div class="empty-hint">还没有知识点，点右上角「新建知识点」写第一篇</div>
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

.title-cell {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 2px 0;
}

.title-text {
  font-weight: 500;
  color: var(--ql-title);
  cursor: pointer;
}

.title-text:hover {
  color: var(--ql-primary);
}

.mono-cell {
  font-variant-numeric: tabular-nums;
  color: var(--ql-text);
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
