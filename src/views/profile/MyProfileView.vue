<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { api } from '@/api'
import { PrivacyType, PrivacyTypeLabel } from '@/constants/enums'
import { useUserStore } from '@/stores/user'
import type { AccuracyStat, ExamListItem } from '@/types/models'
import AccuracyChart from '@/components/AccuracyChart.vue'
import { formatAccuracy } from '@/mock/rules/stat'

const router = useRouter()
const userStore = useUserStore()

/** 分页标签：把「设置类」与「数据类」内容分开，避免一屏堆满卡片 */
const activeTab = ref<'profile' | 'security' | 'data'>('profile')

const loading = ref(false)
const accuracy = ref<AccuracyStat | null>(null)
const exams = ref<ExamListItem[]>([])
const pendingCount = ref(0)

const form = reactive<{ profile: string; privacyType: PrivacyType }>({
  profile: '',
  privacyType: PrivacyType.PRIVATE,
})
const passwordForm = reactive({ oldPassword: '', newPassword: '' })
const savingProfile = ref(false)

async function load() {
  loading.value = true
  try {
    await userStore.refresh()
    const user = userStore.user
    if (!user) return
    form.profile = user.profile ?? ''
    form.privacyType = user.privacyType
    accuracy.value = await api.stat.accuracy(user.id)
    exams.value = await api.exam.listMine(user.id)
    pendingCount.value = (await api.stat.pending(user.id)).pendingCount
  } catch (e) {
    ElMessage.error((e as Error).message)
  } finally {
    loading.value = false
  }
}

async function saveProfile() {
  savingProfile.value = true
  try {
    await api.user.updateProfile(userStore.userId, {
      profile: form.profile,
      privacyType: form.privacyType,
    })
    await userStore.refresh()
    ElMessage.success('主页设置已保存')
  } catch (e) {
    ElMessage.error((e as Error).message)
  } finally {
    savingProfile.value = false
  }
}

async function changePassword() {
  try {
    await api.user.changePassword(userStore.userId, passwordForm.oldPassword, passwordForm.newPassword)
    ElMessage.success('密码已修改')
    passwordForm.oldPassword = ''
    passwordForm.newPassword = ''
  } catch (e) {
    ElMessage.error((e as Error).message)
  }
}

async function deactivate() {
  try {
    const { value } = await ElMessageBox.prompt(
      '注销后：账号不可再登录、用户名的公开信息保留、私有试卷将失效、公开试卷继续可供他人使用。请输入登录密码确认。',
      '注销账号',
      { type: 'warning', inputPlaceholder: '登录密码', confirmButtonText: '确认注销' },
    )
    await userStore.deactivate(value)
    ElMessage.success('账号已注销（逻辑删除），本地会话已失效')
    router.push('/login')
  } catch (e) {
    if (e !== 'cancel' && e !== 'close') ElMessage.error((e as Error).message)
  }
}

onMounted(load)
</script>

<template>
  <div v-loading="loading" class="page page--column">
    <div class="page-header">
      <div>
        <h2 class="page-title">我的主页 / 账号设置</h2>
        <p class="page-desc">
          资料、隐私、账号安全都在这儿改；答题记录和全套数据设置去「我的数据」标签页。
        </p>
      </div>
    </div>

    <!-- 账号概要条 -->
    <div class="identity">
      <el-avatar :size="46" class="identity__avatar">
        {{ userStore.displayName.slice(0, 1).toUpperCase() }}
      </el-avatar>
      <div class="identity__meta">
        <div class="identity__name">
          <span>{{ userStore.displayName }}</span>
          <el-tag v-if="userStore.isAdmin" type="warning" size="small" effect="plain">管理员</el-tag>
          <el-tag type="info" size="small" effect="plain">
            {{ PrivacyTypeLabel[form.privacyType] }}主页
          </el-tag>
        </div>
        <div class="identity__sub text-tip">
          <span>手机号 {{ userStore.user?.phone || '—' }}</span>
          <span class="divider">·</span>
          <span>
            注册于
            {{
              userStore.user?.createTime
                ? new Date(userStore.user.createTime).toLocaleDateString('zh-CN')
                : '—'
            }}
          </span>
        </div>
      </div>
      <el-button text type="primary" @click="router.push(`/u/${userStore.userId}`)">
        预览他人眼中的我的主页
      </el-button>
    </div>

    <el-tabs v-model="activeTab" class="profile-tabs">
      <!-- ① 个人资料 -->
      <el-tab-pane label="个人资料" name="profile">
        <section class="flat-section">
          <div class="flat-section__head">
            <h3 class="flat-section__title">个人简介</h3>
            <span class="flat-section__extra">纯文本，可留空</span>
          </div>
          <el-input
            v-model="form.profile"
            type="textarea"
            :rows="4"
            maxlength="500"
            show-word-limit
            placeholder="简单介绍一下自己，会展示在你的主页上"
            class="profile-input"
          />
        </section>

        <section class="flat-section">
          <div class="flat-section__head">
            <h3 class="flat-section__title">账号隐私设置</h3>
            <span class="flat-section__extra">当前：{{ PrivacyTypeLabel[form.privacyType] }}</span>
          </div>
          <el-radio-group v-model="form.privacyType" class="privacy-group">
            <el-radio :value="PrivacyType.PRIVATE">
              隐私（他人仅能查看我发布的公开试卷）
            </el-radio>
            <el-radio :value="PrivacyType.PUBLIC">
              公开（额外展示错题集、答题记录与准确率）
            </el-radio>
          </el-radio-group>
          <div class="rule-tip">
            公开态下他人可见<b>题干、本人作答与对错结果</b>；
            <b>不展示</b>正确答案、解析与错题次数。注销账号不会改变此处配置。
          </div>
        </section>

        <div class="actions">
          <el-button type="primary" :loading="savingProfile" @click="saveProfile">保存设置</el-button>
        </div>
      </el-tab-pane>

      <!-- ② 账号安全 -->
      <el-tab-pane label="账号安全" name="security">
        <section class="flat-section">
          <div class="flat-section__head">
            <h3 class="flat-section__title">修改密码</h3>
            <span class="flat-section__extra">密码无复杂度与长度限制</span>
          </div>
          <el-form label-position="left" label-width="96px" class="narrow-form">
            <el-form-item label="原密码">
              <el-input v-model="passwordForm.oldPassword" type="password" show-password />
            </el-form-item>
            <el-form-item label="新密码">
              <el-input v-model="passwordForm.newPassword" type="password" show-password />
            </el-form-item>
            <div class="actions">
              <el-button @click="changePassword">修改密码</el-button>
              <span class="hint forgot-tip">
                忘记原密码？<router-link to="/forgot">用手机号 + 用户名找回</router-link>
              </span>
            </div>
          </el-form>
        </section>

        <section class="flat-section">
          <div class="flat-section__head">
            <h3 class="flat-section__title">注销账号</h3>
            <span class="flat-section__extra">逻辑删除 · 不可撤销</span>
          </div>
          <div class="rule-tip warn">
            注销后账号不可再登录；<b>私有试卷随账号失效</b>，<b>公开试卷继续保留</b>供其他用户使用；
            主页仍会展示历史答题记录与准确率，并标注「已注销」。
          </div>
          <div class="actions">
            <el-button type="danger" plain @click="deactivate">注销我的账号</el-button>
          </div>
        </section>
      </el-tab-pane>

      <!-- ③ 我的数据 -->
      <el-tab-pane label="我的数据" name="data">
        <section class="flat-section">
          <div class="flat-section__head">
            <h3 class="flat-section__title">准确率</h3>
            <span class="flat-section__extra">题级口径 · 仅统计已判分小题</span>
          </div>
          <div class="stat-grid">
            <div class="stat-card">
              <div class="stat-value primary">{{ formatAccuracy(accuracy?.globalAccuracy ?? null) }}</div>
              <div class="stat-label">全局总准确率</div>
            </div>
            <div class="stat-card">
              <div class="stat-value">{{ accuracy?.judgedCount ?? 0 }}</div>
              <div class="stat-label">已判分作答数（分母）</div>
            </div>
            <div class="stat-card">
              <div class="stat-value pending">{{ pendingCount }}</div>
              <div class="stat-label">待判分（简答，不计入）</div>
            </div>
          </div>
          <AccuracyChart
            v-if="accuracy && accuracy.categories.length > 0"
            :categories="accuracy.categories"
          />
          <div v-else class="empty-hint empty-hint--boxed">暂无已判分作答，先去公开试卷广场刷几道题</div>
        </section>

        <section class="flat-section">
          <div class="flat-section__head">
            <h3 class="flat-section__title">最近答题记录</h3>
            <el-link type="primary" :underline="false" @click="router.push('/records')">
              查看全部
            </el-link>
          </div>
          <el-table :data="exams.slice(0, 5)" size="small">
            <el-table-column prop="draftName" label="试卷" min-width="220" show-overflow-tooltip />
            <el-table-column label="得分" width="120" align="center">
              <template #default="{ row }">
                <span v-if="row.submitTime">{{ row.obtainedScore ?? 0 }} / {{ row.totalScore ?? 0 }}</span>
                <el-tag v-else size="small" type="warning" effect="light">未交卷</el-tag>
              </template>
            </el-table-column>
            <el-table-column label="状态" width="140" align="center">
              <template #default="{ row }">
                <span v-if="row.submitTime" class="text-sub">
                  对 {{ row.rightCount }} · 错 {{ row.wrongCount }}
                  <template v-if="row.pendingCount > 0"> · 待判 {{ row.pendingCount }}</template>
                </span>
                <span v-else class="text-sub">作答中</span>
              </template>
            </el-table-column>
            <el-table-column label="操作" width="100" align="center">
              <template #default="{ row }">
                <el-button
                  size="small"
                  link
                  type="primary"
                  @click="router.push(row.submitTime ? `/exam/${row.id}/result` : `/exam/${row.id}`)"
                >
                  {{ row.submitTime ? '回顾' : '继续' }}
                </el-button>
              </template>
            </el-table-column>
            <template #empty>
              <div class="empty-hint">还没有答题记录，去公开试卷广场选一份开始刷题</div>
            </template>
          </el-table>
        </section>
      </el-tab-pane>
    </el-tabs>
  </div>
</template>

<style scoped>
/* 账号概要条：不额外套卡片，用底部细线与其他内容分隔 */
.identity {
  display: flex;
  align-items: center;
  gap: var(--ql-s2);
  padding-bottom: var(--ql-s3);
  margin-bottom: var(--ql-s2);
  border-bottom: 1px solid var(--ql-border);
}

.identity__avatar {
  background: var(--ql-primary-soft);
  color: var(--ql-primary);
  font-weight: 600;
  font-size: 18px;
  flex-shrink: 0;
}

.identity__meta {
  flex: 1;
  min-width: 0;
}

.identity__name {
  display: flex;
  align-items: center;
  gap: var(--ql-s1);
  font-size: var(--ql-fs-section);
  font-weight: 600;
  color: var(--ql-title);
}

.identity__sub {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 4px;
}

.divider {
  color: var(--ql-placeholder);
}

/* 标签页：下划线贴合扁平风格 */
.profile-tabs :deep(.el-tabs__header) {
  margin-bottom: var(--ql-s3);
}

.profile-tabs :deep(.el-tabs__nav-wrap::after) {
  height: 1px;
  background: var(--ql-border);
}

.profile-tabs :deep(.el-tabs__item) {
  font-size: var(--ql-fs-body);
  color: var(--ql-text);
}

.profile-tabs :deep(.el-tabs__item.is-active) {
  font-weight: 600;
}

.profile-input {
  max-width: 720px;
}

.privacy-group {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: var(--ql-s1);
  margin-bottom: var(--ql-s2);
}

.narrow-form {
  max-width: 520px;
}

/* 「忘记原密码」引导：与按钮同行，抵消 .hint 的 margin-top 以免被压低 */
.forgot-tip {
  margin-top: 0;
}

.actions {
  display: flex;
  align-items: center;
  gap: var(--ql-s1);
  padding-top: var(--ql-s2);
}

.actions:first-child {
  padding-top: 0;
}
</style>
