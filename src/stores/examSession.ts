import { defineStore } from 'pinia'
import { QuestionType } from '@/constants/enums'
import { api } from '@/api'
import type { ExamDetail, ExamQuestionItem } from '@/types/models'
import { joinMulti, splitMulti } from '@/mock/rules/judge'
import { getExamPositions, removeExamPosition, setExamPosition } from '@/mock/db'

/**
 * 答题会话 store
 * - 本地作答缓冲 + 节流自动保存（对应技术方案 8.6 节）
 * - 交卷前统一校验
 */
export const useExamSessionStore = defineStore('examSession', {
  state: () => ({
    detail: null as ExamDetail | null,
    /** 本地作答缓冲：examQuestionId -> 作答值 */
    answers: {} as Record<number, string | null>,
    saving: {} as Record<number, boolean>,
    savedAt: {} as Record<number, string>,
    /** 节流窗口内「尚未落库」的小题（用于离开页面时的兜底写入） */
    unsaved: {} as Record<number, boolean>,
    submitting: false,
    currentIndex: 0,
  }),

  getters: {
    items: (state): ExamQuestionItem[] => state.detail?.items ?? [],
    total: (state) => state.detail?.items.length ?? 0,
    answeredCount: (state) =>
      (state.detail?.items ?? []).filter((item) => {
        const value = state.answers[item.examQuestionId]
        return typeof value === 'string' && value.trim().length > 0
      }).length,
    progress(state): number {
      const total = state.detail?.items.length ?? 0
      if (total === 0) return 0
      const answered = (state.detail?.items ?? []).filter((item) => {
        const value = state.answers[item.examQuestionId]
        return typeof value === 'string' && value.trim().length > 0
      }).length
      return Math.round((answered / total) * 100)
    },
    currentItem(state): ExamQuestionItem | null {
      return state.detail?.items[state.currentIndex] ?? null
    },
    /** 未作答题目（交卷前提示） */
    unanswered(state): ExamQuestionItem[] {
      return (state.detail?.items ?? []).filter((item) => {
        const value = state.answers[item.examQuestionId]
        return !(typeof value === 'string' && value.trim().length > 0)
      })
    },
    /** 练习型才展示即时反馈 */
    instantFeedback(state): boolean {
      return state.detail?.exam.paperType === 2 && !state.detail?.exam.submitTime
    },
  },

  actions: {
    async load(examId: number, userId: number) {
      this.detail = await api.exam.detail(examId, userId)
      const buffer: Record<number, string | null> = {}
      this.detail.items.forEach((item) => {
        buffer[item.examQuestionId] = item.userAnswer ?? null
      })
      this.answers = buffer
      // 续答：回到上次停留的题号；越界或没有记录时从第 1 题开始
      const total = this.detail.items.length
      const saved = getExamPositions()[String(examId)]
      this.currentIndex = typeof saved === 'number' && saved >= 0 && saved < total ? saved : 0
    },

    /** 选择/输入作答（单选、多选、判断共用） */
    setAnswer(examQuestionId: number, value: string | null) {
      this.answers[examQuestionId] = value
      this.unsaved[examQuestionId] = true
      this.scheduleSave(examQuestionId)
    },

    toggleMulti(examQuestionId: number, optionKey: string) {
      const current = splitMulti(this.answers[examQuestionId] ?? '')
      const next = current.includes(optionKey)
        ? current.filter((k) => k !== optionKey)
        : [...current, optionKey]
      this.setAnswer(examQuestionId, next.length > 0 ? joinMulti(next) : null)
    },

    /** 节流保存：同一小题在 800ms 内只落库一次 */
    scheduleSave(examQuestionId: number) {
      const timerKey = `__timer_${examQuestionId}`
      const store = this as unknown as Record<string, unknown>
      const existing = store[timerKey] as ReturnType<typeof setTimeout> | undefined
      if (existing) clearTimeout(existing)
      store[timerKey] = setTimeout(() => {
        void this.flush(examQuestionId)
      }, 800)
    },

    async flush(examQuestionId: number) {
      if (!this.detail?.editable) return
      const examId = this.detail.exam.id
      const userId = this.detail.exam.userId
      // 先捕获本次要落库的值再清标记；若 await 期间用户又改了答案，
      // setAnswer 会重新置位，不会漏写
      const value = this.answers[examQuestionId] ?? null
      this.unsaved[examQuestionId] = false
      this.saving[examQuestionId] = true
      try {
        const result = await api.exam.saveAnswer(examId, userId, examQuestionId, value)
        this.savedAt[examQuestionId] = new Date().toLocaleTimeString('zh-CN')
        // 练习型即时反馈：把最新判分状态回填到本地明细（不下发参考答案，避免作弊）
        const item = this.detail.items.find((i) => i.examQuestionId === examQuestionId)
        if (item) {
          item.judgeStatus = result.judgeStatus as typeof item.judgeStatus
          item.judgeResult = result.judgeResult as typeof item.judgeResult
          item.obtainedScore = result.obtainedScore
        }
      } catch (e) {
        /*
         * 保存失败的兜底：把该小题重新标记为「未落库」，下一个节流窗口会重试。
         * 典型场景：会话失效（例如管理员在后台重置了本人密码 → 全部会话作废，UM-06）。
         * 这里不弹提示：自动保存是每 800ms 一次的静默动作，弹窗会刷屏；
         * 交卷前的 flushAll() 会再次尝试，失败会由交卷流程统一报错。
         */
        this.unsaved[examQuestionId] = true
        console.warn('[exam-session] 自动保存失败，已标记待重试：', (e as Error).message)
      } finally {
        this.saving[examQuestionId] = false
      }
    },

    /** 交卷前把所有缓冲写入（避免节流窗口内丢失） */
    async flushAll() {
      if (!this.detail?.editable) return
      const ids = this.detail.items.map((item) => item.examQuestionId)
      for (const id of ids) {
        // eslint-disable-next-line no-await-in-loop
        await this.flush(id)
      }
    },

    /**
     * 只写入「节流窗口内尚未落库」的小题（通常 0~1 道）。
     * 供路由离开 / 页面隐藏时兜底：比 flushAll 快得多，不会明显拖慢跳转。
     */
    async flushPending() {
      if (!this.detail?.editable) return
      const ids = Object.keys(this.unsaved)
        .map((key) => Number(key))
        .filter((id) => this.unsaved[id])
      for (const id of ids) {
        // eslint-disable-next-line no-await-in-loop
        await this.flush(id)
      }
    },

    async submit() {
      if (!this.detail) throw new Error('答题会话不存在')
      this.submitting = true
      try {
        await this.flushAll()
        const result = await api.exam.submit(this.detail.exam.id, this.detail.exam.userId)
        // 已交卷，续答位置不再有意义
        removeExamPosition(this.detail.exam.id)
        return result
      } finally {
        this.submitting = false
      }
    },

    goTo(index: number) {
      if (!this.detail) return
      if (index < 0 || index >= this.detail.items.length) return
      this.currentIndex = index
      // 记忆续答位置：下次进入同一份答题记录时直接回到这一题
      setExamPosition(this.detail.exam.id, index)
      void this.flush(this.detail.items[this.currentIndex]?.examQuestionId ?? 0)
    },

    next() {
      this.goTo(this.currentIndex + 1)
    },

    prev() {
      this.goTo(this.currentIndex - 1)
    },

    reset() {
      this.detail = null
      this.answers = {}
      this.saving = {}
      this.savedAt = {}
      this.unsaved = {}
      this.currentIndex = 0
    },

    /** 该小题是否为简答题（v1 不判分） */
    isShortAnswer(examQuestionId: number): boolean {
      const item = this.detail?.items.find((i) => i.examQuestionId === examQuestionId)
      return item?.questionType === QuestionType.SHORT_ANSWER
    },
  },
})
