<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { api } from '@/api'
import {
  DraftSourceTypeLabel,
  DraftStatus,
  DraftStatusLabel,
  PaperType,
  PaperTypeLabel,
  PaperTypeOptions,
  Visibility,
  VisibilityLabel,
} from '@/constants/enums'
import { useUserStore } from '@/stores/user'
import { usePagination } from '@/composables/usePagination'
import { useStartExam } from '@/composables/useStartExam'
import type { CategoryDetail, DraftListItem } from '@/types/models'

const router = useRouter()
const userStore = useUserStore()
const { resumeUnfinishedIfAny } = useStartExam()

const loading = ref(false)
const drafts = ref<DraftListItem[]>([])
const categories = ref<CategoryDetail[]>([])

/** 每页 10 条，避免试卷多时页面过长 */
const { currentPage, pageSize, total, pagedList } = usePagination(drafts)

const createVisible = ref(false)
const createForm = reactive({
  draftName: '',
  categoryId: null as number | null,
  paperType: PaperType.PRACTICE as number,
  visibility: Visibility.PRIVATE as number,
  randomOrder: 0,
})

const saveAsVisible = ref(false)
const saveAsTarget = ref<DraftListItem | null>(null)
const saveAsName = ref('')

const editVisible = ref(false)
const editTarget = ref<DraftListItem | null>(null)
const editForm = reactive({ draftName: '', categoryId: null as number | null, paperType: 2, visibility: 1, randomOrder: 0 })

async function load() {
  loading.value = true
  try {
    drafts.value = await api.draft.listMine(userStore.userId)
    categories.value = await api.category.list()
  } catch (e) {
    ElMessage.error((e as Error).message)
  } finally {
    loading.value = false
  }
}

function openCreate() {
  createForm.draftName = ''
  createForm.categoryId = categories.value[0]?.id ?? null
  createForm.paperType = PaperType.PRACTICE
  // 默认可见性按角色：管理员默认公开，普通用户默认私有（P0-12 决策）
  createForm.visibility = userStore.isAdmin ? Visibility.PUBLIC : Visibility.PRIVATE
  createForm.randomOrder = 0
  createVisible.value = true
}

async function submitCreate() {
  try {
    const draft = await api.draft.create(userStore.userId, {
      draftName: createForm.draftName,
      categoryId: createForm.categoryId as number,
      paperType: createForm.paperType as PaperType,
      visibility: createForm.visibility as Visibility,
      randomOrder: createForm.randomOrder,
    })
    ElMessage.success('试卷已创建（默认停用状态，可自由编辑）')
    createVisible.value = false
    router.push(`/drafts/${draft.id}/edit`)
  } catch (e) {
    ElMessage.error((e as Error).message)
  }
}

async function switchStatus(row: DraftListItem, target: DraftStatus) {
  try {
    if (target === DraftStatus.ENABLED) {
      await ElMessageBox.confirm(
        '启用后试卷将【永久锁定】：不可再编辑，其中未被锁定过的题目也会一并继承锁定。是否继续？',
        '启用试卷',
        { type: 'warning', confirmButtonText: '启用并锁定' },
      )
    }
    const result = await api.draft.switchStatus(row.id, userStore.userId, target)
    ElMessage.success(result.message)
    await load()
  } catch (e) {
    if (e === 'cancel') return
    ElMessage({
      type: 'error',
      message: (e as Error).message,
      duration: 6000,
      showClose: true,
      customClass: 'pre-wrap-message',
    })
  }
}

async function discard(row: DraftListItem) {
  try {
    await ElMessageBox.confirm(
      `删除后《${row.draftName}》将标记为废弃：你将不再看到它，管理员后台可审计，且不支持恢复。`,
      '删除试卷',
      { type: 'warning', confirmButtonText: '确认删除' },
    )
    await api.draft.discard(row.id, userStore.userId)
    ElMessage.success('试卷已废弃')
    await load()
  } catch (e) {
    if (e !== 'cancel') ElMessage.error((e as Error).message)
  }
}

function openSaveAs(row: DraftListItem) {
  saveAsTarget.value = row
  saveAsName.value = `${row.draftName}（副本）`
  saveAsVisible.value = true
}

async function submitSaveAs() {
  if (!saveAsTarget.value) return
  try {
    const draft = await api.draft.saveAs(saveAsTarget.value.id, userStore.userId, saveAsName.value)
    ElMessage.success('已另存为新的可编辑试卷')
    saveAsVisible.value = false
    router.push(`/drafts/${draft.id}/edit`)
  } catch (e) {
    ElMessage.error((e as Error).message)
  }
}

function openEdit(row: DraftListItem) {
  editTarget.value = row
  editForm.draftName = row.draftName
  editForm.categoryId = row.categoryId
  editForm.paperType = row.paperType
  editForm.visibility = row.visibility
  editForm.randomOrder = row.randomOrder
  editVisible.value = true
}

async function submitEdit() {
  if (!editTarget.value) return
  try {
    await api.draft.updateMeta(editTarget.value.id, userStore.userId, {
      draftName: editForm.draftName,
      categoryId: editForm.categoryId as number,
      paperType: editForm.paperType as PaperType,
      visibility: editForm.visibility as Visibility,
      randomOrder: editForm.randomOrder,
    })
    ElMessage.success('已保存')
    editVisible.value = false
    await load()
  } catch (e) {
    ElMessage.error((e as Error).message)
  }
}

async function startExam(row: DraftListItem) {
  try {
    // 该试卷若已有未完成的答题记录，先让用户选「继续上次 / 重新开始」
    if (await resumeUnfinishedIfAny(row)) return
    const exam = await api.exam.start(userStore.userId, row.id)
    router.push(`/exam/${exam.id}`)
  } catch (e) {
    ElMessage.error((e as Error).message)
  }
}

/** 更多操作下拉分发（避免操作列按钮过多导致横向溢出） */
function onMoreCommand(command: string, row: DraftListItem) {
  if (command === 'preview') return void router.push(`/drafts/${row.id}`)
  if (command === 'enable') return void switchStatus(row, DraftStatus.ENABLED)
  if (command === 'disable') return void switchStatus(row, DraftStatus.DISABLED)
  if (command === 'saveAs') return openSaveAs(row)
  if (command === 'meta') return openEdit(row)
  if (command === 'discard') return void discard(row)
}

const editableCount = computed(() => drafts.value.filter((d) => d.canEdit).length)

onMounted(load)
</script>

<template>
  <div class="page">
    <div class="page-header">
      <div>
        <h2 class="page-title">我的试卷</h2>
        <p class="page-desc">
          可编辑 <b>{{ editableCount }}</b> / {{ drafts.length }} 份。规则：仅【停用且未锁定】的试卷可编辑；
          <b>首次启用即永久锁定</b>，之后停用也不再开放编辑。
        </p>
      </div>
      <div class="page-actions">
        <el-button type="primary" @click="openCreate">新建试卷</el-button>
      </div>
    </div>

    <div class="ql-panel ql-panel--tight mb16">
      <div class="legend">
        <span class="legend-item"><i class="dot dot-locked"></i>已锁定：内容与分值不可再修改</span>
        <span class="legend-item"><i class="dot dot-editable"></i>未锁定：可编辑题目、分值与顺序</span>
        <span class="legend-item text-tip">启用后可用「另存为」生成新的可编辑试卷</span>
      </div>
    </div>

    <div class="ql-panel table-panel">
      <el-table v-loading="loading" :data="pagedList" row-key="id">
        <!--
          列宽分配：信息列一律 min-width（弹性，按比例吸收容器剩余宽度），只有「操作」列固定 width。
          此前只有「试卷名称」是弹性列，它独吞了全部剩余宽度（列宽撑到 600px+ 而内容是短文本），
          观感是「左列很宽、内容挤在左边」。
        -->
        <el-table-column label="试卷名称" min-width="260">
          <template #default="{ row }">
            <div class="draft-cell">
              <span
                class="draft-name"
                role="link"
                tabindex="0"
                @click="router.push(`/drafts/${row.id}`)"
                @keydown.enter.prevent="router.push(`/drafts/${row.id}`)"
              >{{ row.draftName }}</span>
              <span class="text-tip">
                {{ row.categoryName }} · {{ DraftSourceTypeLabel[row.sourceType] }}
              </span>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="试卷类型" min-width="120">
          <template #default="{ row }">
            <span class="type-chip" :class="row.paperType === 1 ? 'is-competitive' : 'is-practice'">
              {{ PaperTypeLabel[row.paperType] }}
            </span>
          </template>
        </el-table-column>
        <el-table-column label="状态" min-width="180">
          <template #default="{ row }">
            <div class="status-cell">
              <el-tag
                :type="row.draftStatus === 1 ? 'success' : row.draftStatus === 2 ? 'info' : 'danger'"
                size="small"
                effect="light"
              >
                {{ DraftStatusLabel[row.draftStatus] }}
              </el-tag>
              <el-tag v-if="row.isLocked === 1" type="warning" size="small" effect="light">已锁定</el-tag>
              <span class="text-tip">{{ VisibilityLabel[row.visibility] }}</span>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="题量" min-width="90" align="center">
          <template #default="{ row }">
            <span class="text-body">{{ row.questionCount }}</span>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="200" align="center">
          <template #default="{ row }">
            <!--
              主操作按钮统一 min-width（见 .op-main）：
              「编辑」(2 字) 与「开始答题」(4 字) 宽度不同，而操作列是居中布局，
              会让紧跟其后的「更多」在两类行之间左右错位。
            -->
            <el-button
              v-if="row.canEdit"
              class="op-main"
              size="small"
              type="primary"
              @click="router.push(`/drafts/${row.id}/edit`)"
            >
              编辑
            </el-button>
            <el-button
              v-else-if="row.draftStatus === DraftStatus.ENABLED"
              class="op-main"
              size="small"
              type="primary"
              @click="startExam(row)"
            >
              开始答题
            </el-button>
            <el-button
              v-else
              class="op-main"
              size="small"
              text
              @click="router.push(`/drafts/${row.id}`)"
            >
              预览
            </el-button>

            <el-dropdown class="more" @command="(cmd: string) => onMoreCommand(cmd, row)">
              <el-button size="small" text class="more-btn">
                更多<Icon icon="ph:caret-down" class="more-icon" />
              </el-button>
              <template #dropdown>
                <el-dropdown-menu>
                  <el-dropdown-item command="preview">
                    <el-icon><Icon icon="ph:eye" /></el-icon>预览题目
                  </el-dropdown-item>
                  <el-dropdown-item v-if="row.draftStatus !== DraftStatus.ENABLED" command="enable">
                    <el-icon><Icon icon="ph:play" /></el-icon>启用（永久锁定）
                  </el-dropdown-item>
                  <el-dropdown-item v-else command="disable">
                    <el-icon><Icon icon="ph:pause" /></el-icon>停用
                  </el-dropdown-item>
                  <el-dropdown-item command="saveAs">
                    <el-icon><Icon icon="ph:copy" /></el-icon>另存为新试卷
                  </el-dropdown-item>
                  <el-dropdown-item command="meta">
                    <el-icon><Icon icon="ph:pencil-simple" /></el-icon>修改基础信息
                  </el-dropdown-item>
                  <el-dropdown-item command="discard" divided>
                    <el-icon><Icon icon="ph:trash" /></el-icon>删除（废弃）
                  </el-dropdown-item>
                </el-dropdown-menu>
              </template>
            </el-dropdown>
          </template>
        </el-table-column>
        <template #empty>
          <div class="empty-hint">还没有试卷，点击右上角「新建试卷」开始创建</div>
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

    <!-- 新建试卷 -->
    <el-dialog v-model="createVisible" title="新建试卷" width="600px">
      <el-form label-position="top" class="dialog-form">
        <el-form-item label="试卷名称">
          <el-input v-model="createForm.draftName" placeholder="例如：软考程序员 · 上午客观题精选" />
        </el-form-item>
        <el-form-item label="试卷分类">
          <el-select v-model="createForm.categoryId" style="width: 100%">
            <el-option
              v-for="category in categories"
              :key="category.id"
              :label="category.categoryName"
              :value="category.id"
            />
          </el-select>
          <div class="hint">一份试卷只能归属一个分类</div>
        </el-form-item>
        <el-form-item label="试卷类型">
          <el-radio-group v-model="createForm.paperType">
            <el-radio-button v-for="option in PaperTypeOptions" :key="option.value" :value="option.value">
              {{ option.label }}
            </el-radio-button>
          </el-radio-group>
          <div class="hint">分类不绑定类型，需要手动选择</div>
        </el-form-item>
        <el-form-item label="可见性">
          <el-radio-group v-model="createForm.visibility">
            <el-radio-button :value="Visibility.PRIVATE">私有</el-radio-button>
            <el-radio-button :value="Visibility.PUBLIC">公开</el-radio-button>
          </el-radio-group>
          <div class="hint">默认值按角色：管理员默认公开、普通用户默认私有，创建后可自行切换</div>
        </el-form-item>
        <el-form-item label="题目乱序">
          <el-switch v-model="createForm.randomOrder" :active-value="1" :inactive-value="0" />
          <span class="hint hint--inline">开启后每次作答时打乱题目顺序</span>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button text @click="createVisible = false">取消</el-button>
        <el-button type="primary" @click="submitCreate">创建并去录题</el-button>
      </template>
    </el-dialog>

    <!-- 另存为 -->
    <el-dialog v-model="saveAsVisible" title="另存为新试卷" width="560px">
      <div class="rule-tip">
        另存为是"启用后不可编辑"的修正通道：会复制全部题目、顺序与分值，生成一份<b>全新的停用未锁定试卷</b>。
      </div>
      <el-form label-position="top" class="mt16 dialog-form">
        <el-form-item label="新试卷名称">
          <el-input v-model="saveAsName" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button text @click="saveAsVisible = false">取消</el-button>
        <el-button type="primary" @click="submitSaveAs">确定</el-button>
      </template>
    </el-dialog>

    <!-- 修改基础信息 -->
    <el-dialog v-model="editVisible" title="修改基础信息" width="560px">
      <el-form label-position="top" class="dialog-form">
        <el-form-item label="试卷名称">
          <el-input v-model="editForm.draftName" />
        </el-form-item>
        <el-form-item label="所属分类">
          <el-select v-model="editForm.categoryId" style="width: 100%">
            <el-option
              v-for="category in categories"
              :key="category.id"
              :label="category.categoryName"
              :value="category.id"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="试卷类型">
          <el-radio-group v-model="editForm.paperType">
            <el-radio-button v-for="option in PaperTypeOptions" :key="option.value" :value="option.value">
              {{ option.label }}
            </el-radio-button>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="可见性">
          <el-radio-group v-model="editForm.visibility">
            <el-radio-button :value="1">私有</el-radio-button>
            <el-radio-button :value="2">公开</el-radio-button>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="题目乱序">
          <el-switch v-model="editForm.randomOrder" :active-value="1" :inactive-value="0" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button text @click="editVisible = false">取消</el-button>
        <el-button type="primary" @click="submitEdit">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
/*
 * 对话框内表单（新建试卷 / 另存为 / 修改基础信息）的排版微调。
 * 说明文字的换行已由 global.css 的 `.el-form-item__content > .hint { flex-basis: 100% }`
 * 统一处理；这里只收紧 form-item 间距（EP 默认 18px → 16px，与 8px 栅格一致）
 * 并强化 label 的字色与字重，让「标签 / 控件 / 说明」三段层级分明。
 */
.dialog-form :deep(.el-form-item) {
  margin-bottom: var(--ql-s2);
}

.dialog-form :deep(.el-form-item:last-child) {
  margin-bottom: 0;
}

.dialog-form :deep(.el-form-item__label) {
  color: var(--ql-title);
  font-weight: 500;
  line-height: 1.5;
  padding-bottom: 6px;
}

.legend {
  display: flex;
  align-items: center;
  gap: var(--ql-s3);
  flex-wrap: wrap;
}

.legend-item {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: var(--ql-fs-small);
  color: var(--ql-text);
}

.dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  display: inline-block;
}

.dot-locked {
  background: var(--ql-warning);
}

.dot-editable {
  background: var(--ql-success);
}

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

.status-cell {
  display: flex;
  align-items: center;
  gap: 6px;
}

/* 类型胶囊 .type-chip 已收敛到 global.css §11（16 号 C-1），此处不再重复定义 */
/*
 * 操作列主操作按钮统一最小宽度。
 * 「编辑」(2 字) 与「开始答题」(4 字) 宽度不同，而操作列是居中布局 ——
 * 宽度差会让紧跟其后的「更多」在两类行之间左右错位（同一列里两种缩进）。
 */
.op-main {
  min-width: 84px;
}

.more {
  margin-left: var(--ql-s1);
}

.more-btn {
  color: var(--ql-text);
}

.more-icon {
  margin-left: 2px;
  font-size: 12px;
}
</style>
