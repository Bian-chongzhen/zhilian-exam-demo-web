/**
 * 图表用色与通用样式（v1-plus 模块5）
 *
 * 为什么需要它：ECharts 是 canvas 渲染，**读不到 CSS 变量**，
 * 早期代码因此在图表里硬编码了色值 —— 结果本轮换配色时图表颜色与新主题脱节。
 * 这里统一从设计令牌解析，保证图表与界面永远同源。
 */
import { useUserStore } from '@/stores/user'

/** 从设计令牌解析实际色值（浏览器外返回兜底灰） */
export function tokenColor(name: string, fallback = '#888888'): string {
  if (typeof window === 'undefined') return fallback
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim()
  return value || fallback
}

/** 图表统一配色（主色 + 语义色 + 中性） */
export function chartPalette() {
  return {
    primary: tokenColor('--ql-primary'),
    success: tokenColor('--ql-success'),
    warning: tokenColor('--ql-warning'),
    danger: tokenColor('--ql-danger'),
    title: tokenColor('--ql-title'),
    text: tokenColor('--ql-text'),
    muted: tokenColor('--ql-muted'),
    border: tokenColor('--ql-border-light'),
    surface: tokenColor('--ql-surface'),
  }
}

/** 通用坐标轴/网格样式（字号 12px 辅助色，网格线用细描边色） */
export function chartAxisStyle() {
  const c = chartPalette()
  return {
    axisLabel: { color: c.muted, fontSize: 12 },
    axisLine: { lineStyle: { color: c.border } },
    splitLine: { lineStyle: { color: c.border, type: 'dashed' as const } },
  }
}

/** 当前登录用户 id（图表页统一入口，避免各页自行读取） */
export function useCurrentUserId(): number {
  return useUserStore().userId
}
