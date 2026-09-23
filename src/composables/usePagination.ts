import { computed, ref, watch, type Ref } from 'vue'

/**
 * 列表分页（配合 Element Plus el-pagination 使用）
 *
 * 说明：Phase 1 为纯前端 Mock，数据量是演示规模，因此采用前端切片；
 * Phase 2 接入真实后端后，把 pagedList 换成服务端分页结果即可，页面用法不变。
 */
export function usePagination<T>(source: Ref<T[]>, initialPageSize = 10) {
  const currentPage = ref(1)
  /** 每页条数：用 ref 以支持用户切换每页大小 */
  const pageSize = ref(initialPageSize)

  const total = computed(() => source.value.length)
  const pageCount = computed(() => Math.max(1, Math.ceil(total.value / pageSize.value)))

  /** 当前页数据 */
  const pagedList = computed(() => {
    const start = (currentPage.value - 1) * pageSize.value
    return source.value.slice(start, start + pageSize.value)
  })

  /** 数据量变少时自动回退到最后一页，避免停留在空白页 */
  watch(pageCount, (count) => {
    if (currentPage.value > count) currentPage.value = count
  })

  /** 查询条件变化时调用，回到第一页 */
  function resetPage() {
    currentPage.value = 1
  }

  return { currentPage, pageSize, total, pageCount, pagedList, resetPage }
}
