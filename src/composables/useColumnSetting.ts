import { computed, ref, watch } from 'vue'
import { useUserStore } from '@/stores/user'

/** 列定义：`key` 是持久化用的稳定标识 */
export interface ColumnDef {
  /** 列唯一 key（用于持久化；改列标题不影响用户已保存的设置） */
  key: string
  /** 列标题（设置面板里显示给人看） */
  label: string
  /** 是否默认可见，默认 true */
  defaultVisible?: boolean
  /**
   * 锁定列：始终可见、设置面板里置灰不可取消。
   * 用于「操作」这类必须存在的列 —— 否则用户可能把自己锁在
   * 「一列都没有、也没有任何操作入口」的状态里。
   */
  locked?: boolean
}

/**
 * 表格列显隐设置（用户级持久化）
 *
 * 交互参考云效工作台的「列表设置」：表格工具栏的齿轮 → 勾选要显示哪些列。
 * 设置按**用户 + 页面**双重隔离并持久化到 localStorage，
 * 刷新、重开浏览器、同一浏览器切换账号后，各自保留自己的显示习惯。
 *
 * 设计取舍：
 *   1. **只做显隐，不做拖拽排序** —— 本系统每列的语义与宽度都已固定，
 *      排序收益低而实现成本高（云效那种拖拽 + 上下移动按钮是给可增删字段的场景）；
 *   2. **锁定列**不可隐藏（见 ColumnDef.locked）；
 *   3. 至少保留一列可见（防止用户把可隐藏列全部关掉后界面变空）；
 *   4. 存储的是**语义 key 列表**而非整个列定义，因此以后调整列标题、
 *      列宽甚至增删列都不会让用户已保存的设置失效（未知 key 自动忽略）。
 *
 * 存储键：`zhilian-demo-columns:{userId}:{pageKey}`
 *   - 它是 **UI 偏好**，不随「重置演示数据」清空（那清的是业务数据）
 */
export function useColumnSetting(pageKey: string, columns: ColumnDef[]) {
  const userStore = useUserStore()

  const storageKey = computed(
    () => `zhilian-demo-columns:${userStore.userId || 'guest'}:${pageKey}`,
  )

  /** 默认可见列：显式 defaultVisible !== false 的列 + 全部锁定列 */
  const defaults = columns
    .filter((column) => column.defaultVisible !== false || column.locked)
    .map((column) => column.key)

  const visibleKeys = ref<string[]>([...defaults])

  const hideableKeys = columns.filter((column) => !column.locked).map((column) => column.key)

  /** 从 localStorage 读取并做「与当前列定义求交集」的容错 */
  function load(): void {
    const fallback = [...defaults]
    try {
      const raw = localStorage.getItem(storageKey.value)
      if (!raw) {
        visibleKeys.value = fallback
        return
      }
      const saved: unknown = JSON.parse(raw)
      if (!Array.isArray(saved)) {
        visibleKeys.value = fallback
        return
      }
      const known = new Set(columns.map((column) => column.key))
      const lockedKeys = columns.filter((column) => column.locked).map((column) => column.key)
      const kept = saved.filter((key): key is string => typeof key === 'string' && known.has(key))
      // 锁定列始终补回（用户可能在某次旧版本里把它隐藏过）
      const merged = [...new Set([...kept, ...lockedKeys])]
      visibleKeys.value = merged.length > 0 ? merged : fallback
    } catch {
      // localStorage 不可用（隐私模式 / 配额满 / JSON 损坏）时静默降级为默认值
      visibleKeys.value = fallback
    }
  }

  /** 用户切换（登录/退出/换账号）时重新读取各自的设置 */
  watch(storageKey, load, { immediate: true })

  /** 变更即持久化；失败不打断交互（本次会话内依然生效） */
  watch(
    visibleKeys,
    (keys) => {
      try {
        localStorage.setItem(storageKey.value, JSON.stringify(keys))
      } catch {
        // 忽略写入失败
      }
    },
    { deep: true },
  )

  function isVisible(key: string): boolean {
    return visibleKeys.value.includes(key)
  }

  function toggle(key: string, visible: boolean): void {
    const column = columns.find((item) => item.key === key)
    if (!column || column.locked) return

    if (visible) {
      if (!visibleKeys.value.includes(key)) visibleKeys.value = [...visibleKeys.value, key]
      return
    }

    const next = visibleKeys.value.filter((item) => item !== key)
    // 至少保留一列可隐藏列可见，避免整表只剩锁定列而显得「空了」
    if (next.filter((item) => hideableKeys.includes(item)).length === 0) return
    visibleKeys.value = next
  }

  function reset(): void {
    visibleKeys.value = [...defaults]
  }

  return { visibleKeys, isVisible, toggle, reset }
}
