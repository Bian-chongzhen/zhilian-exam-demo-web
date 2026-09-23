<script setup lang="ts">
import { computed, nextTick, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { api, ApiError } from '@/api'
import { ApiCode } from '@/constants/apiCodes'
import {
  DraftStatus,
  DraftStatusLabel,
  FavoriteTargetType,
  PaperTypeLabel,
  QuestionTypeLabel,
  VisibilityLabel,
} from '@/constants/enums'
import { Copy } from '@/constants/copy'
import { useUserStore } from '@/stores/user'
import { useStartExam } from '@/composables/useStartExam'
import { useLoginPrompt } from '@/composables/useLoginPrompt'
import type { DraftDetail } from '@/types/models'
import QuestionContent from '@/components/QuestionContent.vue'
import NoPermissionBlock from '@/components/NoPermissionBlock.vue'
import GuestGuard from '@/components/GuestGuard.vue'
import FavoriteButton from '@/components/FavoriteButton.vue'
import QuestionReportDialog from '@/components/QuestionReportDialog.vue'

const route = useRoute()
const router = useRouter()
const userStore = useUserStore()
const { resumeUnfinishedIfAny } = useStartExam()
const { promptLogin } = useLoginPrompt()

const loading = ref(false)
const detail = ref<DraftDetail | null>(null)
const draftId = Number(route.params.id)

/**
 * S3 / S4：资源级权限被拒时**原地**渲染提示块，不再是「报错弹一下然后跳首页」。
 * 依据 13 号 §9.2：无权限 → S3；资源已删除 / 已废弃 → S4。
 */
const blocked = ref<null | { title: string; desc: string; icon: string }>(null)

/** Q11：从收藏跳转过来时高亮的题目 id（2.4 秒后自动取消高亮） */
const highlightQuestionId = ref(0)

/** 本人或管理员可查看参考答案；其他用户（含游客）仅能看到题干与选项（预览不含答案与解析） */
const showAnswer = computed(() => {
  if (!detail.value) return false
  return detail.value.draft.userId === userStore.userId || userStore.isAdmin
})

async function load() {
  loading.value = true
  blocked.value = null
  try {
    // 游客传 null（不是 0）：0 会被服务层当成一个不存在的用户 id
    detail.value = await api.draft.detail(draftId, userStore.viewerId)
  } catch (e) {
    const code = e instanceof ApiError ? e.code : ApiCode.GENERIC
    const message = (e as Error).message
    if (code === ApiCode.NO_PERMISSION) {
      blocked.value = {
        title: Copy.noPermission,
        desc: `${message}。私有试卷仅创建者本人可预览。`,
        icon: 'ph:lock-simple',
      }
    } else if (code === ApiCode.NOT_FOUND) {
      blocked.value = {
        title: Copy.resourceDeleted,
        desc: message,
        icon: 'ph:file-dashed',
      }
    } else {
      // 其他异常（数据问题等）仍需明确反馈，但不再静默跳首页
      ElMessage.error(message)
      blocked.value = {
        title: Copy.resourceDeleted,
        desc: message,
        icon: 'ph:warning-circle',
      }
    }
  } finally {
    loading.value = false
  }
}

async function startExam() {
  if (!detail.value) return
  if (userStore.isGuest) {
    void promptLogin()
    return
  }
  try {
    // 该试卷若已有未完成的答题记录，先让用户选「继续上次 / 重新开始」
    if (await resumeUnfinishedIfAny(detail.value.draft)) return
    await ElMessageBox.confirm(
      `将基于《${detail.value.draft.draftName}》生成一份独立的答题记录，是否开始？`,
      '开始答题',
      { confirmButtonText: '开始答题', cancelButtonText: '取消' },
    )
    const exam = await api.exam.start(userStore.userId, detail.value.draft.id)
    router.push(`/exam/${exam.id}`)
  } catch (e) {
    if (e !== 'cancel') ElMessage.error((e as Error).message)
  }
}

onMounted(async () => {
  await load()
  await locateQuestionFromQuery()
})

/**
 * v1-plus 模块3（Q11 已定案）：按 `?questionId=` 定位并高亮该题
 * 入口是「我的收藏 → 收藏的题目」，避免用户进页面后自己翻找。
 */
async function locateQuestionFromQuery() {
  const qid = Number(route.query.questionId)
  if (!qid || !detail.value) return
  if (!detail.value.questions.some((q) => q.question.id === qid)) return
  await nextTick()
  const el = document.getElementById(`draft-question-${qid}`)
  if (!el) return
  // 16 号 §7 H-5：遵循系统「减弱动态效果」设置
  const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
  el.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'center' })
  highlightQuestionId.value = qid
  window.setTimeout(() => {
    highlightQuestionId.value = 0
  }, 2400)
}
</script>

<template>
  <div v-loading="loading" class="page">
    <!-- S3 / S4：资源不可访问时原地提示（URL 不变） -->
    <NoPermissionBlock
      v-if="blocked"
      :title="blocked.title"
      :desc="blocked.desc"
      :icon="blocked.icon"
    />

    <template v-else-if="detail">
      <div class="page-header">
        <div>
          <h2 class="page-title">{{ detail.draft.draftName }}</h2>
          <p class="page-desc">
            {{ detail.category.categoryName }} ·
            {{ PaperTypeLabel[detail.draft.paperType] }} ·
            共 {{ detail.questions.length }} 题 ·
            创建者
            <el-link type="primary" @click="router.push(`/u/${detail.draft.userId}`)">
              {{ detail.owner.username }}
            </el-link>
          </p>
        </div>
        <div class="page-actions">
          <el-button text @click="router.back()">返回</el-button>
          <!-- v1-plus 模块3：公开试卷详情页的收藏入口（私有试卷不提供收藏） -->
          <FavoriteButton
            v-if="detail.draft.visibility === 2"
            :target-type="FavoriteTargetType.DRAFT"
            :target-id="detail.draft.id"
          />
          <el-button
            v-if="detail.canEdit"
            @click="router.push(`/drafts/${detail.draft.id}/edit`)"
          >
            编辑试卷
          </el-button>
          <!-- S1：游客置灰 + tooltip「登录后可用」+ 点击弹登录（13 号 §9.2 S1 / §4.4 方式A） -->
          <GuestGuard v-if="detail.draft.draftStatus === DraftStatus.ENABLED">
            <el-button
              type="primary"
              :disabled="userStore.isGuest"
              @click="startExam"
            >
              开始答题
            </el-button>
          </GuestGuard>
        </div>
      </div>

      <div class="ql-panel">
        <div class="ql-panel__head">
          <span class="ql-panel__title">试卷信息</span>
          <span class="ql-panel__extra">试卷预览展示当前版本的题目与排序</span>
        </div>
        <div class="info-strip info-strip--2col">
          <div class="info-strip__item">
            <span class="info-strip__label">试卷状态</span>
            <el-tag
              :type="detail.draft.draftStatus === 1 ? 'success' : detail.draft.draftStatus === 2 ? 'info' : 'danger'"
              size="small"
              effect="light"
            >
              {{ DraftStatusLabel[detail.draft.draftStatus] }}
            </el-tag>
          </div>
          <div class="info-strip__item">
            <span class="info-strip__label">可见性</span>
            <span class="info-strip__value">{{ VisibilityLabel[detail.draft.visibility] }}</span>
          </div>
          <div class="info-strip__item">
            <span class="info-strip__label">锁定状态</span>
            <el-tag v-if="detail.draft.isLocked === 1" type="warning" size="small" effect="light">已锁定</el-tag>
            <el-tag v-else type="info" size="small" effect="plain">未锁定</el-tag>
          </div>
          <div class="info-strip__item">
            <span class="info-strip__label">首次启用时间</span>
            <span class="info-strip__value">
              {{ detail.draft.enableTime ? new Date(detail.draft.enableTime).toLocaleString('zh-CN') : '—' }}
            </span>
          </div>
        </div>
      </div>

      <div v-if="!showAnswer" class="rule-tip warn mb24">
        当前为<b>公开试卷预览</b>：仅展示题干与选项，<b>不展示参考答案与解析</b>（对应设计决策 Q21）。
      </div>
      <div v-else-if="detail.lockedQuestionCount > 0" class="rule-tip mb24">
        本试卷有 <b>{{ detail.lockedQuestionCount }}</b> 道题目的内容已被锁定，不可修改；考点标签仍可调整。
      </div>

      <div class="question-list">
        <div
          v-for="item in detail.questions"
          :key="item.relId"
          :id="`draft-question-${item.question.id}`"
          class="ql-panel question-card"
          :class="{ 'is-highlighted': highlightQuestionId === item.question.id }"
        >
          <div class="question-head">
            <div class="question-head__main">
              <span class="question-no">第 {{ item.sortNo }} 题</span>
              <el-tag size="small" effect="plain">{{ QuestionTypeLabel[item.question.questionType] }}</el-tag>
              <el-tag size="small" type="info" effect="plain">{{ item.score }} 分</el-tag>
              <el-tag v-if="item.question.isLocked === 1" size="small" type="warning" effect="light">
                已锁定
              </el-tag>
            </div>
            <div class="question-tags">
              <el-tag v-for="tag in item.tagNames" :key="tag" size="small" effect="plain">{{ tag }}</el-tag>
              <!-- v1-plus 模块4：题目报错入口（未登录置灰 + 登录引导） -->
              <QuestionReportDialog
                :question-id="item.question.id"
                :question-title="item.question.title"
              />
            </div>
          </div>

          <QuestionContent
            :title="item.question.title"
            :options="
              item.question.options ? JSON.parse(item.question.options) : []
            "
            :question-type="item.question.questionType"
            :answer="showAnswer ? item.question.answer : null"
            :score="item.score"
            :show-answer="showAnswer"
          />

          <div v-if="showAnswer && item.question.analysis" class="analysis">
            <span class="analysis__label">解析</span>{{ item.question.analysis }}
          </div>
        </div>

        <div v-if="detail.questions.length === 0" class="ql-panel empty-hint">
          本试卷暂无题目，可前往编辑页新增或从题库引用
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
/* 逐题卡片列表：卡片之间固定 16px 间距 */
.question-list {
  display: flex;
  flex-direction: column;
  gap: var(--ql-s2);
}

.question-list > .ql-panel {
  margin-bottom: 0;
}

.question-card {
  transition: box-shadow var(--ql-dur-fast) var(--ql-ease-spring);
}

.question-card:hover {
  box-shadow: var(--ql-shadow-hover);
}

/* Q11：从收藏跳转过来时短暂高亮目标题，2.4 秒后自动褪去 */
.question-card.is-highlighted {
  border-color: var(--ql-primary);
  box-shadow: 0 0 0 3px var(--ql-primary-soft);
}

/* 题头：题号 + 题型/分值/锁定标签，右侧考点标签 */
.question-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--ql-s2);
  padding-bottom: var(--ql-s2);
  margin-bottom: var(--ql-s2);
  border-bottom: 1px dashed var(--ql-border);
}

.question-head__main {
  display: flex;
  align-items: center;
  gap: var(--ql-s1);
  flex-wrap: wrap;
}

.question-no {
  font-size: var(--ql-fs-body);
  font-weight: 600;
  color: var(--ql-title);
}

.question-tags {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}

/* 解析：浅底块，与题干区分离 */
.analysis {
  margin-top: var(--ql-s2);
  padding: 10px var(--ql-s2);
  background: var(--ql-surface-soft);
  border: 1px solid var(--ql-border-light);
  border-radius: var(--ql-radius-sm);
  font-size: var(--ql-fs-small);
  line-height: 1.75;
  color: var(--ql-text);
}

.analysis__label {
  display: inline-block;
  margin-right: 6px;
  padding: 1px 6px;
  border-radius: var(--ql-radius-sm);
  background: var(--ql-primary-soft);
  color: var(--ql-primary);
  font-size: var(--ql-fs-tip);
  font-weight: 500;
}
</style>
