<script setup lang="ts">
/**
 * 用户账号管理（v0.5）
 *
 * 依据《13、知练题库 v0.5 需求规格文档.md》§3 与 §6.1（UM-01 ~ UM-07）：
 *   - 仅管理员可访问（守卫放过、外壳渲染无权限提示块，本页不会执行到）
 *   - 列表**包含已注销账号**：可查看，但不可重置密码 / 不可切换角色（S1 置灰 + 说明原因）
 *   - 不能把自己取消管理员角色（让平台失去管理员是不可接受的）
 *   - 「查看用户主页」收进「更多」，保证操作列 ≤ 2 按钮 + 1 下拉（10 号快照 §5）
 *
 * 交互与文案遵循：13 号 §9 统一界面表现规范（S1 置灰要说明原因、状态标签色彩映射）
 * 与 16 号 §9 文案规范（具体、口语、说人话）。
 */
import { computed, onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { api, type AccountStatusFilter, type AdminUserItem } from '@/api'
import { RoleType, RoleTypeLabel } from '@/constants/enums'
import { Copy } from '@/constants/copy'
import { usePagination } from '@/composables/usePagination'
import { useColumnSetting, type ColumnDef } from '@/composables/useColumnSetting'
import { useUserStore } from '@/stores/user'
import ColumnSetting from '@/components/ColumnSetting.vue'

const router = useRouter()
const userStore = useUserStore()

const loading = ref(false)
const rows = ref<AdminUserItem[]>([])

/** 该列表的分页状态独立（10 号快照 §5：禁止跨列表共用 currentPage / pageSize） */
const { currentPage, pageSize, total, pagedList, resetPage } = usePagination(rows)

/* ------------------------------ 列表设置（列显隐） ------------------------------ */
/**
 * 列定义：`key` 是持久化标识（改列标题不会让用户已保存的设置失效）。
 * 「操作」列 `locked` —— 它必须存在，否则用户可能把自己锁在没有任何操作入口的状态。
 */
const columnDefs: ColumnDef[] = [
  { key: 'username', label: '用户名' },
  { key: 'phone', label: '手机号' },
  { key: 'createTime', label: '注册时间' },
  { key: 'deleteTime', label: '注销时间' },
  { key: 'status', label: '账号状态' },
  { key: 'role', label: '角色' },
  { key: 'actions', label: '操作', locked: true },
]

const {
  visibleKeys,
  isVisible,
  toggle: toggleColumn,
  reset: resetColumns,
} = useColumnSetting('admin/user-manage', columnDefs)

/** 账号状态筛选项：由逻辑删除派生，不新增枚举 */
const statusOptions: Array<{ value: AccountStatusFilter; label: string }> = [
  { value: 'all', label: '全部' },
  { value: 'normal', label: '正常' },
  { value: 'deactivated', label: '已逻辑注销' },
]

const filter = reactive<{ keyword: string; accountStatus: AccountStatusFilter }>({
  keyword: '',
  accountStatus: 'all',
})

/* ------------------------------ 重置密码 ------------------------------ */

const resetDialogVisible = ref(false)
const resetTarget = ref<AdminUserItem | null>(null)
const resetForm = reactive({ password: '' })

/* ------------------------------ 切换角色 ------------------------------ */

const roleDialogVisible = ref(false)
const roleTarget = ref<AdminUserItem | null>(null)

/* -------------------------------- 数据 -------------------------------- */

async function load() {
  loading.value = true
  try {
    rows.value = await api.user.adminList({ ...filter })
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

function resetFilter() {
  filter.keyword = ''
  filter.accountStatus = 'all'
  search()
}

/* ------------------------------ 行内操作 ------------------------------ */

/** UM-03 / UM-04：已注销账号不可重置密码、不可切换角色 */
function rowLocked(row: AdminUserItem): boolean {
  return row.deactivated
}

/** 失效行视觉弱化：已注销账号行置灰（16 号 C-5 / §6.5.3，不用整体 opacity） */
function rowClassName({ row }: { row: AdminUserItem }): string {
  return row.deactivated ? 'row-disabled' : ''
}

/** 切换角色按钮的禁用原因（可禁用有两种原因，提示要说清是哪一种） */
function roleDisabledReason(row: AdminUserItem): string {
  if (row.deactivated) return Copy.accountDeactivated
  if (row.isSelf) return Copy.cannotCancelOwnAdmin
  return ''
}

/** UM-05：不允许对自己切换角色（管理员把自己降级会让平台失去管理员） */
function roleDisabled(row: AdminUserItem): boolean {
  return rowLocked(row) || row.isSelf
}

function openReset(row: AdminUserItem) {
  resetTarget.value = row
  resetForm.password = ''
  resetDialogVisible.value = true
}

async function submitReset() {
  const target = resetTarget.value
  if (!target) return
  if (!resetForm.password) {
    ElMessage.error('请填写新密码')
    return
  }
  try {
    await api.user.adminResetPassword(target.id, resetForm.password)
    resetDialogVisible.value = false

    // UM-06：该用户全部会话失效。若重置的正是自己，本机会话也一起作废 → 立即登出
    if (target.isSelf) {
      userStore.clearLocalSession()
      ElMessage.success('密码已重置，你的登录会话已失效，请重新登录')
      // 带上 expired 标记，登录页会给出「登录已失效，请重新登录」的固定提示（13 号 §9.5）
      void router.push({ path: '/login', query: { expired: '1' } })
      return
    }
    ElMessage.success(`已重置 ${target.username} 的密码，该用户的登录会话已全部失效`)
    await load()
  } catch (e) {
    ElMessage.error((e as Error).message)
  }
}

function openRole(row: AdminUserItem) {
  roleTarget.value = row
  roleDialogVisible.value = true
}

async function submitRole() {
  const target = roleTarget.value
  if (!target) return
  try {
    const next = await api.user.adminSwitchRole(target.id)
    roleDialogVisible.value = false
    ElMessage.success(
      `${target.username} 已切换为${RoleTypeLabel[next]}；对方重新登录后生效`,
    )
    await load()
  } catch (e) {
    ElMessage.error((e as Error).message)
  }
}

function viewProfile(row: AdminUserItem) {
  void router.push(`/u/${row.id}`)
}

function formatTime(value: string | null): string {
  return value ? new Date(value).toLocaleString('zh-CN') : '—'
}

/** 切换角色时给对方的提示文案（写清后果与生效时机） */
const roleConfirmText = computed(() => {
  const target = roleTarget.value
  if (!target) return ''
  const to = target.roleType === RoleType.ADMIN ? '普通用户' : '管理员'
  return `将把 ${target.username} 切换为「${to}」。角色在对方下次登录后生效，对方已登录的会话不受影响。`
})

onMounted(load)
</script>

<template>
  <div class="page">
    <div class="page-header">
      <div>
        <h2 class="page-title">用户账号管理</h2>
        <p class="page-desc">
          重置密码、切换角色都在这里做。账号注销只能本人操作，管理员代不了；
          已注销的账号能查到，但改不了。
        </p>
      </div>
    </div>

    <!-- 筛选区 -->
    <div class="filter-bar">
      <el-input
        v-model="filter.keyword"
        placeholder="按用户名搜索"
        style="width: 220px"
        clearable
        @keyup.enter="search"
      />
      <el-select v-model="filter.accountStatus" style="width: 160px">
        <el-option
          v-for="option in statusOptions"
          :key="option.value"
          :label="option.label"
          :value="option.value"
        />
      </el-select>
      <el-button type="primary" @click="search">查询</el-button>
      <el-button text @click="resetFilter">重置</el-button>
      <div class="filter-bar__spacer"></div>
      <span class="text-tip">共 {{ total }} 个账号</span>
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
        <el-table-column
          v-if="isVisible('username')"
          label="用户名"
          min-width="170"
          show-overflow-tooltip
        >
          <template #default="{ row }">
            <div class="user-cell">
              <span class="user-name">{{ row.username }}</span>
              <el-tag v-if="row.isSelf" size="small" type="warning" effect="plain">你自己</el-tag>
            </div>
          </template>
        </el-table-column>
        <!--
          列宽分配：**信息列一律用 min-width（弹性），只有「操作」列用固定 width**。
          EP 会把容器剩余宽度按各列 min-width 的比例分给弹性列；若只有一列是弹性的，
          它会独吞全部剩余宽度 —— 隐藏几列后就会出现「单列独宽 + 右侧挤成一团」。
          另外短内容列（手机号 / 时间 / 状态 / 角色）统一 align="center"，
          长文本列（用户名）保持左对齐，避免同一行里对齐方式混用。
        -->
        <el-table-column v-if="isVisible('phone')" label="手机号" min-width="140" align="center">
          <template #default="{ row }">
            <span class="mono-cell">{{ row.phone }}</span>
          </template>
        </el-table-column>
        <el-table-column
          v-if="isVisible('createTime')"
          label="注册时间"
          min-width="170"
          align="center"
        >
          <template #default="{ row }">
            <span class="mono-cell">{{ formatTime(row.createTime) }}</span>
          </template>
        </el-table-column>
        <el-table-column
          v-if="isVisible('deleteTime')"
          label="注销时间"
          min-width="170"
          align="center"
        >
          <template #default="{ row }">
            <span class="mono-cell text-sub">{{ formatTime(row.deleteTime) }}</span>
          </template>
        </el-table-column>
        <el-table-column
          v-if="isVisible('status')"
          label="账号状态"
          min-width="130"
          align="center"
        >
          <template #default="{ row }">
            <el-tag v-if="row.deactivated" size="small" type="danger" effect="light">已逻辑注销</el-tag>
            <el-tag v-else size="small" type="success" effect="light">正常</el-tag>
          </template>
        </el-table-column>
        <el-table-column v-if="isVisible('role')" label="角色" min-width="120" align="center">
          <template #default="{ row }">
            <el-tag
              size="small"
              :type="row.roleType === RoleType.ADMIN ? 'warning' : 'info'"
              effect="plain"
            >
              {{ RoleTypeLabel[row.roleType] }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column
          v-if="isVisible('actions')"
          label="操作"
          width="200"
          align="center"
          fixed="right"
        >
          <template #default="{ row }">
            <!--
              S1 置灰禁用态（13 号 §9.2）：
              - 已注销账号：两个操作都不可用，tooltip 说明「该账号已注销，不可操作」
              - 自己：不允许取消自己的管理员角色
              操作列层级：行内操作**一律文字按钮**，只用**字色**区分主次
              （主操作 = 主色文字，次要 = 常规文字）—— 实心按钮留给页面级主动作。
              原先「重置密码」是实心主按钮，导致每行一个蓝色实心块、且与旁边的
              主色文字按钮「切换角色」形成两种层级，视觉过重。
            -->
            <el-tooltip
              :content="Copy.accountDeactivated"
              :disabled="!rowLocked(row)"
              placement="top"
            >
              <span class="action-guard">
                <el-button
                  size="small"
                  text
                  type="primary"
                  :disabled="rowLocked(row)"
                  @click="openReset(row)"
                >
                  重置密码
                </el-button>
              </span>
            </el-tooltip>

            <el-tooltip
              :content="roleDisabledReason(row)"
              :disabled="!roleDisabled(row)"
              placement="top"
            >
              <span class="action-guard">
                <el-button size="small" text :disabled="roleDisabled(row)" @click="openRole(row)">
                  切换角色
                </el-button>
              </span>
            </el-tooltip>

            <el-dropdown trigger="click">
              <el-button size="small" text class="more-btn">
                更多<Icon icon="ph:caret-down" class="more-icon" />
              </el-button>
              <template #dropdown>
                <el-dropdown-menu>
                  <el-dropdown-item @click="viewProfile(row)">查看用户主页</el-dropdown-item>
                </el-dropdown-menu>
              </template>
            </el-dropdown>
          </template>
        </el-table-column>
        <template #empty>
          <div class="empty-hint">没有符合条件的账号，试试调整筛选条件</div>
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
      重置密码会让该用户的<b>所有登录会话立即失效</b>，对方必须重新登录；
      切换角色只改数据库里的角色，<b>对方下次登录才生效</b>，当前会话不受影响。
    </div>

    <!-- 重置密码 -->
    <el-dialog v-model="resetDialogVisible" title="重置密码" width="460px">
      <div v-if="resetTarget" class="rule-tip warn mb16">
        将重置 <b>{{ resetTarget.username }}</b> 的密码。执行后该用户的<b>全部登录会话立即失效</b>，
        必须用新密码重新登录。
      </div>
      <el-form label-position="top" @submit.prevent="submitReset">
        <el-form-item label="新密码">
          <el-input
            v-model="resetForm.password"
            type="password"
            show-password
            placeholder="密码无复杂度限制，填写后告知用户"
            @keyup.enter="submitReset"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="resetDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="submitReset">确认重置</el-button>
      </template>
    </el-dialog>

    <!-- 切换角色（二次确认，写清后果与生效时机） -->
    <el-dialog v-model="roleDialogVisible" title="切换角色" width="460px">
      <p class="role-confirm">{{ roleConfirmText }}</p>
      <template #footer>
        <el-button @click="roleDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="submitRole">确认切换</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.table-panel {
  padding: 0;
  overflow: hidden;
}

.user-cell {
  display: flex;
  align-items: center;
  gap: var(--ql-s1);
}

.user-name {
  font-weight: 500;
  color: var(--ql-title);
}

/* 手机号与时间列使用等宽数字，纵向对齐 */
.mono-cell {
  font-variant-numeric: tabular-nums;
  color: var(--ql-text);
}

/* 禁用按钮的 tooltip 触发器需要能接收 hover（disabled 元素不派发事件） */
.action-guard {
  display: inline-flex;
}

.more-btn {
  color: var(--ql-text);
  padding: 0 4px;
}

.more-icon {
  margin-left: 2px;
  font-size: 12px;
}

.role-confirm {
  margin: 0;
  font-size: var(--ql-fs-body);
  line-height: 1.7;
  color: var(--ql-text);
}
</style>
