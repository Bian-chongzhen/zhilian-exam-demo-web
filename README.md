# 知练题库系统 · 前端 Demo（Phase 1）

> 纯前端 Demo：用**假数据 + 真实业务规则**验证前端功能与产品需求。
> 判分、底稿锁定、准确率口径、双重加权抽题、简答自评等核心规则都是**真实实现**，不是写死的假象。
> 数据保存在浏览器 localStorage，**无需 MySQL / Redis / JDK**。

| | |
|---|---|
| **技术栈** | Vue 3 · TypeScript · Vite · Pinia · Vue Router · Element Plus · ECharts · Iconify(ph) |
| **演示账号** | `admin` / `alice` / `bob` / `dave`，密码均 `123456`（另有已注销示例账号 `carol`） |
| **静态保障** | `npx vue-tsc --noEmit` 退出码 0；`npm run smoke` 136 项断言全通过 |
| **版本控制** | GitHub `main` 分支 |
| **部署** | 腾讯云 CloudBase（代码源同步 GitHub，推送即自动构建） |

---

## 一、快速开始

```bash
npm install          # 依赖安装（首次）
npm run dev          # 启动开发服务器
```

浏览器打开终端输出的地址（默认 http://localhost:5180 ）。

**无需 MySQL / Redis / JDK** —— Phase 1 的后端语义由浏览器内的 Mock 层承担，数据保存在 localStorage。

### 常用命令

| 命令 | 作用 |
|---|---|
| `npm run dev` | 启动开发服务器 |
| `npm run typecheck` | TypeScript 类型检查（无 lint 环境下的唯一静态保障） |
| `npm run build` | 类型检查 + 生产构建 |
| `npm run smoke` | **服务层冒烟测试**：Node 里对契约面 + Mock 服务层做真实断言（**136 项**，覆盖 v0.5 的账号管理 UM-01~UM-07、权限 PER-01、游客禁写、v1-plus 全模块等）。只操作内存替身，不碰浏览器数据 |
| `node scripts/tokens.mjs` | **设计令牌回归**：从 `global.css` 现算全套 HEX 并校验 WCAG 对比度（16 项），退出码即结果 |
| `npm run icons:sync` | 重新生成 ph 图标子集（**新增图标后必须执行**） |
| `npm run icons:check` | 校验图标名与子集是否最新 |
| `npm run release:check` | 本地一键校验（替代 CI；含类型检查与图标校验） |

---

## 二、演示账号

密码统一为 `123456`（登录页可一键填充）。

| 账号 | 角色 | 用途 |
|---|---|---|
| `admin` | 管理员 | 维护分类/标签、题库纠错、废弃试卷审计、用户账号管理、反馈工单、创建公开试卷 |
| `alice` | 普通用户 | 有丰富答题轨迹：错题次数累加、已掌握流转、二刷、简答自评 |
| `bob` | 普通用户 | **隐私主页**演示：他人仅能看到其公开试卷 |
| `dave` | 普通用户 | 新用户：无任何记录，用于验证"未作答分类自动隐藏" |
| `carol` | 已注销 | 无法登录；主页仍展示历史记录并标注"已注销" |

数据可在右上角用户菜单 → **重置演示数据** 恢复初始状态。

---

## 三、功能模块与验证路径

| 模块 | 入口 | 建议验证点 |
|---|---|---|
| 1. 登录注册与权限 | 登录页 / 我的主页 | 用户名唯一校验、手机号+用户名找回、隐私设置、注销账号 |
| 2. 试卷管理 | 我的试卷 / 公开试卷广场 | **启用即永久锁定**、题目继承锁定、另存为修正通道、废弃后创建者不可见 |
| 3. 答题闭环 | 公开试卷 → 开始答题 | 自动保存、退出续答、练习型即时反馈、竞技型交卷后判分、简答自评 |
| 4. 错题与已掌握 | 错题与已掌握 | 答错入错题集、答对移入已掌握、再答错移回、作答历史明细 |
| 5. 错题组卷 | 错题组卷 | 双重加权抽题、任意/全部标签匹配、三种策略、题量不足降级 |
| 6. 个人主页与统计 | 用户菜单 → 我的主页 / 学习统计 | 全局/分类准确率、未作答分类隐藏、公开态字段裁剪 |
| 7. 知识库与收藏 | 知识点广场 / 知识点详情 / 我的收藏 | Markdown 渲染、关联题目、题目私有笔记、多态收藏（试卷/题目/知识点） |
| 8. 管理端 | 用户菜单 → 管理后台 | 分类（固定题量/考点/权重）、标签字典、题库纠错（标签不受锁定限制）、废弃试卷审计、用户账号管理、反馈工单 |

**规则自检页**：用户菜单 → **规则自检**，直接对 Mock 层中的真实规则做断言，逐条标注设计依据。

> 上述功能依据**内部需求规格与数据库设计文档**实现；该系列文档未随本仓库发布，故本 README 只描述规则本身。

---

## 四、UI 与设计系统

界面遵循现代简约 SaaS 后台风格，低饱和度、**阅读优先**（长题干阅读体验是硬约束）。

### 4.1 设计令牌（`src/styles/global.css`）

> **V2.0：清爽浅白主题，单一色相参数 `--ql-hue: 261`**。
> 全站颜色由 `oklch(L C var(--ql-hue))` 生成，**改这一个数字即可整套换色**；
> 派生色（Element Plus 的 `light-N`、阴影、遮罩）统一用 `color-mix()` 现算，不写死第二套色值。
> 配色机制借鉴 Material 3 的「单一 hue + oklch 派生」做法，版式不照搬任何第三方。
> 浏览器基线：Chromium 111+ / Safari 15.4+ / Firefox 113+。
> 下表的 HEX 为 hue=261 的解析值，由 `node scripts/tokens.mjs` 现算，**脚本输出即真值**。

| 类别 | 令牌 | 取值（hue=261） |
|---|---|---|
| 主色（链接 / 图标 / 高亮 / 选中） | `--ql-primary` | `#3677eb`（链接对比度 4.0:1） |
| 实心按钮填充 / hover | `--ql-primary-fill` / `-hover` | `#2d6cdd` / `#2660c8`（其上白字 **4.9:1**） |
| 主色浅底 / 加深 | `--ql-primary-soft` / `-soft-hover` | `#e8f0fe` / `#dae7fd` |
| **三层底色**：页面外层 / 侧边栏 / 卡片·顶栏 | `--ql-bg` / `--ql-aside` / `--ql-surface` | `#f7f8f9` / `#f0f1f3` / `#ffffff` |
| 次级表面：表头·行 hover / 输入框内 / 悬浮面 | `--ql-surface-soft` / `-sunken` / `-high` | `#f4f5f6` / `#eeeff1` / `#e7e8eb` |
| 文字三级：标题 / 正文 / 辅助 | `--ql-title` / `--ql-text` / `--ql-muted` | `#1f2329`（14.8:1）/ `#404651`（**8.9:1**）/ `#666d78`（4.9:1） |
| 描边 / 细描边 | `--ql-border` / `-light` | `#e4e5e8` / `#edeef0` |
| 状态色（成功 / 警告 / 错误 + 浅底） | `--ql-success` / `-warning` / `-danger` | `#3e7a58` / `#8a6520` / `#a85450`（浅底 `#eaf5ee` / `#fdf4e3` / `#fbeeed`，标签均 ≥4.6:1） |
| 圆角 | `--ql-radius` / `-sm` / `-lg` | 卡片 8px · 控件 6px · 全屏卡片与对话框 12px |
| 阴影 | `--ql-shadow` / `-hover` / `-pop` | 用标题色 `color-mix` 现算（卡片 4–6% / hover 6% / 弹层 14%），不用纯黑 |
| 动效 | `--ql-ease-spring` / `--ql-dur-fast` / `-panel` | 弹簧 `cubic-bezier(.22,1.2,.36,1)`；交互 0.18s · 折叠 0.28s；遵循 `prefers-reduced-motion` |
| 间距 / 字号 | `--ql-s1`~`--ql-s5` | 8 / 16 / 24 / 32 / 40（8px 栅格）；字号层级 20 / 16 / 14 / 13 / 12px |
| 外壳尺寸 | `--ql-aside-w` / `-collapsed` / `--ql-header-h` | 侧栏 232px（折叠 64px，状态记忆在 localStorage）· 顶栏 60px · 主内容 `max-width` 1440px |

**阅读优先的硬指标**：题干与正文 15px / 行高 1.7；正文对比度 ≥7:1（WCAG AAA）、辅助文字 ≥4.5:1 —— 由 `scripts/tokens.mjs` 回归保障。

### 4.2 全局外壳

```
┌──────────────┬──────────────────────────────────────────────┐
│  品牌区       │ 折叠按钮 │ 面包屑        演示环境 · 导航 · 用户 │  ← 顶部 header（60px）
├──────────────┼──────────────────────────────────────────────┤
│ 公开试卷广场  │                                              │
│ 知识点广场    │                                              │
│ 我的试卷      │              主内容区（max-width 1440px）        │
│ 我的知识点    │              页面级留白 24/32/40px              │
│ 我的收藏      │                                              │
│ 错题组卷      │                                              │
│ 错题与已掌握  │                                              │
│ 答题记录      │                                              │
│ 学习统计      │                                              │
│ 我的主页      │                                              │
│              │  ← 24px 留白分区                               │
│  管理后台     │  ← 分组标题（12px，弱化）                       │
│ 试卷分类      │                                              │
│ 考点标签      │                                              │
│ 题库纠错      │                                              │
│ 废弃试卷审计  │                                              │
│ 用户账号管理  │                                              │
│ 反馈工单      │                                              │
└──────────────┴──────────────────────────────────────────────┘
   ↑ 左侧可折叠导航（232px / 64px）
     · 网格：左导轨 16px（品牌 logo = 菜单图标 = 分组标题）／文字列 56px（品牌文字 = 菜单文字）
     · 菜单条目 48px 等高；选中态 = 主色浅底 + 主色文字 + 左侧 3px 主色竖条
```

- 菜单按**身份**渲染：游客只看到「公开试卷广场 / 知识点广场」，个人分组与管理后台分组隐藏。
- 面包屑按路由前缀自动生成「分组 / 页面」，管理后台页面归入「管理后台」。
- 答题页为特殊布局：**导航与底部操作栏固定，仅中间答题区滚动**，题干区限制最大宽度 800px。

### 4.3 可复用样式类

| 分类 | 类名 |
|---|---|
| 页面骨架 | `.page` `.page--column` `.page-header` `.page-title` `.page-desc` `.page-actions` `.section-title` |
| 卡片面板 | `.ql-panel` `.ql-panel--tight` `.ql-panel.is-hoverable` `.ql-panel__head` `.ql-panel__title` `.ql-panel__extra` `.flat-section`（扁平分区） |
| 数据展示 | `.stat-grid` `.stat-card` `.stat-value`（含 `.ok/.bad/.pending/.primary`）`.stat-label` `.info-strip`（无框键值条）`.table-pager` |
| 筛选与列表 | `.filter-bar` `.filter-bar__spacer` `.tag-flow` `.tag-chip`（可点选胶囊）`.type-chip` |
| 空状态 | `.empty-state`（页面级：插画+文案+按钮，见 `EmptyState.vue`）`.empty-hint`（表格内紧凑）`.empty-hint--boxed`（区块级占位） |
| 提示与文案 | `.rule-tip`（规则说明块，含 `.warn`）`.hint`（含 `.ok/.bad/.warn/.hint--inline`）`.text-title/.text-body/.text-sub/.text-tip/.text-mono` |
| 状态与工具 | `.state-block`（S3/S4 原地提示）`.s1-guard`（S1 置灰外壳）`.narrow-tip`（窄屏提示）`.mb8/.mb16/.mb24` `.mt8/.mt16/.mt24` |
| 题干与选项 | `.ql-question-title`（15px / 1.7）`.ql-option` |

> 表格约定：不用 `border` / `stripe`；数字列统一等宽数字（`tabular-nums`）；失效行用 `.row-disabled` 弱化（不用整体 `opacity`）；行内操作一律文字按钮，实心按钮只留给页面级主动作。

### 4.4 表现层打磨记录

| 项 | 做法 |
|---|---|
| 令牌化 | 全站零硬编码色值；页面内颜色一律走令牌或 `color-mix` 派生 |
| 单一色相 | 换色只需改 `--ql-hue` 一个数字；`tokens.mjs` 同时回归 16 项对比度 |
| 载体收敛 | 空状态 / 提示块 / 胶囊 / 折叠面板各有唯一形态，禁止页面 scoped 重写基础载体 |
| 图标统一 | 业务语义图标全部走 Iconify `ph`（离线子集，见 `src/constants/phIcons.ts`）；Element Plus 内置图标仅用于其组件内部 |
| 键盘可访问性 | 非语义可点元素补 `role`/`tabindex` + 键盘激活；焦点环取主色；纯图标按钮补可访问名 |
| 危险操作 | 统一走 Element Plus 对话框，破坏性按钮用错误色且不与确认按钮紧邻，绝不使用原生 `alert`/`confirm` |
| 侧边栏 | 统一为单一 `--ql-aside` 表面（不再出现分区色块）；16/56/48 网格；滚动条隐藏但滚动能力保留 |

---

## 五、工程结构

```
demo-web/
├── scripts/
│   ├── preflight.mjs            本地一键校验脚本（替代 CI）
│   ├── tokens.mjs               设计令牌 HEX 对照 + WCAG 对比度回归
│   ├── icons.mjs                ph 图标子集生成 / 校验
│   └── smoke/                   服务层冒烟测试（v05.ts / v1plus.ts）
├── src/
│   ├── api/index.ts             ★ 界面与后端之间的唯一契约面（Phase 2 替换为 axios）
│   ├── components/              QuestionContent（题干渲染唯一入口）、EmptyState、表单弹窗、图表
│   ├── constants/
│   │   ├── enums.ts             业务枚举
│   │   ├── phIcons.ts           离线图标子集（自动生成，勿手改）
│   │   └── copy.ts              固定文案与引导语
│   ├── layouts/AppLayout.vue    ★ 全局外壳：左侧折叠导航 + 顶部 header + 面包屑
│   ├── styles/global.css        ★ 设计系统：设计令牌 + Element Plus 主题覆盖 + 工具类
│   ├── mock/
│   │   ├── db.ts                内存库 + localStorage 持久化 + 逻辑删除规范
│   │   ├── seed.ts              假数据种子（判分结果由真实规则推导）
│   │   ├── repo.ts              只读查询封装
│   │   ├── rules/               ★ 真实业务规则：judge / lock / stat / compose / exam / password
│   │   └── service/             领域服务：auth / draft / exam / wrong / compose / category / stat …
│   ├── router/index.ts          路由与权限守卫（hash 模式）
│   ├── stores/                  Pinia：user / examSession（含节流自动保存）
│   ├── types/models.ts          与 13 张表一一对应的类型定义
│   └── views/                   各模块页面
└── vite.config.ts               开发端口 5180
```

---

## 六、Mock 层实现的真实规则清单

> 完整依据见**内部需求规格与数据库设计文档**（未随仓库发布）；此处只列规则本身与实现位置。

| 规则 | 实现位置 |
|---|---|
| 单选/判断字符串比较、多选集合比较（少选错选均判错） | `rules/judge.ts` |
| 未作答判错并计入分母 | `rules/exam.ts` |
| 试卷首次启用即**永久锁定**，编辑条件 = 停用 且 未锁定 | `rules/lock.ts` |
| 题目被已锁定试卷引用即**继承锁定**（标签除外） | `rules/lock.ts` |
| 被已锁定试卷或历史答题记录引用的题目**禁止删除** | `rules/lock.ts` |
| 启用前置校验（题量/选项/答案/分值合法性） | `rules/judge.ts` + `lock.ts` |
| 简答题 v1 **不判分**：不计分、不进统计、不进错题集 | `rules/exam.ts` |
| 准确率：题级、仅已判分、仅已交卷答题记录、删除答题记录重算 | `rules/stat.ts` |
| 双重加权抽题 `P = base × (1 + wrong_count) × scope_factor` | `rules/compose.ts` |
| 已掌握题目混合抽取权重按 0.3 折减 | `rules/compose.ts` |
| 错题记录维度 = 用户 + 题目 + **分类** | `service/wrongService.ts` |
| 错题作答明细保留每一次作答 | `service/wrongService.ts` |
| 逻辑删除 `deleted = id`（反复删除重建不冲突） | `mock/db.ts` |
| 注销：私有试卷失效、公开试卷保留、历史数据保留 | `service/authService.ts` |
| 隐私态主页不返回统计/记录；公开态裁剪答案与解析 | `service/statService.ts` |
| 密码重置后该用户**全部会话立即失效**；不能取消自己的管理员角色 | `service/authService.ts` |

---

## 七、刻意的简化（Phase 1 边界）

| 项 | Phase 1 | Phase 2（真实后端） |
|---|---|---|
| 存储 | 浏览器 localStorage | MySQL 8.4 + Flyway 迁移 |
| 认证 | localStorage 会话（模拟 Redis Session） | Sa-Token + Redis Session |
| 密码 | 演示用哈希函数 | bcrypt |
| AI 判分 | 未实现（v1 本就不做） | v1.5 接入 |
| 批量导入 | 未实现（v1 手工录入） | v1.5 / v2 |
| 全文检索 | 未实现（v2 启用） | v2 引入 ES + Canal |
| 并发与事务 | 无（单浏览器单用户） | 数据库事务 + 条件更新 + 分布式锁 |

> 迁移路径：`src/api/index.ts` 是唯一契约面，Phase 2 只需把其中的 Mock 实现替换为 axios 调用，
> 页面、store、路由**无需修改**。

---

## 八、已知环境限制

若在受限沙箱环境（如某些 AI 编码工具的受限模式）中运行，Vite 依赖的 **esbuild 需要创建子进程**，可能被拒绝并报 `spawn EPERM`。
请在**普通终端**中执行 `npm run dev`；本项目自身不依赖任何受限能力。

侧栏使用了 Element Plus 自带的 `el-scrollbar`（非原生滚动条），其滑块已置为透明以保持界面干净；
滚动能力不受影响（滚轮 / 触控板 / 键盘 / 拖拽均照常）。

---

## 九、版本控制与部署

| 项 | 说明 |
|---|---|
| 仓库 | https://github.com/Bian-chongzhen/zhilian-exam-demo-web （public） |
| 主分支 | `main`（本地与远程同步） |
| 提交规范 | Conventional Commits：`feat` / `fix` / `style` / `a11y` / `chore` / `docs` / `refactor` |
| 不要提交 | `node_modules/`、`.npm-cache/`、`dist/`、`.env*`、`scripts/smoke/.build*.mjs`（构建产物）—— 均已写入 `.gitignore` |
| 部署 | 腾讯云 CloudBase，代码源同步 GitHub `main` 分支，**推送即自动构建并部署** |
| 回滚 | `git revert <commit>`；或 `git checkout <commit> -- <path>` 取回单个文件 |

常用操作：

```bash
git status                 # 看改动
git add -A && git commit -m "style(xxx): 说明"
git push                   # 推送到 GitHub（并触发 CloudBase 自动部署）
git log --oneline -10      # 看最近提交
```

> ⚠️ 推送 `main` 会触发 CloudBase 自动部署，**推送前请确认 `npm run typecheck` 与 `npm run smoke` 均通过**。
