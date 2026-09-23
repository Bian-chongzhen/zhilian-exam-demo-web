<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { api } from '@/api'
import { EnabledFlag } from '@/constants/enums'
import { usePagination } from '@/composables/usePagination'
import { useUserStore } from '@/stores/user'
import type { QuestionTag } from '@/types/models'

const userStore = useUserStore()

const loading = ref(false)
const tags = ref<Array<QuestionTag & { usedCount: number }>>([])

/** 标签数量会持续增长，必须分页 */
const { currentPage, pageSize, total, pagedList } = usePagination(tags)

const dialogVisible = ref(false)
const editingId = ref<number | null>(null)
const form = reactive({ tagName: '' })

async function load() {
  loading.value = true
  try {
    tags.value = await api.tag.list()
  } catch (e) {
    ElMessage.error((e as Error).message)
  } finally {
    loading.value = false
  }
}

function openCreate() {
  editingId.value = null
  form.tagName = ''
  dialogVisible.value = true
}

function openEdit(row: QuestionTag) {
  editingId.value = row.id
  form.tagName = row.tagName
  dialogVisible.value = true
}

async function submit() {
  try {
    if (editingId.value) {
      await api.tag.update(userStore.userId, editingId.value, { tagName: form.tagName })
      ElMessage.success('标签已更新（题目与错题的标签引用会实时同步）')
    } else {
      await api.tag.create(userStore.userId, form.tagName)
      ElMessage.success('标签已创建')
    }
    dialogVisible.value = false
    await load()
  } catch (e) {
    ElMessage.error((e as Error).message)
  }
}

async function toggleEnabled(row: QuestionTag) {
  try {
    const next = row.isEnabled === EnabledFlag.ENABLED ? EnabledFlag.DISABLED : EnabledFlag.ENABLED
    await api.tag.update(userStore.userId, row.id, { isEnabled: next })
    ElMessage.success(next === EnabledFlag.ENABLED ? '已启用' : '已停用（不参与新组卷与标签选择）')
    await load()
  } catch (e) {
    ElMessage.error((e as Error).message)
  }
}

async function remove(row: QuestionTag) {
  try {
    await ElMessageBox.confirm(`确认删除标签「${row.tagName}」？若被分类或题目引用将被阻止。`, '删除标签', {
      type: 'warning',
    })
    await api.tag.remove(userStore.userId, row.id)
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
        <h2 class="page-title">考点标签</h2>
        <p class="page-desc">
          标签为<b>扁平结构</b>，仅管理员维护；普通用户只能选用。
          标签被分类或题目引用时不可删除，可改为停用。
        </p>
      </div>
      <el-button type="primary" @click="openCreate">新增标签</el-button>
    </div>

    <div class="ql-panel ql-panel--tight tag-panel">
      <el-table v-loading="loading" :data="pagedList">
        <el-table-column prop="tagName" label="标签名称" min-width="220">
          <template #default="{ row }">
            <span class="text-title tag-name">{{ row.tagName }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="sortNo" label="排序" width="80" align="center" />
        <el-table-column label="状态" width="110" align="center">
          <template #default="{ row }">
            <el-tag v-if="row.isEnabled === 1" type="success" size="small" effect="plain">启用</el-tag>
            <el-tag v-else type="info" size="small" effect="plain">停用</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="被题目引用" width="120" align="center">
          <template #default="{ row }">
            <span class="count-cell">{{ row.usedCount }}</span>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="180" align="center" fixed="right">
          <template #default="{ row }">
            <el-button size="small" text type="primary" @click="openEdit(row)">重命名</el-button>
            <el-button size="small" text @click="toggleEnabled(row)">
              {{ row.isEnabled === 1 ? '停用' : '启用' }}
            </el-button>
            <el-dropdown trigger="click">
              <el-button size="small" text class="more-btn">
                更多<Icon icon="ph:caret-down" class="more-icon" />
              </el-button>
              <template #dropdown>
                <el-dropdown-menu>
                  <el-dropdown-item @click="remove(row)">删除标签</el-dropdown-item>
                </el-dropdown-menu>
              </template>
            </el-dropdown>
          </template>
        </el-table-column>
        <template #empty>
          <div class="empty-hint">暂无考点标签，点击右上角「新增标签」创建</div>
        </template>
      </el-table>

      <!-- 分页常驻（有数据即显示），为后续标签增多预留 -->
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
      标签被分类或题目引用时<b>不可删除</b>，可改为停用（停用后不参与新组卷与标签选择）；
      题目内容锁定后标签仍可调整，即<b>标签不受题目锁定限制</b>。
    </div>

    <el-dialog v-model="dialogVisible" :title="editingId ? '重命名标签' : '新增标签'" width="460px">
      <el-form label-position="top">
        <el-form-item label="标签名称">
          <el-input v-model="form.tagName" placeholder="例如：进制转换" />
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
.tag-panel {
  padding: var(--ql-s1) var(--ql-s1) 0;
  overflow: hidden;
}

.tag-name {
  font-weight: 500;
}

.count-cell {
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
