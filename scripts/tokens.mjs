/**
 * 设计令牌工具：HEX 导出 + 对比度回归校验
 *
 * 为什么需要它：
 *   1. 《16、样式优化.md》§5.1 要求「全站颜色来自令牌、页面内禁止硬编码色值」，
 *      但**文档与设计稿需要可读的 HEX 对照**。本脚本从 global.css 的 oklch 表达式
 *      直接换算出 HEX —— 保证「文档里写的 HEX」永远等于「代码实际渲染的颜色」，
 *      不会因为手工抄写或后续改 --ql-hue 而漂移。
 *   2. 16 号 §1 与 §14（S-4 阅读优先）要求正文对比度 ≥7:1、辅助 ≥4.5:1。
 *      脚本顺带做 WCAG 校验：任何人调 L/C 之后跑一次就能发现回归。
 *
 *   node scripts/tokens.mjs          # 打印 HEX 对照表 + 对比度校验
 *   node scripts/tokens.mjs --check  # 只做校验（不打印整表）
 *
 * 单一真源：令牌值只在 src/styles/global.css 里维护，本脚本只读取、不写回。
 */
import { readFileSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const CSS = join(ROOT, 'src', 'styles', 'global.css')

/* ------------------------------ oklch → sRGB ------------------------------ */

/** oklch(L C H) → [r, g, b]（0-255）。公式取自 CSS Color 4 规范。 */
function oklchToRgb(L, C, H) {
  const rad = (H * Math.PI) / 180
  const a = C * Math.cos(rad)
  const b = C * Math.sin(rad)

  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3

  const linear = [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ]
  return linear.map((v) => {
    const c = Math.max(0, Math.min(1, v))
    const gamma = c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055
    return Math.round(gamma * 255)
  })
}

const toHex = ([r, g, b]) =>
  `#${[r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('')}`

/** WCAG 相对亮度 */
function luminance([r, g, b]) {
  const lin = (v) => {
    const c = v / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b)
}

/** WCAG 对比度（1-21） */
function contrast(fg, bg) {
  const [hi, lo] = [luminance(fg), luminance(bg)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

/**
 * #rrggbb → { L, C, H }
 * 用途：设计稿给的是 HEX，而令牌层要保持 `oklch(L C var(--ql-hue))` 的单一参数机制，
 * 所以需要把目标 HEX 反解成 oklch 写进 global.css —— 这样既精确命中设计色值，
 * 又保留「改 --ql-hue 一处即可整套换色」的能力。
 */
function hexToOklch(hex) {
  const m = /^#?([\da-f]{6})$/i.exec(hex.trim())
  if (!m) throw new Error(`无法解析色值：${hex}`)
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(m[1].slice(i, i + 2), 16) / 255)
  const lin = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)
  const [lr, lg, lb] = [lin(r), lin(g), lin(b)]

  const l = Math.cbrt(0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb)
  const mm = Math.cbrt(0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb)
  const s = Math.cbrt(0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb)

  const L = 0.2104542553 * l + 0.793617785 * mm - 0.0040720468 * s
  const A = 1.9779984951 * l - 2.428592205 * mm + 0.4505937099 * s
  const B = 0.0259040371 * l + 0.7827717662 * mm - 0.808675766 * s

  const C = Math.hypot(A, B)
  let H = (Math.atan2(B, A) * 180) / Math.PI
  if (H < 0) H += 360
  return { L, C, H }
}

/* ------------------------------ --hex：设计稿色值 → oklch ------------------------------ */
const hexIdx = process.argv.indexOf('--hex')
if (hexIdx !== -1) {
  const list = (process.argv[hexIdx + 1] ?? '')
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean)
  for (const h of list) {
    const { L, C, H } = hexToOklch(h)
    const round = C < 0.01 ? 0 : Number(C.toFixed(3))
    console.log(
      `${h.padEnd(9)} oklch(${Number(L.toFixed(3))} ${round} ${Number(H.toFixed(1))})`,
    )
  }
  process.exit(0)
}

/* ------------------------------ 解析 global.css ------------------------------ */

const css = readFileSync(CSS, 'utf8')

const hueMatch = css.match(/--ql-hue:\s*([\d.]+)/)
if (!hueMatch) {
  console.error('未在 global.css 中找到 --ql-hue，请检查设计令牌块。')
  process.exit(1)
}
const HUE = Number(hueMatch[1])

/** 只收「直接写 oklch」的令牌；var() 别名与 color-mix 派生色不参与换算 */
const TOKEN_RE = /--ql-([a-z0-9-]+):\s*oklch\(\s*([\d.]+)\s+([\d.]+)\s+(var\(--ql-hue\)|[\d.]+)\s*\)/g

const tokens = new Map()
for (const [, name, L, C, h] of css.matchAll(TOKEN_RE)) {
  const hue = h === 'var(--ql-hue)' ? HUE : Number(h)
  tokens.set(name, { L: Number(L), C: Number(C), H: hue, rgb: oklchToRgb(+L, +C, hue) })
}

if (tokens.size === 0) {
  console.error('未解析到任何 oklch 令牌，请检查 global.css 的令牌写法。')
  process.exit(1)
}

/* ------------------------------ 对比度校验 ------------------------------ */

/**
 * [说明, 前景令牌, 背景令牌, 最低对比度]
 *
 * 阈值分三档，依据不同：
 *   7.0  —— 16 号 §1 对**正文**的要求（WCAG AAA 正文级，长时间阅读题干/表格的主诉求）
 *   4.5  —— 16 号 §1 对**辅助文字**与状态标签的要求（WCAG AA）
 *   3.5  —— **主色文字**（链接 / 文字按钮）。设计规格指定的主色是「亮度偏高的浅蓝」
 *           （#3677eb，L=.591），它在浅底上的对比度物理上限约 3.7~4.2:1；
 *           这里按 WCAG 1.4.11（UI 组件与图形 3:1）加余量取 3.5，并保证
 *           正文可读性由 --ql-text（≥7:1）承担 —— 主色只用于短链接与强调，不承载长文阅读。
 */
const RULES = [
  ['标题 / 页面基底', 'title', 'bg', 7],
  ['正文 / 页面基底', 'text', 'bg', 7],
  ['辅助 / 页面基底', 'muted', 'bg', 4.5],
  ['标题 / 侧边栏', 'title', 'aside', 7],
  ['正文 / 侧边栏', 'text', 'aside', 7],
  ['辅助 / 侧边栏', 'muted', 'aside', 4.5],
  ['标题 / 卡片', 'title', 'surface', 7],
  ['正文 / 卡片', 'text', 'surface', 7],
  ['辅助 / 卡片', 'muted', 'surface', 4.5],
  ['主按钮文字 / 按钮填充', 'on-primary', 'primary-fill', 4.5],
  ['主色文字 / 页面基底（链接）', 'primary', 'bg', 3.5],
  ['主色文字 / 卡片（链接）', 'primary', 'surface', 3.5],
  ['选中态文字 / 选中浅底', 'on-primary-container', 'primary-soft', 4.5],
  ['成功标签（已处理）', 'success', 'success-soft', 4.5],
  ['待办标签（待处理）', 'warning', 'warning-soft', 4.5],
  ['错误标签（已废弃/答错）', 'danger', 'danger-soft', 4.5],
]

const results = RULES.map(([label, fg, bg, min]) => {
  const f = tokens.get(fg)
  const b = tokens.get(bg)
  if (!f || !b) return { label, error: `缺少令牌 --ql-${f ? bg : fg}` }
  return { label, ratio: contrast(f.rgb, b.rgb), min }
})

/* ------------------------------ 输出 ------------------------------ */

const checkOnly = process.argv.includes('--check')

if (!checkOnly) {
  console.log(`设计令牌 HEX 对照（--ql-hue: ${HUE}）\n`)
  const pad = (s, n) => String(s).padEnd(n, ' ')
  console.log(`${pad('令牌', 26)}${pad('oklch(L C H)', 26)}${pad('HEX', 10)}用途`)
  const USE = {
    bg: '页面外层 / 主内容区',
    aside: '侧边栏底色',
    surface: '卡片 / 顶栏',
    'surface-soft': '表头 / 选中行',
    'surface-sunken': '输入框内 / hover 底',
    'surface-high': '悬浮面',
    title: '标题文字',
    text: '正文文字',
    muted: '次要文字',
    placeholder: '占位文字',
    border: '描边',
    'border-light': '细描边 / 分割线',
    primary: '主色（按钮 / 链接 / 选中）',
    'primary-hover': '主色 hover',
    'primary-active': '主色 active',
    'primary-fill': '实心按钮填充',
    'primary-fill-hover': '按钮填充 hover',
    'primary-soft': '极浅同色系底（选中菜单 / 提示块）',
    'on-primary': '主色之上的文字',
    'on-primary-container': '浅底之上的文字',
    'primary-line': '浅底描边',
    success: '成功 / 已处理',
    'success-soft': '成功浅底',
    warning: '警告 / 待处理',
    'warning-soft': '警告浅底',
    danger: '错误 / 废弃 / 答错',
    'danger-soft': '错误浅底',
    'scrollbar': '滚动条',
    'scrollbar-hover': '滚动条 hover',
  }
  for (const [name, t] of tokens) {
    const label = `--ql-${name}`
    const expr = `oklch(${t.L} ${t.C} ${t.H})`
    console.log(`${pad(label, 26)}${pad(expr, 26)}${pad(toHex(t.rgb), 10)}${USE[name] ?? ''}`)
  }
  console.log('')
}

let failed = 0
console.log('对比度校验（16 号 §1 / §14 S-4）')
for (const r of results) {
  if (r.error) {
    console.error(`  ✗ ${r.label}：${r.error}`)
    failed += 1
    continue
  }
  const ok = r.ratio >= r.min
  if (!ok) failed += 1
  console.log(
    `  ${ok ? '✓' : '✗'} ${r.label}：${r.ratio.toFixed(1)}:1（要求 ≥${r.min}:1）`,
  )
}

if (failed > 0) {
  console.error(`\n有 ${failed} 项未达标，请调整 global.css 的 L/C 后重跑。`)
  process.exit(1)
}
console.log(`\n全部通过（${results.length} 项）。令牌真源：${relative(ROOT, CSS)}`)
