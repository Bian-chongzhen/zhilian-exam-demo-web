/**
 * Iconify 图标（离线可用，按需子集）
 *
 * 依据《16、样式优化.md》§8.1：图标集**固定为 ph（Phosphor）**，全站统一；
 * 功能图标禁止使用 Emoji（同文件 D-6）。§8.2 要求 Demo 离线可用，
 * 因此图标数据必须本地化，不能依赖 Iconify 线上 API（否则断网就全是空白方块）。
 *
 * 使用方式：`<Icon icon="ph:compass" />`（Icon 组件已在 main.ts 全局注册）。
 *
 * 数据来源：`src/constants/phIcons.ts` —— 由 `npm run icons:sync` 从 **源码实际用到的图标**
 * 生成的子集（20 个图标约 10KB）。不用整包的原因：ph 完整集合 9000+ 图标约 4.5MB，
 * 整包会把入口 chunk 撑到 5.7MB（实测），而子集方案零新增运行时依赖、完全离线。
 *
 * 新增图标后：`npm run icons:sync`；校验是否同步：`npm run icons:check`。
 */
import { addCollection } from '@iconify/vue'
import { phSubset } from '@/constants/phIcons'

let registered = false

/** 注册一次即可；重复调用无副作用 */
export function setupIcons(): void {
  if (registered) return
  addCollection(phSubset)
  registered = true
}
