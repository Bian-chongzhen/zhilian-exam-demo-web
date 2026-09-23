<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { api, ApiError } from '@/api'
import { ApiCode } from '@/constants/apiCodes'
import { Copy } from '@/constants/copy'
import { PaperTypeLabel, PrivacyTypeLabel, QuestionTypeLabel } from '@/constants/enums'
import { useUserStore } from '@/stores/user'
import type { ProfileView } from '@/types/models'
import AccuracyChart from '@/components/AccuracyChart.vue'
import NoPermissionBlock from '@/components/NoPermissionBlock.vue'
import { usePagination } from '@/composables/usePagination'
import { useStartExam } from '@/composables/useStartExam'
import { formatAccuracy } from '@/mock/rules/stat'

const route = useRoute()
const router = useRouter()
const userStore = useUserStore()
const { resumeUnfinishedIfAny } = useStartExam()

const loading = ref(false)
const profile = ref<ProfileView | null>(null)
/** S3 / S4：资源不可访问时原地提示（13 号 §9.2），不再「报错 + 跳首页」 */
const blocked = ref<null | { title: string; desc: string; icon: string }>(null)
const targetUserId = Number(route.params.userId)
const isSelf = computed(() => targetUserId === userStore.userId)

/**
 * 标签页激活状态
 * 显式受控：不依赖 Element Plus 2.14.6 才有的 default-value prop，
 * 避免依赖版本升级/回退时初始标签失效。
 */
const activeTab = ref('drafts')

/** 他人主页的三个列表同样需要分页，避免记录多时页面过长 */
const publicDraftSource = computed(() => profile.value?.publicDrafts ?? [])

/**
 * v1-plus：该用户的公开知识点
 * 与隐私设置**无关** —— 隐私管的是个人答题数据；知识点可见性由每篇自己的公开/私有决定。
 * 注销用户的公开知识点也照常展示（14 号 §4.4）。
 */
const publicKnowledgeSource = computed(() => profile.value?.publicKnowledge ?? [])
const examSource = computed(() => profile.value?.exams ?? [])
const wrongRecordSource = computed(() => profile.value?.wrongRecords ?? [])

// 三个分页器各自持有独立状态（尤其 pageSize 不能共用，否则切换每页条数会互相干扰）
const {
  currentPage: draftsPage,
  pageSize: draftsPageSize,
  total: draftsTotal,
  pagedList: pagedDrafts,
} = usePagination(publicDraftSource, 10)

const {
  currentPage: examsPage,
  pageSize: examsPageSize,
  total: examsTotal,
  pagedList: pagedExams,
} = usePagination(examSource, 10)

const {
  currentPage: wrongPage,
  pageSize: wrongPageSize,
  total: wrongTotal,
  pagedList: pagedWrongRecords,
} = usePagination(wrongRecordSource, 10)

/** v1-plus：公开知识点的分页（与其他列表同样独立） */
const {
  currentPage: knowledgePage,
  pageSize: knowledgePageSize,
  total: knowledgeTotal,
  pagedList: pagedKnowledge,
} = usePagination(publicKnowledgeSource, 10)

async function load() {
  loading.value = true
  blocked.value = null
  try {
    profile.value = await api.stat.profile(userStore.userId, targetUserId)
  } catch (e) {
    // S3 / S4：原地提示，不跳首页（13 号 §9.2；此前是「弹个错误再跳走」，用户不知道自己点了什么）
    const code = e instanceof ApiError ? e.code : ApiCode.GENERIC
    const message = (e as Error).message
    if (code === ApiCode.NOT_FOUND) {
      blocked.value = { title: Copy.resourceDeleted, desc: message, icon: 'ph:user-minus' }
    } else {
      blocked.value = { title: Copy.noPermission, desc: message, icon: 'ph:lock-simple' }
    }
  } finally {
    loading.value = false
  }
}

async function startExam(draft: { id: number; draftName: string }) {
  try {
    // 该试卷若已有未完成的答题记录，先让用户选「继续上次 / 重新开始」
    if (await resumeUnfinishedIfAny(draft)) return
    const exam = await api.exam.start(userStore.userId, draft.id)
    router.push(`/exam/${exam.id}`)
  } catch (e) {
    ElMessage.error((e as Error).message)
  }
}

onMounted(load)
</script>

<template>
  <div v-loading="loading" class="page page--column">
    <!-- S3 / S4：资源不可访问时原地提示（URL 不变） -->
    <NoPermissionBlock
      v-if="blocked"
      :title="blocked.title"
      :desc="blocked.desc"
      :icon="blocked.icon"
    />
    <template v-else-if="profile">
      <!-- ① 顶部身份条：扁平铺在页面底色上，不额外套卡片 -->
      <header class="identity">
        <el-avatar :size="56" class="identity__avatar">
          {{ profile.user.username.slice(0, 1).toUpperCase() }}
        </el-avatar>

        <div class="identity__meta">
          <div class="identity__name">
            <span>{{ profile.user.username }}</span>
            <el-tag v-if="profile.user.deleted !== 0" type="info" effect="plain" size="small">
              该用户已注销
            </el-tag>
            <el-tag v-else type="success" effect="plain" size="small">
              主页{{ PrivacyTypeLabel[profile.user.privacyType] }}
            </el-tag>
            <el-tag v-if="isSelf" type="primary" effect="plain" size="small">这是你自己</el-tag>
          </div>

          <p class="identity__bio text-body">
            {{ profile.user.profile || '（未填写个人简介）' }}
          </p>

          <div class="identity__sub text-tip">
            <span>注册于 {{ new Date(profile.user.createTime).toLocaleDateString('zh-CN') }}</span>
            <template v-if="!isSelf">
              <span class="identity__dot">·</span>
              <span>他人视角：仅可查看对方公开的内容</span>
            </template>
          </div>
        </div>

        <div v-if="isSelf" class="identity__actions">
          <el-button type="primary" @click="router.push('/profile')">去设置</el-button>
        </div>
      </header>

      <!-- ② 数据概览：仅本人或对方公开主页时可见 -->
      <section v-if="profile.canViewDetail" class="flat-section">
        <div class="flat-section__head">
          <h3 class="flat-section__title">数据概览</h3>
          <span class="flat-section__extra">客观题已判分口径 · 未作答过的分类自动隐藏</span>
        </div>

        <div class="stat-grid">
          <div class="stat-card">
            <div class="stat-value primary">
              {{ formatAccuracy(profile.accuracy?.globalAccuracy ?? null) }}
            </div>
            <div class="stat-label">全局总准确率</div>
          </div>
          <div class="stat-card">
            <div class="stat-value">{{ profile.accuracy?.judgedCount ?? 0 }}</div>
            <div class="stat-label">已判分作答数（分母）</div>
          </div>
          <div class="stat-card">
            <div class="stat-value ok">{{ profile.accuracy?.rightCount ?? 0 }}</div>
            <div class="stat-label">已判定答对</div>
          </div>
          <div class="stat-card">
            <div class="stat-value bad">
              {{ (profile.accuracy?.judgedCount ?? 0) - (profile.accuracy?.rightCount ?? 0) }}
            </div>
            <div class="stat-label">已判定答错</div>
          </div>
        </div>

        <AccuracyChart
          v-if="profile.accuracy && profile.accuracy.categories.length > 0"
          :categories="profile.accuracy.categories"
        />
        <div v-else class="empty-hint">暂无已判分作答</div>
      </section>

      <!-- 隐私态说明：文案保持原样 -->
      <el-alert
        v-if="!profile.canViewDetail"
        type="info"
        :closable="false"
        show-icon
        class="mb24"
        title="该用户设置了隐私模式"
        description="隐私模式下，他人仅能查看其发布的公开试卷，无法查看错题集、答题记录与准确率。"
      />

      <!-- ③ 内容标签页：公开试卷 / 公开知识点 / 答题记录 / 错题集 -->
      <!-- 后两者隐私态下隐藏；**公开知识点不隐藏**（公开知识点的可见性由每篇自己决定） -->
      <el-tabs v-model="activeTab" class="profile-tabs">
        <el-tab-pane label="公开试卷" name="drafts">
          <div class="tab-meta text-tip">共 {{ profile.publicDrafts.length }} 份公开试卷</div>
          <el-table :data="pagedDrafts" size="small">
            <el-table-column prop="draftName" label="试卷名称" min-width="240" show-overflow-tooltip />
            <el-table-column prop="categoryName" label="分类" width="140" />
            <el-table-column label="类型" width="100">
              <template #default="{ row }">{{ PaperTypeLabel[row.paperType] }}</template>
            </el-table-column>
            <el-table-column prop="questionCount" label="题量" width="80" align="center" />
            <el-table-column label="状态" width="90" align="center">
              <template #default="{ row }">
                <el-tag v-if="row.draftStatus === 1" type="success" size="small">启用</el-tag>
                <el-tag v-else type="info" size="small">停用</el-tag>
              </template>
            </el-table-column>
            <el-table-column label="操作" width="180" align="center">
              <template #default="{ row }">
                <el-button size="small" @click="router.push(`/drafts/${row.id}`)">预览</el-button>
                <el-button
                  v-if="row.draftStatus === 1"
                  size="small"
                  type="primary"
                  @click="startExam(row)"
                >
                  开始答题
                </el-button>
              </template>
            </el-table-column>
            <template #empty>
              <div class="empty-hint">该用户暂无公开试卷</div>
            </template>
          </el-table>

          <!-- 分页常驻（有数据即显示） -->
          <div v-if="draftsTotal > 0" class="tab-pager">
            <el-pagination
              v-model:current-page="draftsPage"
              v-model:page-size="draftsPageSize"
              :page-sizes="[10, 20, 50]"
              :total="draftsTotal"
              layout="total, sizes, prev, pager, next"
              background
            />
          </div>
        </el-tab-pane>

        <!-- v1-plus 模块1：该用户的公开知识点（隐私态下也展示，见 14 号 §4.4） -->
        <el-tab-pane label="公开知识点" name="knowledge">
          <div class="tab-meta text-tip">共 {{ publicKnowledgeSource.length }} 篇公开知识点</div>
          <el-table :data="pagedKnowledge" size="small">
            <el-table-column label="标题" min-width="260">
              <template #default="{ row }">
                <span class="knowledge-title" @click="router.push(`/knowledge/${row.id}`)">
                  {{ row.title }}
                </span>
              </template>
            </el-table-column>
            <el-table-column label="考点标签" min-width="180">
              <template #default="{ row }">
                <span v-if="row.tagNames.length === 0" class="text-tip">—</span>
                <span v-else class="text-sub">{{ row.tagNames.join('、') }}</span>
              </template>
            </el-table-column>
            <el-table-column label="更新时间" width="170">
              <template #default="{ row }">
                {{ row.updateTime ? new Date(row.updateTime).toLocaleDateString('zh-CN') : '—' }}
              </template>
            </el-table-column>
            <el-table-column label="操作" width="90" align="center">
              <template #default="{ row }">
                <el-button size="small" text type="primary" @click="router.push(`/knowledge/${row.id}`)">
                  查看
                </el-button>
              </template>
            </el-table-column>
            <template #empty>
              <div class="empty-hint">该用户暂无公开知识点</div>
            </template>
          </el-table>
          <div v-if="knowledgeTotal > 0" class="tab-pager">
            <el-pagination
              v-model:current-page="knowledgePage"
              v-model:page-size="knowledgePageSize"
              :page-sizes="[10, 20, 50]"
              :total="knowledgeTotal"
              layout="total, sizes, prev, pager, next"
              background
            />
          </div>
        </el-tab-pane>

        <el-tab-pane v-if="profile.canViewDetail" label="答题记录" name="exams">
          <div class="tab-meta text-tip">共 {{ profile.exams?.length ?? 0 }} 条答题记录</div>
          <el-table :data="pagedExams" size="small">
            <el-table-column prop="draftName" label="试卷" min-width="220" show-overflow-tooltip />
            <el-table-column prop="categoryName" label="分类" width="130" />
            <el-table-column label="得分" width="110" align="center">
              <template #default="{ row }">
                <span v-if="row.submitTime">{{ row.obtainedScore ?? 0 }} / {{ row.totalScore ?? 0 }}</span>
                <el-tag v-else size="small" type="warning" effect="plain">未交卷</el-tag>
              </template>
            </el-table-column>
            <el-table-column label="对 / 错 / 待判" width="140" align="center">
              <template #default="{ row }">
                {{ row.rightCount }} / {{ row.wrongCount }} / {{ row.pendingCount }}
              </template>
            </el-table-column>
            <el-table-column label="操作" width="100" align="center">
              <template #default="{ row }">
                <el-button
                  v-if="row.submitTime"
                  size="small"
                  link
                  type="primary"
                  @click="router.push(`/exam/${row.id}/result`)"
                >
                  详情
                </el-button>
              </template>
            </el-table-column>
            <template #empty>
              <div class="empty-hint">暂无答题记录</div>
            </template>
          </el-table>

          <!-- 分页常驻（有数据即显示） -->
          <div v-if="examsTotal > 0" class="tab-pager">
            <el-pagination
              v-model:current-page="examsPage"
              v-model:page-size="examsPageSize"
              :page-sizes="[10, 20, 50]"
              :total="examsTotal"
              layout="total, sizes, prev, pager, next"
              background
            />
          </div>
        </el-tab-pane>

        <el-tab-pane v-if="profile.canViewDetail" label="错题集" name="wrong-records">
          <div class="tab-meta text-tip">
            共 {{ profile.wrongRecords?.length ?? 0 }} 条 ·
            {{ isSelf ? '本人视角：含错题次数' : '他人视角：仅展示题干、作答与对错，不展示答案、解析与错题次数' }}
          </div>
          <el-table :data="pagedWrongRecords" size="small">
            <el-table-column label="题型" width="80">
              <template #default="{ row }">{{ QuestionTypeLabel[row.questionType] }}</template>
            </el-table-column>
            <el-table-column prop="title" label="题干" min-width="280" show-overflow-tooltip />
            <el-table-column prop="categoryName" label="分类" width="130" />
            <el-table-column label="错题次数" width="100" align="center">
              <template #default="{ row }">
                <span v-if="isSelf">{{ row.wrongCount }}</span>
                <span v-else class="text-sub">—</span>
              </template>
            </el-table-column>
            <el-table-column label="最近答错" width="170">
              <template #default="{ row }">
                {{ row.lastWrongTime ? new Date(row.lastWrongTime).toLocaleString('zh-CN') : '—' }}
              </template>
            </el-table-column>
            <template #empty>
              <div class="empty-hint">暂无错题</div>
            </template>
          </el-table>

          <!-- 分页常驻（有数据即显示） -->
          <div v-if="wrongTotal > 0" class="tab-pager">
            <el-pagination
              v-model:current-page="wrongPage"
              v-model:page-size="wrongPageSize"
              :page-sizes="[10, 20, 50]"
              :total="wrongTotal"
              layout="total, sizes, prev, pager, next"
              background
            />
          </div>
        </el-tab-pane>
      </el-tabs>
    </template>
  </div>
</template>

<style scoped>
/* 标签页内的分页条：右对齐，与表格留 16px 间距 */
.tab-pager {
  display: flex;
  justify-content: flex-end;
  padding-top: var(--ql-s2);
}

/* v1-plus：公开知识点标题可点进详情 */
.knowledge-title {
  color: var(--ql-title);
  cursor: pointer;
}

.knowledge-title:hover {
  color: var(--ql-primary);
}

/* 顶部身份条：不套卡片，用底部 1px 细线与后续分区拉开层级 */
.identity {
  display: flex;
  align-items: flex-start;
  gap: var(--ql-s2);
  padding-bottom: var(--ql-s3);
  margin-bottom: var(--ql-s3);
  border-bottom: 1px solid var(--ql-border);
}

.identity__avatar {
  flex-shrink: 0;
  background: var(--ql-primary-soft);
  border: 1px solid var(--ql-primary-soft-hover);
  color: var(--ql-primary);
  font-size: 22px;
  font-weight: 600;
}

.identity__meta {
  flex: 1;
  min-width: 0;
}

.identity__name {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: var(--ql-s1);
  font-size: var(--ql-fs-page);
  font-weight: 600;
  color: var(--ql-title);
  line-height: 1.4;
}

.identity__bio {
  max-width: 880px;
  margin-top: var(--ql-s1);
  line-height: 1.7;
  white-space: pre-wrap;
  word-break: break-word;
}

.identity__sub {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 6px;
}

.identity__dot {
  color: var(--ql-placeholder);
}

.identity__actions {
  flex-shrink: 0;
  padding-top: 4px;
}

/* 标签页：下划线贴合扁平风格，与上方细线保持同一视觉重量 */
.profile-tabs :deep(.el-tabs__header) {
  margin-bottom: var(--ql-s3);
}

.profile-tabs :deep(.el-tabs__nav-wrap::after) {
  height: 1px;
  background: var(--ql-border);
}

.profile-tabs :deep(.el-tabs__item) {
  color: var(--ql-text);
  transition: color var(--ql-dur-fast) var(--ql-ease-spring);
}

.profile-tabs :deep(.el-tabs__item.is-active) {
  font-weight: 600;
}

/* 标签页内的表格计数行 */
.tab-meta {
  margin-bottom: var(--ql-s1);
}
</style>
