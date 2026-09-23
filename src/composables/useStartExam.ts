import { ElMessage, ElMessageBox } from 'element-plus'
import { useRouter } from 'vue-router'
import { api } from '@/api'
import { useUserStore } from '@/stores/user'

/**
 * 「开始答题」前的未完成答题记录判断（各入口统一）
 *
 * 背景：同一份试卷可以存在多份答题记录（attemptNo 递增），而「开始答题」永远**新建**一份
 * （见 `mock/rules/exam.ts` 的 createExam）。若用户上次答到一半退出，再从列表点「开始答题」，
 * 会进入一份全新的空白记录，看起来像"上次的作答丢了"——实际上那份仍在「未完成答题记录」里，
 * 只是用户进错了另一份。
 *
 * 因此各入口在新建之前先探测同一试卷的未交卷记录：
 * - 命中 → 弹窗让用户选「继续上次作答 / 重新开始」，并由本函数完成跳转
 * - 未命中 → 返回 false，调用方继续走自己原有的「开始答题」二次确认
 *
 * 注：这里复用已有的 `api.exam.listUnsubmitted` 并在前端按 draftId 过滤，
 * 不新增 API 契约方法（Phase 2 换 axios 时无需新增后端接口）。
 */
export function useStartExam() {
  const router = useRouter()
  const userStore = useUserStore()

  /**
   * @returns true 表示已由本函数处理完毕（已跳转，或用户关掉了弹窗），调用方应立即 return；
   *          false 表示该试卷没有未交卷记录，调用方继续原有流程。
   */
  async function resumeUnfinishedIfAny(draft: { id: number; draftName: string }): Promise<boolean> {
    const unfinished = (await api.exam.listUnsubmitted(userStore.userId)).filter(
      (item) => item.draftId === draft.id,
    )
    if (unfinished.length === 0) return false

    // listUnsubmitted 已按时间倒序，取最近的一份
    const target = unfinished[0]
    const desc =
      unfinished.length > 1
        ? `还有 ${unfinished.length} 份未完成的答题记录，最近一份为第 ${target.attemptNo} 次作答（共 ${target.questionCount} 题）`
        : `还有一份未完成的答题记录（第 ${target.attemptNo} 次作答 · 共 ${target.questionCount} 题）`

    try {
      await ElMessageBox.confirm(
        `《${draft.draftName}》${desc}。继续上次作答，还是重新开始一份新的？`,
        '发现未完成的答题记录',
        {
          confirmButtonText: '继续上次作答',
          cancelButtonText: '重新开始',
          distinguishCancelAndClose: true,
          type: 'warning',
        },
      )
      // 确认 → 接着上次继续
      router.push(`/exam/${target.id}`)
    } catch (action) {
      // distinguishCancelAndClose 下：'cancel' = 点了「重新开始」，'close' = 关闭弹窗（什么都不做）
      if (action === 'cancel') {
        const exam = await api.exam.start(userStore.userId, draft.id)
        ElMessage.success(`已生成新的答题记录（第 ${exam.attemptNo} 次作答）`)
        router.push(`/exam/${exam.id}`)
      }
    }
    return true
  }

  return { resumeUnfinishedIfAny }
}
