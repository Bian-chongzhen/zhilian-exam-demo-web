/**
 * 游客写操作的统一登录引导
 *
 * 依据《13、知练题库 v0.5 需求规格文档.md》§4.3 / §4.4 方式A：
 *   游客触发任何写操作 → 弹窗「请登录后执行该操作」→ 确定后跳登录页 → 登录成功回跳原页面。
 *
 * 这是**全系统唯一的禁写引导入口**（§5.3 第 3 条要求权限判断收口，禁止各页各写一套）。
 * 页面只负责把控件置灰并调用 `promptLogin`，不要自己拼提示文案与跳转逻辑。
 */
import { ElMessageBox } from 'element-plus'
import { useRoute, useRouter } from 'vue-router'
import { Copy } from '@/constants/copy'

export function useLoginPrompt() {
  const router = useRouter()
  const route = useRoute()

  /** 弹出登录引导；用户取消则静默返回 false */
  async function promptLogin(): Promise<boolean> {
    try {
      await ElMessageBox.confirm(Copy.loginRequired, '需要登录', {
        confirmButtonText: '去登录',
        cancelButtonText: '取消',
        type: 'info',
      })
    } catch {
      return false
    }
    // 带 redirect 回跳：登录成功后回到触发操作前的页面（守卫与登录页均已支持）
    await router.push({ path: '/login', query: { redirect: route.fullPath } })
    return true
  }

  return { promptLogin }
}
