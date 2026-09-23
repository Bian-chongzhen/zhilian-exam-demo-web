/**
 * ph 图标子集：同步 / 校验
 *
 * 背景：项目图标统一用 Iconify 的 ph 集合（《16、样式优化.md》§8.1），且 Demo 要求离线可用，
 * 因此图标数据必须本地化。但 ph 完整集合有 9000+ 图标（icons.json 约 4.5MB），
 * 整包打进入口 chunk 会让首屏体积从 ~1MB 涨到 ~5.7MB —— 这不可接受。
 *
 * 方案：扫描源码里用到的 `ph:xxx`，只把用到的图标（及其别名父链）生成到
 * `src/constants/phIcons.ts`，运行时用 addCollection 注册这个小集合。
 * 仍然是零新增运行时依赖、完全离线。
 *
 * 代价与兜底：新增图标后需要重新生成。忘了生成不会静默失败——
 * 把 `npm run icons:check` 接进校验流程即可，它会报「子集已过期」。
 *
 *   node scripts/icons.mjs sync    # 重新生成子集
 *   node scripts/icons.mjs check   # 校验：图标名是否存在 + 子集是否最新
 */
import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const SRC = join(ROOT, 'src')
const ICON_DATA = join(ROOT, 'node_modules', '@iconify-json', 'ph', 'icons.json')
const OUT_FILE = join(SRC, 'constants', 'phIcons.ts')
const EXT = ['.vue', '.ts']
const PATTERN = /['"]ph:([a-z0-9-]+)['"]/g

function walk(dir) {
  const out = []
  for (const name of readdirSync(dir)) {
    const full = join(dir, name)
    if (statSync(full).isDirectory()) out.push(...walk(full))
    else if (EXT.some((e) => name.endsWith(e))) out.push(full)
  }
  return out
}

/** 收集源码中用到（且未被注释掉）的图标名 */
function collectUsed() {
  const used = new Set()
  for (const file of walk(SRC)) {
    // 生成文件本身不参与扫描
    if (file === OUT_FILE) continue
    // 跳过 .d.ts：只声明不渲染
    if (file.endsWith('.d.ts')) continue
    const text = readFileSync(file, 'utf8')
    for (const line of text.split(/\r?\n/)) {
      // 去掉行注释，避免注释里的示例名把图标带进产物（模板注释 <!-- --> 也一并处理）
      const code = line.replace(/\/\/.*$/, '').replace(/<!--.*?-->/g, '')
      for (const match of code.matchAll(PATTERN)) used.add(match[1])
    }
  }
  return [...used].sort()
}

/** 组装只含所需图标的 IconifyJSON 子集 */
function buildSubset(used, collection) {
  const icons = {}
  const aliases = {}
  const missing = []

  for (const name of used) {
    if (collection.icons[name]) {
      icons[name] = collection.icons[name]
      continue
    }
    // 别名：连父图标（可能多级）一起收录，否则 Iconify 解析不到图形数据
    let cur = name
    const chain = []
    const seen = new Set()
    while (collection.aliases?.[cur] && !seen.has(cur)) {
      seen.add(cur)
      chain.push(cur)
      cur = collection.aliases[cur].parent
    }
    if (collection.icons[cur]) {
      for (const alias of chain) aliases[alias] = collection.aliases[alias]
      icons[cur] = collection.icons[cur]
    } else {
      missing.push(name)
    }
  }

  const subset = {
    prefix: collection.prefix,
    icons,
    ...(Object.keys(aliases).length > 0 ? { aliases } : {}),
    width: collection.width,
    ...(collection.height !== undefined ? { height: collection.height } : {}),
    ...(collection.left !== undefined ? { left: collection.left } : {}),
    ...(collection.top !== undefined ? { top: collection.top } : {}),
  }
  return { subset, missing }
}

function render(subset, used) {
  const json = JSON.stringify(subset, null, 2)
  return `/**
 * ⚠ 本文件由 \`scripts/icons.mjs\` 自动生成，请勿手工修改。
 *
 * 内容：源码中用到的 ph 图标子集（共 ${used.length} 个：${used.join(', ')}）。
 * 为什么不用整包：ph 完整集合 9000+ 图标约 4.5MB，整包会全部进入口 chunk。
 *
 * 新增图标后请执行：npm run icons:sync
 * 校验是否最新：     npm run icons:check
 */
import type { IconifyJSON } from '@iconify-json/ph'

export const phSubset: IconifyJSON = ${json}
`
}

const mode = process.argv[2] ?? 'check'
const collection = JSON.parse(readFileSync(ICON_DATA, 'utf8'))
const used = collectUsed()
const { subset, missing } = buildSubset(used, collection)

if (missing.length > 0) {
  console.error('以下图标名在 ph 图标集中不存在（会渲染成空白方块）：')
  for (const name of missing) console.error(`  ph:${name}`)
  process.exit(1)
}

const expected = render(subset, used)

if (mode === 'sync') {
  writeFileSync(OUT_FILE, expected, 'utf8')
  console.log(`已生成 ${relative(ROOT, OUT_FILE)}：${used.length} 个图标，${expected.length} 字节`)
  process.exit(0)
}

// check：既要图标名合法，也要产物与源码同步
let current = ''
try {
  current = readFileSync(OUT_FILE, 'utf8')
} catch {
  console.error(`缺少 ${relative(ROOT, OUT_FILE)}，请执行：npm run icons:sync`)
  process.exit(1)
}

if (current !== expected) {
  console.error('图标子集已过期（源码用到的图标与产物不一致），请执行：npm run icons:sync')
  process.exit(1)
}

console.log(`图标校验通过：${used.length} 个 ph 图标，子集为最新。`)
