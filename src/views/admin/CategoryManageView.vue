<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { api } from '@/api'
import { usePagination } from '@/composables/usePagination'
import { useUserStore } from '@/stores/user'
import type { CategoryDetail, QuestionTag } from '@/types/models'

const userStore = useUserStore()

const loading = ref(false)
const categories = ref<CategoryDetail[]>([])
const tags = ref<QuestionTag[]>([])

/** 分类会随业务扩展，统一分页 */
const { currentPage, pageSize, total, pagedList } = usePagination(categories)

const dialogVisible = ref(false)
const editingId = ref<number | null>(null)
const form = reactive({
  categoryName: '',
  fixedQuestionCount: 10,
  tagIds: [] as number[],
  weights: {} as Record<number, number | undefined>,
})

const isSystemEditing = computed(
  () => categories.value.find((c) => c.id === editingId.value)?.isSystem === 1,
)

async function load() {
  loading.value = true
  try {
    categories.value = await api.category.list()
    tags.value = (await api.tag.list()).filter((t) => t.isEnabled === 1)
  } catch (e) {
    ElMessage.error((e as Error).message)
  } finally {
    loading.value = false
  }
}

function openCreate() {
  editingId.value = null
  form.categoryName = ''
  form.fixedQuestionCount = 10
  form.tagIds = []
  form.weights = {}
  dialogVisible.value = true
}

function openEdit(row: CategoryDetail) {
  editingId.value = row.id
  form.categoryName = row.categoryName
  form.fixedQuestionCount = row.fixedQuestionCount
  form.tagIds = [...row.tagIds]
  form.weights = {}
  row.weights.forEach((w) => {
    form.weights[w.tagId] = w.weight
  })
  dialogVisible.value = true
}

async function submit() {
  try {
    const payload = {
      categoryName: form.categoryName,
      fixedQuestionCount: form.fixedQuestionCount,
      tagIds: [...form.tagIds],
      weights: form.tagIds
        .filter((tagId) => form.weights[tagId] !== undefined && form.weights[tagId] !== null)
        .map((tagId) => ({ tagId, weight: Number(form.weights[tagId]) })),
    }
    if (editingId.value) {
      await api.category.update(userStore.userId, editingId.value, payload)
      ElMessage.success('分类已更新（试卷类型不再绑定分类，可随时新增标签与权重）')
    } else {
      await api.category.create(userStore.userId, payload)
      ElMessage.success('分类已创建')
    }
    dialogVisible.value = false
    await load()
  } catch (e) {
    ElMessage.error((e as Error).message)
  }
}

async function remove(row: CategoryDetail) {
  try {
    await ElMessageBox.confirm(`确认删除分类「${row.categoryName}」？若仍被试卷引用将被阻止。`, '删除分类', {
      type: 'warning',
    })
    await api.category.remove(userStore.userId, row.id)
    ElMessage.success('已删除')
    await load()
  } catch (e) {
    if (e !== 'cancel') ElMessage.error((e as Error).message)
  }
}

function tagName(tagId: number): string {
  return tags.value.find((t) => t.id === tagId)?.tagName ?? `#${tagId}`
}

onMounted(load)
</script>

<template>
  <div class="page">
    <div class="page-header">
      <div>
        <h2 class="page-title">试卷分类</h2>
        <p class="page-desc">
          分类<b>不再绑定试卷类型</b>；预置分类不可删除。
          分值占比未配置的考点按均权 1.00 参与加权抽题。
        </p>
      </div>
      <el-button type="primary" @click="openCreate">新增分类</el-button>
    </div>

    <div class="ql-panel ql-panel--tight category-panel">
    <el-table v-loading="loading" :data="pagedList">
      <el-table-column prop="categoryName" label="分类名称" min-width="180" />
      <el-table-column prop="fixedQuestionCount" label="固定题量" width="110" align="center" />
      <el-table-column label="类型" width="110" align="center">
        <template #default="{ row }">
          <el-tag v-if="row.isSystem === 1" type="warning" size="small" effect="plain">系统预置</el-tag>
          <el-tag v-else type="info" size="small" effect="plain">自定义</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="包含考点" min-width="300">
        <template #default="{ row }">
          <div v-if="row.tagIds.length > 0" class="tag-wrap">
            <el-tag v-for="tagId in row.tagIds" :key="tagId" size="small" effect="plain" class="tag-item">
              {{ tagName(tagId) }}
              <span class="weight-text">
                {{ row.weights.find((w: { tagId: number }) => w.tagId === tagId)?.weight ?? '均权' }}
              </span>
            </el-tag>
          </div>
          <span v-else class="text-sub">未配置考点</span>
        </template>
      </el-table-column>
      <el-table-column prop="draftCount" label="关联试卷" width="100" align="center" />
      <el-table-column label="操作" width="150" align="center" fixed="right">
        <template #default="{ row }">
          <el-button size="small" text type="primary" @click="openEdit(row)">编辑</el-button>
          <el-button size="small" text type="danger" :disabled="row.isSystem === 1" @click="remove(row)">
            删除
          </el-button>
        </template>
      </el-table-column>
      <template #empty>
        <div class="empty-hint">暂无分类，点击右上角「新增分类」创建第一个分类</div>
      </template>
    </el-table>

    <!-- 分页常驻（有数据即显示），为后续分类增多预留 -->
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

    <el-dialog
      v-model="dialogVisible"
      :title="editingId ? '编辑分类' : '新增分类'"
      width="720px"
      top="6vh"
    >
      <el-alert
        v-if="isSystemEditing"
        type="info"
        :closable="false"
        class="mb16"
        title="系统预置分类"
        description="可以修改固定题量、包含的考点与权重，但不可删除。"
      />
      <el-form label-position="top">
        <el-row :gutter="16">
          <el-col :span="14">
            <el-form-item label="分类名称">
              <el-input v-model="form.categoryName" />
            </el-form-item>
          </el-col>
          <el-col :span="10">
            <el-form-item label="固定题量（错题组卷目标题量）">
              <el-input-number v-model="form.fixedQuestionCount" :min="1" :max="200" />
            </el-form-item>
          </el-col>
        </el-row>

        <el-form-item label="该分类包含的全部考点标签">
          <el-select v-model="form.tagIds" multiple filterable style="width: 100%">
            <el-option v-for="tag in tags" :key="tag.id" :label="tag.tagName" :value="tag.id" />
          </el-select>
        </el-form-item>

        <el-form-item label="各考点分值占比（留空 = 未配置，按均权 1.00）">
          <div class="weight-list">
            <div v-for="tagId in form.tagIds" :key="tagId" class="weight-row">
              <span class="weight-name">{{ tagName(tagId) }}</span>
              <el-input-number
                v-model="form.weights[tagId]"
                :min="0.1"
                :max="99"
                :step="0.5"
                :precision="2"
                size="small"
                placeholder="未配置"
              />
            </div>
            <div v-if="form.tagIds.length === 0" class="text-sub">先选择考点标签</div>
          </div>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button text @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="submit">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
/* 表格卡片：白底面板包裹，表头与页面留白协调 */
.category-panel {
  padding: var(--ql-s1) var(--ql-s1) 0;
  overflow: hidden;
}

.tag-wrap {
  display: flex;
  flex-wrap: wrap;
  gap: var(--ql-s1);
}

.tag-item {
  margin: 0;
}

.weight-text {
  margin-left: 4px;
  color: var(--ql-muted);
  font-size: var(--ql-fs-tip);
}

/* 编辑弹窗：分值占比 2 列网格，行间距 16px */
.weight-list {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: var(--ql-s2) var(--ql-s2);
  width: 100%;
}

.weight-row {
  display: flex;
  align-items: center;
  gap: var(--ql-s1);
  padding: var(--ql-s1);
  background: var(--ql-surface-soft);
  border: 1px solid var(--ql-border-light);
  border-radius: var(--ql-radius-sm);
}

.weight-name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: var(--ql-fs-small);
  color: var(--ql-text);
}
</style>
