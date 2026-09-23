<script setup lang="ts">
/**
 * ECharts 基座组件（v1-plus 模块5）
 *
 * 收口图表的生命周期（初始化 / 更新 / 自适应 / 销毁），
 * 页面只负责给 option —— 否则每个图表都要重复一遍这套代码。
 */
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import * as echarts from 'echarts'

const props = withDefaults(
  defineProps<{
    option: echarts.EChartsOption
    height?: string
  }>(),
  { height: '280px' },
)

const el = ref<HTMLDivElement | null>(null)
let chart: echarts.ECharts | null = null

function render() {
  if (!el.value) return
  if (!chart) chart = echarts.init(el.value)
  // notMerge = true：切换筛选/数据时避免残留上一次的 series
  chart.setOption(props.option, true)
}

function resize() {
  chart?.resize()
}

onMounted(() => {
  render()
  window.addEventListener('resize', resize)
})

watch(() => props.option, render, { deep: true })

onBeforeUnmount(() => {
  window.removeEventListener('resize', resize)
  chart?.dispose()
  chart = null
})
</script>

<template>
  <div ref="el" class="base-chart" :style="{ height }" />
</template>

<style scoped>
.base-chart {
  width: 100%;
}
</style>
