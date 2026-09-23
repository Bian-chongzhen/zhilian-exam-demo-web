<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch } from 'vue'
import * as echarts from 'echarts'
import type { CategoryAccuracy } from '@/types/models'
import { tokenColor } from '@/composables/useChartTokens'

const props = defineProps<{ categories: CategoryAccuracy[] }>()

const el = ref<HTMLDivElement | null>(null)
let chart: echarts.ECharts | null = null

function render() {
  if (!el.value) return
  if (!chart) chart = echarts.init(el.value)
  const data = props.categories
  chart.setOption({
    grid: { left: 120, right: 40, top: 20, bottom: 30 },
    xAxis: { type: 'value', max: 100, axisLabel: { formatter: '{value}%' } },
    yAxis: {
      type: 'category',
      data: data.map((c) => `${c.categoryName}（${c.judgedCount} 题）`),
      axisLabel: { fontSize: 12 },
    },
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      formatter: (params: unknown) => {
        const list = params as Array<{ dataIndex: number; value: number }>
        const item = data[list[0]?.dataIndex ?? 0]
        if (!item) return ''
        return `${item.categoryName}<br/>准确率 ${((item.accuracy ?? 0) * 100).toFixed(1)}%<br/>答对 ${item.rightCount} / 已判分 ${item.judgedCount}`
      },
    },
    series: [
      {
        type: 'bar',
        barWidth: 18,
        data: data.map((c) => Number(((c.accuracy ?? 0) * 100).toFixed(1))),
        itemStyle: {
          /*
           * ECharts 用 canvas 渲染，读不到 CSS 变量，因此这里**从设计令牌解析实际色值**
           * （而不是再写一份硬编码色值 —— 否则换配色时图表颜色会与界面漂移，
           * 这正是本轮配色调整在旧代码里发现的残留问题）。
           */
          color: (params: { dataIndex: number }) =>
            (data[params.dataIndex]?.accuracy ?? 0) >= 0.6
              ? tokenColor('--ql-success')
              : tokenColor('--ql-warning'),
          borderRadius: [0, 4, 4, 0],
        },
        label: { show: true, position: 'right', formatter: '{c}%' },
      },
    ],
  })
}

function resize() {
  chart?.resize()
}

onMounted(() => {
  render()
  window.addEventListener('resize', resize)
})

onUnmounted(() => {
  window.removeEventListener('resize', resize)
  chart?.dispose()
  chart = null
})

watch(() => props.categories, render, { deep: true })
</script>

<template>
  <div ref="el" class="chart" />
</template>

<style scoped>
.chart {
  width: 100%;
  height: 260px;
}
</style>
