<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import zhCn from 'element-plus/es/locale/lang/zh-cn'

/**
 * 窄屏提示
 *
 * 依据《6、技术选型与技术方案》5「PC 端交互约定」：
 *   最小宽度 1280px，低于该宽度给出明确提示
 * 与《8、页面布局设计》的硬性约束一致：仅 PC 端，不做移动端适配。
 *
 * 背景：body 被强制 `min-width: 1280px`。窗口比 1280px 窄时，整页会出现横向滚动条，
 * 右侧内容（含 `.page` 的右内边距）被推到视口之外，视觉上表现为"内容没有居中"。
 * 这里把这个既成事实明确告知用户，而不是静默裁切。
 */
const MIN_WIDTH = 1280

const viewportWidth = ref(typeof window === 'undefined' ? MIN_WIDTH : window.innerWidth)
const isNarrow = computed(() => viewportWidth.value < MIN_WIDTH)

function syncViewportWidth(): void {
  viewportWidth.value = window.innerWidth
}

onMounted(() => {
  syncViewportWidth()
  window.addEventListener('resize', syncViewportWidth)
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', syncViewportWidth)
})

/** 提示条出现时给 body 打标记，外壳整体下移，避免遮挡 header 与答题页导航 */
watch(
  isNarrow,
  (narrow) => {
    document.body?.classList.toggle('ql-narrow', narrow)
  },
  { immediate: true },
)
</script>

<template>
  <el-config-provider :locale="zhCn">
    <div v-if="isNarrow" class="narrow-tip" role="alert">
      <Icon icon="ph:warning-circle" class="narrow-tip__icon" />
      <span>
        当前窗口宽度 <b>{{ viewportWidth }}px</b>，低于本系统最低宽度
        <b>{{ MIN_WIDTH }}px</b>（仅支持 PC 端），右侧内容会被遮挡
      </span>
      <span class="narrow-tip__action">请拉宽窗口，或按 F11 全屏</span>
    </div>
    <router-view />
  </el-config-provider>
</template>
