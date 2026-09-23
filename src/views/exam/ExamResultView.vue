<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { api, type QuestionKnowledgeLink } from '@/api'
import { JudgeResult, JudgeStatus } from '@/constants/enums'
import { useUserStore } from '@/stores/user'
import type { ExamDetail } from '@/types/models'
import QuestionContent from '@/components/QuestionContent.vue'
import QuestionNotePanel from '@/components/QuestionNotePanel.vue'
import QuestionReportDialog from '@/components/QuestionReportDialog.vue'
import { formatAccuracy } from '@/mock/rules/stat'

const route = useRoute()
const router = useRouter()
const userStore = useUserStore()

const examId = Number(route.params.id)
const loading = ref(false)
const detail = ref<ExamDetail | null>(null)
const wrongStateMap = ref<Record<number, string>>({})
/** v1-plus 模块2：本人对本题的笔记（批量预取，questionId → 内容） */
const notes = ref<Record<number, string>>({})
/** v1-plus 模块1：题目关联的知识点（批量预取，questionId → 链接列表） */
const knowledgeLinks = ref<Record<number, QuestionKnowledgeLink[]>>({})

const summary = computed(() => {
  const items = detail.value?.items ?? []
  const judged = items.filter((i) => i.judgeStatus === JudgeStatus.JUDGED)
  const right = judged.filter((i) => i.judgeResult === JudgeResult.RIGHT).length
  const wrong = judged.filter((i) => i.judgeResult === JudgeResult.WRONG).length
  const pending = items.length - judged.length
  const answered = items.filter((i) => (i.userAnswer ?? '').trim().length > 0).length
  return {
    right,
    wrong,
    pending,
    answered,
    accuracy: judged.length > 0 ? right / judged.length : null,
  }
})

async function load() {
  loading.value = true
  try {
    detail.value = await api.exam.detail(examId, userStore.userId)
    if (!detail.value.exam.submitTime) {
      ElMessage.info('该答题记录尚未交卷，已跳转到答题页')
      router.replace(`/exam/${examId}`)
      return
    }
    // 标注每道题的错题集状态，便于验证"答错入错题集 / 答对移入已掌握"
    const exam = detail.value.exam
    const map: Record<number, string> = {}
    for (const item of detail.value.items) {
      const state = await api.wrong.state(userStore.userId, item.questionId, exam.categoryId)
      if (state.exists) {
        map[item.questionId] = state.isMaster === 1 ? '已掌握' : `错题集（错 ${state.wrongCount} 次）`
      }
    }
    wrongStateMap.value = map

    // v1-plus：批量预取「本人笔记」与「题目关联的知识点」，避免逐题请求
    const questionIds = detail.value.items.map((i) => i.questionId)
    notes.value = await api.note.list(userStore.userId, questionIds)
    knowledgeLinks.value = await api.knowledge.listByQuestions(questionIds, userStore.viewerId)
  } catch (e) {
    ElMessage.error((e as Error).message)
    router.push('/records')
  } finally {
    loading.value = false
  }
}

async function retrySameDraft() {
  if (!detail.value) return
  try {
    const exam = await api.exam.start(userStore.userId, detail.value.exam.draftId)
    ElMessage.success(`已生成新的答题记录（第 ${exam.attemptNo} 次作答）`)
    router.push(`/exam/${exam.id}`)
  } catch (e) {
    ElMessage.error((e as Error).message)
  }
}

onMounted(load)
</script>

<template>
  <div v-loading="loading" class="page">
    <template v-if="detail">
      <div class="page-header">
        <div>
          <h2 class="page-title">答题回顾：{{ detail.exam.draftName }}</h2>
          <p class="page-desc">
            {{ detail.exam.paperType === 1 ? '竞技型' : '练习型' }} ·
            {{ detail.exam.sourceType === 2 ? '错题组卷' : '普通答题' }} ·
            第 {{ detail.exam.attemptNo }} 次作答 ·
            交卷时间
            {{ detail.exam.submitTime ? new Date(detail.exam.submitTime).toLocaleString('zh-CN') : '—' }}
          </p>
        </div>
        <div class="page-actions">
          <el-button @click="router.push('/records')">答题记录</el-button>
          <el-button type="primary" @click="retrySameDraft">再做一次（二刷）</el-button>
        </div>
      </div>

      <div class="stat-grid">
        <div class="stat-card">
          <div class="stat-value primary">
            {{ detail.exam.obtainedScore ?? 0 }} / {{ detail.exam.totalScore ?? 0 }}
          </div>
          <div class="stat-label">实得分 / 满分</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">{{ formatAccuracy(summary.accuracy) }}</div>
          <div class="stat-label">客观题准确率</div>
        </div>
        <div class="stat-card">
          <div class="stat-value ok">{{ summary.right }}</div>
          <div class="stat-label">正确</div>
        </div>
        <div class="stat-card">
          <div class="stat-value bad">{{ summary.wrong }}</div>
          <div class="stat-label">错误</div>
        </div>
        <div class="stat-card">
          <div class="stat-value pending">{{ summary.pending }}</div>
          <div class="stat-label">待判分（简答）</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">{{ detail.exam.usedSeconds ?? '—' }}s</div>
          <div class="stat-label">用时</div>
        </div>
      </div>

      <div class="rule-tip mb24">
        统计口径：准确率为<b>题级</b>口径（正确题数 ÷ 已判分题数），仅统计<b>已判分</b>小题；简答题在 v1 待判分，
        <b>不计入分子与分母</b>，也不进入错题集。
      </div>

      <div class="section-title">逐题回顾（共 {{ detail.items.length }} 题）</div>

      <article v-for="item in detail.items" :key="item.examQuestionId" class="question-card">
        <header class="question-head">
          <div class="question-index">
            <span class="q-no">第 {{ item.sortNo }} 题</span>
            <el-tag size="small" type="info" effect="plain">{{ item.score }} 分</el-tag>
            <el-tag v-if="wrongStateMap[item.questionId]" size="small" type="warning" effect="plain">
              {{ wrongStateMap[item.questionId] }}
            </el-tag>
          </div>
          <div class="question-tags text-sub">
            <span v-if="item.tagNames.length > 0">考点：{{ item.tagNames.join(' / ') }}</span>
            <!-- v1-plus 模块4：题目报错入口（回顾页也能直接反馈） -->
            <QuestionReportDialog :question-id="item.questionId" :question-title="item.title" />
          </div>
        </header>

        <QuestionContent
          :title="item.title"
          :options="item.options"
          :question-type="item.questionType"
          :answer="item.answer"
          :user-answer="item.userAnswer"
          :judge-status="item.judgeStatus"
          :judge-result="item.judgeResult"
          :obtained-score="item.obtainedScore"
          :score="item.score"
          :show-answer="true"
        />

        <div v-if="item.questionType === 4" class="self-assess">
          <el-alert type="info" :closable="false" title="简答题自评（v1）">
            请对照上方参考答案自行判断对错。AI 判分将于后续版本开放，开放后本题将自动判分并纳入统计。
          </el-alert>
        </div>

        <div v-if="item.analysis" class="analysis">
          <span class="analysis-label">解析</span>
          <span class="analysis-text">{{ item.analysis }}</span>
        </div>

        <!-- v1-plus 模块1：题目关联的知识点（14 号 §4.2「回顾页每道题目下方展示关联知识点链接」） -->
        <div v-if="knowledgeLinks[item.questionId]?.length" class="knowledge-links">
          <span class="knowledge-links__label">关联知识点</span>
          <router-link
            v-for="link in knowledgeLinks[item.questionId]"
            :key="link.id"
            :to="`/knowledge/${link.id}`"
            class="knowledge-link"
          >
            {{ link.title }}
          </router-link>
        </div>

        <!-- v1-plus 模块2：题目私有笔记（折叠面板，未登录整块不渲染） -->
        <QuestionNotePanel
          :question-id="item.questionId"
          :initial-content="notes[item.questionId] ?? ''"
        />
      </article>
    </template>
  </div>
</template>

<style scoped>
/* 顶部统计：6 张卡片等宽自适应，窄屏自动收缩 */
.stat-grid {
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
}

.stat-card {
  transition: box-shadow var(--ql-dur-fast) var(--ql-ease-spring);
}

.stat-card:hover {
  box-shadow: var(--ql-shadow-hover);
}

/* 逐题回顾卡片：阅读留白 + 轻描边；同层不叠加阴影（层次由 --ql-bg 与纯白卡片的明度差建立） */
.question-card {
  background: var(--ql-surface);
  border: 1px solid var(--ql-border);
  border-radius: var(--ql-radius);
  padding: var(--ql-s3);
  margin-bottom: var(--ql-s2);
  transition: border-color var(--ql-dur-fast) var(--ql-ease-spring);
}

.question-card:hover {
  border-color: var(--ql-primary-line);
}

.question-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--ql-s2);
  padding-bottom: var(--ql-s2);
  margin-bottom: var(--ql-s2);
  border-bottom: 1px solid var(--ql-border-light);
}

.question-index {
  display: flex;
  align-items: center;
  gap: var(--ql-s1);
  flex-wrap: wrap;
}

.q-no {
  font-size: var(--ql-fs-section);
  font-weight: 600;
  color: var(--ql-title);
}

.question-tags {
  font-size: var(--ql-fs-tip);
  text-align: right;
}

.self-assess {
  margin-top: var(--ql-s2);
}

.analysis {
  margin-top: var(--ql-s2);
  padding: var(--ql-s2);
  background: var(--ql-surface-soft);
  border-radius: var(--ql-radius-sm);
  font-size: var(--ql-fs-small);
  line-height: 1.75;
  color: var(--ql-text);
}

.analysis-label {
  display: inline-block;
  margin-right: var(--ql-s1);
  font-weight: 600;
  color: var(--ql-title);
}

/* v1-plus 模块1：关联知识点链接行 */
.knowledge-links {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: var(--ql-s1);
  margin-top: var(--ql-s2);
  font-size: var(--ql-fs-small);
}

.knowledge-links__label {
  color: var(--ql-muted);
  font-size: var(--ql-fs-tip);
}

.knowledge-link {
  padding: 2px 10px;
  border: 1px solid var(--ql-primary-line);
  border-radius: 999px;
  background: var(--ql-primary-soft);
  color: var(--ql-on-primary-container);
  font-size: var(--ql-fs-tip);
  text-decoration: none;
  transition: border-color var(--ql-dur-fast) var(--ql-ease-spring);
}

.knowledge-link:hover {
  border-color: var(--ql-primary);
}
</style>
