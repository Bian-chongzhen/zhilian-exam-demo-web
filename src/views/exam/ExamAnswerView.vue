<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { onBeforeRouteLeave, useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { JudgeResult, JudgeStatus, QuestionType } from '@/constants/enums'
import { useExamSessionStore } from '@/stores/examSession'
import { useUserStore } from '@/stores/user'
import QuestionContent from '@/components/QuestionContent.vue'

const route = useRoute()
const router = useRouter()
const userStore = useUserStore()
const session = useExamSessionStore()

const examId = Number(route.params.id)
const loading = ref(false)
const submitted = ref(false)

const current = computed(() => session.currentItem)
const isMulti = computed(() => current.value?.questionType === QuestionType.MULTIPLE)
const isShort = computed(() => current.value?.questionType === QuestionType.SHORT_ANSWER)
const currentAnswer = computed(() =>
  current.value ? session.answers[current.value.examQuestionId] ?? null : null,
)
/** 练习型即时反馈：展示对错（不泄露正确答案） */
const instantResult = computed(() => {
  if (!session.instantFeedback || !current.value) return null
  if (current.value.judgeStatus !== JudgeStatus.JUDGED) return null
  return current.value.judgeResult
})

async function load() {
  loading.value = true
  try {
    await session.load(examId, userStore.userId)
    if (session.detail?.exam.submitTime) {
      submitted.value = true
      router.replace(`/exam/${examId}/result`)
    }
  } catch (e) {
    ElMessage.error((e as Error).message)
    router.push('/')
  } finally {
    loading.value = false
  }
}

function selectSingle(key: string) {
  if (!current.value) return
  session.setAnswer(current.value.examQuestionId, key)
}

function toggleMulti(key: string) {
  if (!current.value) return
  session.toggleMulti(current.value.examQuestionId, key)
}

/** QuestionContent 选项点击的统一入口（单选 / 判断 / 多选共用） */
function onSelectOption(key: string) {
  if (isMulti.value) toggleMulti(key)
  else selectSingle(key)
}

function onShortInput(value: string) {
  if (!current.value) return
  session.setAnswer(current.value.examQuestionId, value || null)
}

async function submit() {
  const unanswered = session.unanswered.length
  try {
    await ElMessageBox.confirm(
      unanswered > 0
        ? `还有 ${unanswered} 道题未作答，未作答的客观题将判定为错误并计入准确率分母。确认交卷？`
        : '交卷后将不可再修改答案，确认交卷？',
      '交卷确认',
      { type: 'warning', confirmButtonText: '确认交卷' },
    )
  } catch {
    return
  }
  try {
    const result = await session.submit()
    const shortCount = result.pendingCount
    ElMessage.success(
      shortCount > 0
        ? `交卷成功：客观题已判分，${shortCount} 道简答题待判分（v1 请对照参考答案自评）`
        : '交卷成功',
    )
    router.push(`/exam/${examId}/result`)
  } catch (e) {
    ElMessage.error((e as Error).message)
  }
}

/** PC 端键盘优先交互：选项快捷键 + 左右切题 */
function onKeydown(event: KeyboardEvent) {
  const tag = (event.target as HTMLElement)?.tagName
  if (tag === 'TEXTAREA' || tag === 'INPUT') return
  const key = event.key.toUpperCase()
  if (key === 'ARROWRIGHT') {
    session.next()
    return
  }
  if (key === 'ARROWLEFT') {
    session.prev()
    return
  }
  if (!current.value) return
  if (isShort.value) return
  const option = current.value.options.find((o) => o.key.toUpperCase() === key)
  if (!option) return
  event.preventDefault()
  if (isMulti.value) toggleMulti(option.key)
  else selectSingle(option.key)
}

/**
 * 自动保存兜底
 * 保存是 800ms 节流：若在窗口内离开页面，定时器会随组件卸载作废，
 * 最后一次作答就丢了（对应《9、前端设计》已知取舍里那条）。
 * 这里补三条路径，都是「先把尚未落库的作答写掉」再走：
 *   ① 应用内路由跳转（onBeforeRouteLeave，会等待写入完成）
 *   ② 切到其他标签 / 最小化（visibilitychange → hidden，页面仍存活，异步能跑完）
 *   ③ 关闭或刷新标签页（pagehide，尽力而为）
 */
function flushPendingNow() {
  void session.flushPending()
}

function onVisibilityChange() {
  if (document.visibilityState === 'hidden') flushPendingNow()
}

onBeforeRouteLeave(async () => {
  await session.flushPending()
})

onMounted(() => {
  void load()
  window.addEventListener('keydown', onKeydown)
  document.addEventListener('visibilitychange', onVisibilityChange)
  window.addEventListener('pagehide', flushPendingNow)
})

onUnmounted(() => {
  window.removeEventListener('keydown', onKeydown)
  document.removeEventListener('visibilitychange', onVisibilityChange)
  window.removeEventListener('pagehide', flushPendingNow)
  session.reset()
})
</script>

<template>
  <div v-loading="loading" class="exam-page">
    <template v-if="session.detail">
      <!-- 顶部信息条：试卷信息 + 进度 + 交卷（固定可见） -->
      <div class="exam-bar">
        <div class="exam-bar-left">
          <div class="exam-title">{{ session.detail.exam.draftName }}</div>
          <div class="exam-meta">
            <el-tag size="small" effect="plain">{{ session.detail.exam.paperType === 1 ? '竞技型' : '练习型' }}</el-tag>
            <el-tag size="small" effect="plain" type="info">
              {{ session.detail.exam.sourceType === 2 ? '错题组卷' : '普通答题' }}
            </el-tag>
            <span class="text-sub">
              第 {{ session.detail.exam.attemptNo }} 次作答 · 共 {{ session.total }} 题 · 满分
              {{ session.detail.exam.totalScore ?? '—' }}
            </span>
          </div>
        </div>
        <div class="exam-bar-right">
          <div class="progress-box">
            <span class="text-tip">已作答 {{ session.answeredCount }} / {{ session.total }}</span>
            <el-progress :percentage="session.progress" :stroke-width="6" :show-text="false" />
          </div>
          <el-button type="primary" :loading="session.submitting" @click="submit">交卷</el-button>
        </div>
      </div>

      <div class="exam-body">
        <!-- 左侧题目导航 -->
        <aside class="exam-nav">
          <div class="nav-card">
            <div class="nav-head">
              <span class="nav-title">题目导航</span>
              <span class="text-tip">{{ session.answeredCount }}/{{ session.total }}</span>
            </div>
            <div class="nav-grid">
              <div
                v-for="(item, index) in session.items"
                :key="item.examQuestionId"
                class="nav-cell"
                :class="{
                  active: index === session.currentIndex,
                  answered: (session.answers[item.examQuestionId] ?? '').length > 0,
                }"
                @click="session.goTo(index)"
              >
                {{ index + 1 }}
              </div>
            </div>
            <div class="nav-legend">
              <span><i class="dot answered"></i>已作答</span>
              <span><i class="dot"></i>未作答</span>
            </div>
          </div>

          <div class="rule-tip" :class="{ warn: !session.instantFeedback }">
            <template v-if="session.instantFeedback">
              练习型：作答后立即反馈对错（仅用于提示，错题记账统一在交卷时结算）。
            </template>
            <template v-else>
              竞技型：作答过程中不展示任何判分信息，交卷后统一判分。
            </template>
          </div>
        </aside>

        <!-- 中间答题区：限制最大宽度，保证长题干阅读舒适 -->
        <section class="exam-content">
          <template v-if="current">
            <div class="question-card">
              <div class="question-head">
                <div class="question-index">
                  <span class="q-no">第 {{ session.currentIndex + 1 }} 题</span>
                  <el-tag size="small" effect="plain">{{ current.score }} 分</el-tag>
                  <el-tag v-if="isShort" size="small" type="info" effect="plain">简答 · v1 交卷后自评</el-tag>
                  <el-tag v-if="instantResult === JudgeResult.RIGHT" size="small" type="success">
                    回答正确
                  </el-tag>
                  <el-tag v-else-if="instantResult === JudgeResult.WRONG" size="small" type="danger">
                    回答错误
                  </el-tag>
                </div>
                <div class="save-state text-tip">
                  <template v-if="session.saving[current.examQuestionId]">
                    <el-icon class="is-loading"><Icon icon="ph:circle-notch" /></el-icon> 保存中…
                  </template>
                  <template v-else-if="session.savedAt[current.examQuestionId]">
                    <el-icon><Icon icon="ph:check" /></el-icon> 已保存 {{ session.savedAt[current.examQuestionId] }}
                  </template>
                </div>
              </div>

              <!-- 题干与选项统一由 QuestionContent 渲染：选中态经 user-answer 传入，
                   点击经 @select 回传；本页不再自行拼装选项，避免同一批选项渲染两遍 -->
              <QuestionContent
                :title="current.title"
                :options="current.options"
                :question-type="current.questionType"
                :user-answer="currentAnswer"
                :selectable="session.detail.editable"
                :show-answer="false"
                @select="onSelectOption"
              />

              <!-- 选项已在上方渲染，这里只保留多选规则提示与简答输入框 -->
              <div v-if="isMulti || isShort" class="answer-area">
                <div v-if="isMulti" class="hint">
                  多选题必须全部选对才算正确，错选、漏选均判定错误
                </div>
                <div v-else class="short-area">
                  <el-input
                    :model-value="currentAnswer ?? ''"
                    type="textarea"
                    :rows="8"
                    placeholder="请输入你的作答（v1 不会自动判分，交卷后可对照参考答案自评）"
                    @update:model-value="onShortInput"
                  />
                  <div class="rule-tip warn mt16">
                    简答题在 v1 <b>不调用 AI 判分</b>：不计分、不计入准确率、不进入错题集；
                    交卷后展示参考答案与解析供你自评。
                  </div>
                </div>
              </div>
            </div>
          </template>
        </section>
      </div>

      <!-- 底部固定操作栏 -->
      <div class="exam-actions">
        <el-button :disabled="session.currentIndex === 0" @click="session.prev()">
          <el-icon><Icon icon="ph:caret-left" /></el-icon>上一题
        </el-button>

        <div class="actions-center">
          <span class="text-tip">
            {{ session.currentIndex + 1 }} / {{ session.total }} · 快捷键 A/B/C/D 选择，← → 切题
          </span>
        </div>

        <el-button
          type="primary"
          :disabled="session.currentIndex >= session.total - 1"
          @click="session.next()"
        >
          下一题<el-icon><Icon icon="ph:caret-right" /></el-icon>
        </el-button>
      </div>
    </template>
  </div>
</template>

<style scoped>
/* 整页固定高度：导航与操作栏固定，仅中间答题区滚动 */
.exam-page {
  height: calc(100vh - var(--ql-header-h));
  display: flex;
  flex-direction: column;
  padding: var(--ql-s3) var(--ql-s4) 0;
  max-width: 1440px;
}

/* ---------------------------- 顶部信息条 ---------------------------- */
.exam-bar {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--ql-s3);
  background: var(--ql-surface);
  border: 1px solid var(--ql-border);
  border-radius: var(--ql-radius);
  box-shadow: var(--ql-shadow);
  padding: var(--ql-s2) var(--ql-s3);
  margin-bottom: var(--ql-s3);
}

.exam-title {
  font-size: var(--ql-fs-section);
  font-weight: 600;
  color: var(--ql-title);
  line-height: 1.5;
}

.exam-meta {
  display: flex;
  align-items: center;
  gap: var(--ql-s1);
  margin-top: 6px;
  font-size: var(--ql-fs-small);
}

.exam-bar-right {
  display: flex;
  align-items: center;
  gap: var(--ql-s3);
  flex-shrink: 0;
}

.progress-box {
  width: 160px;
}

/* ---------------------------- 主体 ---------------------------- */
.exam-body {
  flex: 1;
  display: flex;
  gap: var(--ql-s3);
  min-height: 0;
}

.exam-nav {
  width: 264px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  gap: var(--ql-s2);
  overflow: auto;
}

.nav-card {
  background: var(--ql-surface);
  border: 1px solid var(--ql-border);
  border-radius: var(--ql-radius);
  box-shadow: var(--ql-shadow);
  padding: var(--ql-s2);
}

.nav-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--ql-s2);
}

.nav-title {
  font-size: var(--ql-fs-body);
  font-weight: 600;
  color: var(--ql-title);
}

.nav-grid {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: var(--ql-s1);
}

.nav-cell {
  height: 34px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--ql-border);
  border-radius: var(--ql-radius-sm);
  background: var(--ql-surface);
  cursor: pointer;
  font-size: var(--ql-fs-small);
  color: var(--ql-text);
  transition: background-color var(--ql-dur-fast) var(--ql-ease-spring),
    border-color var(--ql-dur-fast) var(--ql-ease-spring),
    color var(--ql-dur-fast) var(--ql-ease-spring);
}

.nav-cell:hover {
  border-color: var(--ql-primary);
  color: var(--ql-primary);
}

.nav-cell.answered {
  background: var(--ql-primary-soft);
  border-color: var(--ql-primary-line);
  color: var(--ql-primary);
}

.nav-cell.active {
  background: var(--ql-primary);
  border-color: var(--ql-primary);
  color: var(--ql-on-primary);
  font-weight: 600;
}

.nav-legend {
  display: flex;
  gap: var(--ql-s2);
  margin-top: var(--ql-s2);
  font-size: var(--ql-fs-tip);
  color: var(--ql-muted);
}

.dot {
  display: inline-block;
  width: 10px;
  height: 10px;
  border-radius: 2px;
  border: 1px solid var(--ql-border);
  margin-right: 4px;
}

.dot.answered {
  background: var(--ql-primary-soft);
  border-color: var(--ql-primary-line);
}

/* 答题内容区：限制最大宽度，长题干阅读不累 */
.exam-content {
  flex: 1;
  min-width: 0;
  overflow: auto;
  padding-bottom: var(--ql-s3);
}

.question-card {
  max-width: 800px;
  margin: 0 auto;
  background: var(--ql-surface);
  border: 1px solid var(--ql-border);
  border-radius: var(--ql-radius);
  box-shadow: var(--ql-shadow);
  padding: var(--ql-s4);
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
}

.q-no {
  font-size: var(--ql-fs-body);
  font-weight: 600;
  color: var(--ql-title);
}

.save-state {
  display: flex;
  align-items: center;
  gap: 4px;
  white-space: nowrap;
}

/* ---------------------------- 作答区 ---------------------------- */
.answer-area {
  margin-top: var(--ql-s3);
}

/*
 * 单选 / 判断 / 多选的选项行已统一由 QuestionContent 渲染（含选择控件与「整块可点」），
 * 因此本页不再保留 .single-group / .option-radio / .option-key / .option-text 等自有选项样式。
 */

/* ---------------------------- 底部固定操作栏 ---------------------------- */
.exam-actions {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--ql-s2);
  padding: var(--ql-s2) 0;
  border-top: 1px solid var(--ql-border);
  background: var(--ql-bg);
}

.actions-center {
  flex: 1;
  text-align: center;
}
</style>
