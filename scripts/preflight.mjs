#!/usr/bin/env node
/**
 * 本地一键校验脚本
 * 对应《6、技术选型与技术方案》9.4 节：项目不引入 CI/CD，
 * 由本脚本替代流水线的"提交前检查"，把人工清单变成可执行退出码。
 *
 * 用法：npm run release:check
 */
import { spawnSync } from 'node:child_process'
import { existsSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const isWindows = process.platform === 'win32'
const npmCmd = isWindows ? 'npm.cmd' : 'npm'

const results = []

function runStep(name, command, args, options = {}) {
  process.stdout.write(`\n▶ ${name}\n  $ ${command} ${args.join(' ')}\n`)
  const result = spawnSync(command, args, {
    stdio: 'inherit',
    shell: isWindows,
    ...options,
  })
  const ok = result.status === 0
  results.push({ name, ok })
  console.log(ok ? `  ✅ 通过` : `  ❌ 失败（退出码 ${result.status}）`)
  return ok
}

console.log('===== 知练题库 Demo · 本地校验 =====')

/* 步骤 1：TypeScript 类型检查（无 lint 情况下的唯一静态保障） */
runStep('前端类型检查（vue-tsc）', npmCmd, ['run', 'typecheck'])

/* 步骤 2：图标子集校验
 * 图标名写错在离线环境下不会报错，只会渲染成空白方块，且 vue-tsc 查不出来（图标名是字符串）。
 * 这里同时校验「图标名存在」与「子集产物与源码同步」（新增图标后需 npm run icons:sync）。
 */
runStep('图标子集校验（Iconify ph）', npmCmd, ['run', 'icons:check'])

/* 步骤 3：契约校验
 * Phase 1 使用本地 Mock 层，没有后端 OpenAPI 可生成，此处跳过并提示；
 * Phase 2 接入 Spring Boot 后，改为执行 npm run api:gen 并比对 schema.d.ts 的 diff。
 */
const openapiMarker = join(process.cwd(), 'src', 'api', 'schema.d.ts')
if (existsSync(openapiMarker)) {
  runStep('契约校验（OpenAPI → TS 类型 diff）', npmCmd, ['run', 'api:gen'])
} else {
  console.log('\n▶ 契约校验（OpenAPI → TS 类型 diff）\n  ⏭ 跳过：Phase 1 使用本地 Mock 层，尚无后端契约')
  results.push({ name: '契约校验', ok: true, skipped: true })
}

/* 步骤 4：数据库迁移脚本清点（Phase 2 接入 Flyway 后生效） */
const migrationDir = join(process.cwd(), 'src', 'main', 'resources', 'db', 'migration')
if (existsSync(migrationDir)) {
  const files = readdirSync(migrationDir).filter((f) => f.endsWith('.sql'))
  console.log(`\n▶ 数据库迁移脚本清点\n  发现 ${files.length} 个脚本，请人工确认已在测试环境执行：`)
  files.forEach((f) => console.log(`    - ${f}`))
  results.push({ name: '迁移脚本清点', ok: true })
} else {
  console.log('\n▶ 数据库迁移脚本清点\n  ⏭ 跳过：Phase 2 引入后端与 Flyway 后生效')
  results.push({ name: '迁移脚本清点', ok: true, skipped: true })
}

/* 汇总报告 */
console.log('\n===== 检查报告 =====')
results.forEach((r) => {
  const mark = r.skipped ? '⏭ 跳过' : r.ok ? '✅ 通过' : '❌ 失败'
  console.log(`${mark}  ${r.name}`)
})
const failed = results.filter((r) => !r.ok)
console.log(
  failed.length === 0
    ? '\n全部检查通过，可以提交。'
    : `\n有 ${failed.length} 项检查未通过，请修复后再提交。`,
)
process.exit(failed.length === 0 ? 0 : 1)
