<script setup lang="ts">
/**
 * 个人学习统计大盘 `/stats`（v1-plus 模块5）
 *
 * 依据《14、v1 plus.md》模块5 与 15 号 ST-01 ~ ST-05：
 *   - **仅本人可见**：路由不带 userId 参数，接口侧还有「发起者必须是本人」的强校验，
 *     所以既没有「访问他人大盘」的入口，也无法从接口侧绕过（对应 ST-01）。
 *   - 数据全部来自既有答题/错题记录聚合，**不新增业务表**；删除答题记录后统计同步变化（ST-03）。
 *   - 口径严格沿用 v1：只统计已交卷、已判分客观题；**简答完全不计入**（ST-04）。
 *   - 没有任何数据：数字归零，图表区**不渲染空图**，给文案提示（ST-02 / ST-05）。
 *   - 与用户主页的区分：主页对外只给准确率，详细学情不对外暴露。
 */
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import type { EChartsOption } from 'echarts'
import { api, type StatsDashboard } from '@/api'
import { Copy } from '@/constants/copy'
import { useUserStore } from '@/stores/user'
import { chartAxisStyle, chartPalette } from '@/composables/useChartTokens'
import AccuracyChart from '@/components/AccuracyChart.vue'
import BaseChart from '@/components/BaseChart.vue'
import EmptyState from '@/components/EmptyState.vue'

const router = useRouter()
const userStore = useUserStore()

const loading = ref(false)
const data = ref<StatsDashboard | null>(null)

async function load() {
  loading.value = true
  try {
    data.value = await api.stat.dashboard(userStore.userId)
  } catch (e) {
    ElMessage.error((e as Error).message)
  } finally {
    loading.value = false
  }
}

const hasTrend = computed(() => (data.value?.trend.length ?? 0) > 0)
const hasTagRanking = computed(() => (data.value?.tagWrongRanking.length ?? 0) > 0)
const hasSetData = computed(() => {
  const c = data.value?.setCompare
  return !!c && c.wrongCount + c.masteredCount > 0
})

/** ② 答题趋势折线：每日完成试卷数 + 每日做题量（Q4：已判分客观题小题数） */
const trendOption = computed<EChartsOption>(() => {
  const palette = chartPalette()
  const axis = chartAxisStyle()
  const points = data.value?.trend ?? []
  return {
    tooltip: { trigger: 'axis' },
    legend: { data: ['完成试卷', '做题量'], textStyle: { color: palette.text } },
    grid: { left: 48, right: 24, top: 40, bottom: 32 },
    xAxis: { type: 'category', data: points.map((p) => p.date), ...axis, splitLine: { show: false } },
    yAxis: { type: 'value', minInterval: 1, ...axis },
    series: [
      {
        name: '完成试卷',
        type: 'line',
        smooth: true,
        symbolSize: 7,
        data: points.map((p) => p.examCount),
        itemStyle: { color: palette.primary },
        areaStyle: { color: palette.primary, opacity: 0.08 },
      },
      {
        name: '做题量',
        type: 'line',
        smooth: true,
        symbolSize: 7,
        data: points.map((p) => p.questionCount),
        itemStyle: { color: palette.success },
        lineStyle: { type: 'dashed' },
      },
    ],
  }
})

/** ④ 考点错题排行（横向柱状，按错题数降序） */
const tagOption = computed<EChartsOption>(() => {
  const palette = chartPalette()
  const axis = chartAxisStyle()
  const items = [...(data.value?.tagWrongRanking ?? [])].reverse() // 横向柱状自下而上，反转后最大值在顶部
  return {
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
    grid: { left: 110, right: 40, top: 16, bottom: 24 },
    xAxis: { type: 'value', minInterval: 1, ...axis },
    yAxis: { type: 'category', data: items.map((i) => i.tagName), ...axis, splitLine: { show: false } },
    series: [
      {
        type: 'bar',
        barWidth: 14,
        data: items.map((i) => i.wrongCount),
        itemStyle: { color: palette.warning, borderRadius: [0, 4, 4, 0] },
        label: { show: true, position: 'right', formatter: '{c} 题', color: palette.text, fontSize: 12 },
      },
    ],
  }
})

/** ⑤ 错题集 / 已掌握集数量对比（饼图） */
const setOption = computed<EChartsOption>(() => {
  const palette = chartPalette()
  const c = data.value?.setCompare ?? { wrongCount: 0, masteredCount: 0 }
  return {
    tooltip: { trigger: 'item', formatter: '{b}：{c} 题（{d}%）' },
    legend: { bottom: 0, textStyle: { color: palette.text } },
    series: [
      {
        type: 'pie',
        radius: ['42%', '68%'],
        center: ['50%', '44%'],
        avoidLabelOverlap: true,
        itemStyle: { borderColor: palette.surface, borderWidth: 2 },
        label: { color: palette.text, fontSize: 12 },
        data: [
          { name: '错题集合', value: c.wrongCount, itemStyle: { color: palette.danger } },
          { name: '已掌握集合', value: c.masteredCount, itemStyle: { color: palette.success } },
        ],
      },
    ],
  }
})

function fmtAccuracy(value: number | null): string {
  return value === null ? '—' : `${(value * 100).toFixed(1)}%`
}

onMounted(load)
</script>

<template>
  <div v-loading="loading" class="page">
    <div class="page-header">
      <div>
        <h2 class="page-title">我的学习统计</h2>
        <p class="page-desc">
          只统计<b>已交卷、已判分的客观题</b>；简答题不计入任何指标，删掉答题记录后这里会同步变化。
          这一页仅你自己可见，其他人在主页只能看到准确率。
        </p>
      </div>
      <div class="page-actions">
        <el-button @click="router.push('/records')">去答题记录</el-button>
        <el-button type="primary" @click="router.push('/compose')">错题组卷</el-button>
      </div>
    </div>

    <template v-if="data">
      <!-- ① 数字卡片 -->
      <div class="stat-grid">
        <div class="stat-card">
          <div class="stat-value primary">{{ data.totals.finishedExamCount }}</div>
          <div class="stat-label">总完成试卷数</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">{{ data.totals.judgedQuestionCount }}</div>
          <div class="stat-label">总作答客观题数</div>
        </div>
        <div class="stat-card">
          <div class="stat-value bad">{{ data.totals.wrongCount }}</div>
          <div class="stat-label">总错题数</div>
        </div>
        <div class="stat-card">
          <div class="stat-value ok">{{ data.totals.masteredCount }}</div>
          <div class="stat-label">已掌握题目数</div>
        </div>
        <div class="stat-card">
          <div class="stat-value primary">{{ fmtAccuracy(data.totals.globalAccuracy) }}</div>
          <div class="stat-label">全局准确率（题级）</div>
        </div>
      </div>

      <!-- ② 答题趋势 -->
      <section class="ql-panel">
        <div class="ql-panel__head">
          <span class="ql-panel__title">答题趋势</span>
          <span class="ql-panel__extra">按交卷日期统计；做题量 = 当日已判分客观题数</span>
        </div>
        <BaseChart v-if="hasTrend" :option="trendOption" height="300px" />
        <EmptyState v-else icon="ph:chart-line-up" :desc="Copy.statsEmpty" compact />
      </section>

      <!-- ③ 各分类正确率（复用主页的同一个图表组件） -->
      <section class="ql-panel">
        <div class="ql-panel__head">
          <span class="ql-panel__title">各试卷分类正确率</span>
          <span class="ql-panel__extra">未作答过的分类不会出现</span>
        </div>
        <AccuracyChart
          v-if="data.categoryAccuracy.length > 0"
          :categories="data.categoryAccuracy"
        />
        <EmptyState v-else icon="ph:chart-line-up" :desc="Copy.statsEmpty" compact />
      </section>

      <!-- ④ 考点错题排行 -->
      <section class="ql-panel">
        <div class="ql-panel__head">
          <span class="ql-panel__title">薄弱考点排行</span>
          <span class="ql-panel__extra">按考点统计错题数，取前 10；一题多标签各计一次</span>
        </div>
        <BaseChart v-if="hasTagRanking" :option="tagOption" height="320px" />
        <EmptyState v-else icon="ph:chart-line-up" :desc="Copy.statsEmpty" compact />
      </section>

      <!-- ⑤ 集合对比 -->
      <section class="ql-panel">
        <div class="ql-panel__head">
          <span class="ql-panel__title">错题集合 / 已掌握集合</span>
          <span class="ql-panel__extra">重做答对会移入已掌握；再答错会回到错题集</span>
        </div>
        <BaseChart v-if="hasSetData" :option="setOption" height="300px" />
        <EmptyState v-else icon="ph:chart-line-up" :desc="Copy.statsEmpty" compact />
      </section>
    </template>
  </div>
</template>

<style scoped>
/*
 * 图表周边排版（16 号 §13.3「图表周边排版」）。
 *
 * 4 个图表面板的头部都是「标题 + 口径说明」，而说明较长且常含公式
 * （如「按交卷日期统计；做题量 = 当日已判分客观题数」），与标题挤在同一行会被压缩换行、
 * 层级也乱。这里改为标题在上、说明在下，形成清晰的「分区标题 16px > 辅助 12px」两级（§5.3）。
 */
.ql-panel__head {
  display: block;
  margin-bottom: var(--ql-s2);
}

.ql-panel__head .ql-panel__extra {
  display: block;
  margin-top: 4px;
}

/*
 * 非对称数字卡片（16 号 §5.4：首屏允许不等宽、错位，拒绝 4/5 等宽）。
 * 6 列网格：前三张各占 2 列（等宽一行），后两张 4:2 错位（「已掌握题目数」放大）。
 * 表格/表单仍严格对齐栅格，这里只改变卡片跨列宽度，不破坏对齐基线。
 */
.stat-grid {
  grid-template-columns: repeat(6, 1fr);
}

.stat-card:nth-child(1),
.stat-card:nth-child(2),
.stat-card:nth-child(3) {
  grid-column: span 2;
}

.stat-card:nth-child(4) {
  grid-column: span 4;
}

.stat-card:nth-child(5) {
  grid-column: span 2;
}
</style>
