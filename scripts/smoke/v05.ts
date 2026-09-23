/**
 * v0.5 服务层冒烟测试
 *
 * 为什么需要：本仓库没有浏览器/端到端环境（沙箱内起不了 Vite），
 * vue-tsc 只能保证类型，**保证不了规则**。这个脚本用 esbuild 打成 Node 可执行文件，
 * 直接对契约面 + Mock 服务层做真实断言，覆盖《13、知练题库 v0.5 需求规格文档.md》
 * §6.1 的 UM-01 ~ UM-07 与 §6.3 的 PER-01、§4.3 的游客禁写。
 *
 * 运行：npm run smoke
 * 落点：只操作内存里的 localStorage 替身，**不会污染浏览器中的演示数据**。
 */
import './stub.mjs'
import { api, ApiError } from '../../src/api/index'
import { ApiCode } from '../../src/constants/apiCodes'
import { Copy } from '../../src/constants/copy'
import { RoleType } from '../../src/constants/enums'
import {
  getDb,
  getSession,
  isSessionStale,
  sessionEpochOf,
  setSession,
} from '../../src/mock/db'
import { currentUser, login, logout } from '../../src/mock/service/authService'

let pass = 0
let fail = 0

function check(name: string, ok: boolean, detail = '') {
  if (ok) {
    pass++
    console.log(`  ✅ ${name}`)
  } else {
    fail++
    console.log(`  ❌ ${name}${detail ? ' → ' + detail : ''}`)
  }
}

async function expectApiError(
  name: string,
  fn: () => Promise<unknown>,
  code: ApiCode,
  msg?: string,
) {
  try {
    await fn()
    check(name, false, '没有抛错')
  } catch (e) {
    const err = e as ApiError
    const codeOk = err instanceof ApiError && err.code === code
    const msgOk = msg === undefined || err.message === msg
    check(name, codeOk && msgOk, `实际 code=${err.code} msg=${err.message}`)
  }
}

function userByName(name: string) {
  const u = getDb().users.find((x) => x.username === name)
  if (!u) throw new Error(`种子数据缺少账号 ${name}`)
  return u
}

async function main() {
  console.log('\n【前置】清理会话，模拟游客')
  logout()
  check('游客身份：currentUser() 为 null', currentUser() === null)

  console.log('\n【§4.3 / PER-01】游客不允许任何写入，也不允许调用管理端接口')
  await expectApiError('游客调用用户列表 → 401', () => api.user.adminList(), ApiCode.SESSION)
  await expectApiError(
    '游客调用写接口（传入真实用户 id）→ 401',
    () => api.draft.create(userByName('alice').id, { draftName: 'x' } as never),
    ApiCode.SESSION,
  )
  await expectApiError(
    '游客调用角色切换 → 401',
    () => api.user.adminSwitchRole(userByName('alice').id),
    ApiCode.SESSION,
  )

  const alice = userByName('alice')
  const admin = userByName('admin')
  const carol = userByName('carol')

  await api.auth.login({ mode: 'username', username: 'alice', password: '123456' })
  await expectApiError(
    '普通用户调用用户列表 → 403（PER-01）',
    () => api.user.adminList(),
    ApiCode.NO_PERMISSION,
  )
  check('普通用户身份判定为普通用户', currentUser()?.roleType === RoleType.USER)
  logout()

  console.log('\n【UM-01/02】管理员可访问；列表含已注销账号')
  await api.auth.login({ mode: 'username', username: 'admin', password: '123456' })
  const all = await api.user.adminList()
  check('管理员可拉取列表', all.length >= 5, `实际 ${all.length} 条`)
  check('列表不含密码哈希', all.every((u) => !('password' in u)))
  const carolRow = all.find((u) => u.id === carol.id)
  check('已注销账号 carol 出现在列表中', !!carolRow)
  check('carol 标记为已注销且有注销时间', carolRow?.deactivated === true && !!carolRow?.deleteTime)
  check('管理员自己标记 isSelf', all.find((u) => u.id === admin.id)?.isSelf === true)

  console.log('\n【UM-03/04】已注销账号不可重置密码、不可切换角色')
  await expectApiError(
    '对 carol 重置密码 → 403 + 固定文案',
    () => api.user.adminResetPassword(carol.id, 'newpass123'),
    ApiCode.NO_PERMISSION,
    Copy.accountDeactivated,
  )
  await expectApiError(
    '对 carol 切换角色 → 403 + 固定文案',
    () => api.user.adminSwitchRole(carol.id),
    ApiCode.NO_PERMISSION,
    Copy.accountDeactivated,
  )

  console.log('\n【UM-05】管理员不能取消自己的管理员角色')
  await expectApiError(
    '对自己切换角色 → 403 + 固定文案',
    () => api.user.adminSwitchRole(admin.id),
    ApiCode.NO_PERMISSION,
    Copy.cannotCancelOwnAdmin,
  )

  console.log('\n【UM-06】重置密码 → 该用户全部在线会话失效')
  logout()
  await api.auth.login({ mode: 'username', username: 'alice', password: '123456' })
  const aliceSession = getSession()
  const epochBefore = sessionEpochOf(alice.id)
  check('alice 会话初始未失效', isSessionStale(aliceSession) === false)

  logout()
  await api.auth.login({ mode: 'username', username: 'admin', password: '123456' })
  await api.user.adminResetPassword(alice.id, 'newpass123')
  check('会话版本号已提升', sessionEpochOf(alice.id) === epochBefore + 1)
  check('alice 原会话被判定为失效', isSessionStale(aliceSession) === true)

  setSession(aliceSession)
  check('旧会话写回后 currentUser() 仍为 null（已作废）', currentUser() === null)
  check('作废会话已被清除', getSession().userId === null)
  await expectApiError(
    '旧密码登录失败',
    () => api.auth.login({ mode: 'username', username: 'alice', password: '123456' }),
    ApiCode.GENERIC,
  )
  await api.auth.login({ mode: 'username', username: 'alice', password: 'newpass123' })
  check('新密码可登录', currentUser()?.username === 'alice')

  console.log('\n【UM-07】切换角色 → 下次登录生效，当前会话不变')
  const aliceOldSession = getSession()
  logout()
  await api.auth.login({ mode: 'username', username: 'admin', password: '123456' })
  const nextRole = await api.user.adminSwitchRole(alice.id)
  check('返回的新角色为管理员', nextRole === RoleType.ADMIN)
  check('数据库角色已改为管理员', userByName('alice').roleType === RoleType.ADMIN)

  setSession(aliceOldSession)
  check('旧会话仍按「普通用户」判定（角色快照优先）', currentUser()?.roleType === RoleType.USER)
  await expectApiError('旧会话仍无权访问管理端 → 403', () => api.user.adminList(), ApiCode.NO_PERMISSION)

  logout()
  await api.auth.login({ mode: 'username', username: 'alice', password: 'newpass123' })
  check('重新登录后角色变为管理员', currentUser()?.roleType === RoleType.ADMIN)
  check('重新登录后可访问管理端列表', (await api.user.adminList()).length > 0)

  // 复原演示数据，避免影响后续（内存库本就会随进程结束丢弃，这里只是让断言更严格）
  logout()
  await api.auth.login({ mode: 'username', username: 'admin', password: '123456' })
  await api.user.adminSwitchRole(alice.id)
  await api.user.adminResetPassword(alice.id, '123456')
  check('已复原 alice 的角色与密码', userByName('alice').roleType === RoleType.USER)

  console.log('\n【筛选】账号状态 + 用户名关键字')
  const deactivated = await api.user.adminList({ accountStatus: 'deactivated' })
  check('筛选「已逻辑注销」只返回注销账号', deactivated.length === 1 && deactivated[0].id === carol.id)
  const normal = await api.user.adminList({ accountStatus: 'normal' })
  check('筛选「正常」不含注销账号', normal.every((u) => !u.deactivated) && normal.length >= 4)
  const keyword = await api.user.adminList({ keyword: 'ali' })
  check('用户名关键字过滤生效', keyword.length === 1 && keyword[0].username === 'alice')

  console.log('\n【错误码】S3 / S4 语义（页面据此原地提示）')
  logout()
  const privateDraft = getDb().drafts.find((d) => d.visibility === 1 && d.deleted === 0)
  if (privateDraft) {
    await expectApiError(
      '游客访问他人私有试卷 → 403（S3）',
      () => api.draft.detail(privateDraft.id, null),
      ApiCode.NO_PERMISSION,
    )
  }
  await expectApiError(
    '访问不存在的试卷 → 404（S4）',
    () => api.draft.detail(999999, null),
    ApiCode.NOT_FOUND,
  )

  console.log('\n【回归】注册 / 登录 / 找回密码在无会话时仍可用（allowGuest 白名单）')
  const created = await api.auth.register({
    username: `smoke_${Date.now().toString(36)}`,
    password: 'abc123',
    phone: '13900000000',
  })
  check('游客可注册', !!created?.id)
  await api.auth.login({ mode: 'username', username: 'admin', password: '123456' })
  check('可登录', currentUser()?.username === 'admin')

  console.log('\n【批次3】Actor 一致性：不允许以他人身份读写（13 号 §5.3）')
  const bob = userByName('bob')
  logout()
  await api.auth.login({ mode: 'username', username: 'alice', password: '123456' })

  await expectApiError(
    '以他人身份读取错题集 → 403',
    () => api.wrong.list(bob.id),
    ApiCode.NO_PERMISSION,
  )
  await expectApiError(
    '以他人身份创建试卷 → 403',
    () => api.draft.create(bob.id, { draftName: 'x' } as never),
    ApiCode.NO_PERMISSION,
  )
  await expectApiError(
    '以他人身份查看答题记录 → 403',
    () => api.exam.detail(1, bob.id),
    ApiCode.NO_PERMISSION,
  )
  await expectApiError(
    '以他人身份切换试卷状态 → 403',
    () => api.draft.switchStatus(1, bob.id, 1),
    ApiCode.NO_PERMISSION,
  )
  // 参数位置校验：userId 在第 2 个参数的方法（如 attachQuestion）也要拦住
  await expectApiError(
    '第 2 参数为发起者的方法同样被拦截 → 403',
    () => api.draft.moveQuestion(1, bob.id, 1, 1),
    ApiCode.NO_PERMISSION,
  )

  // 反向验证：以本人身份读写必须正常（防止校验误伤）
  let selfReadOk = false
  try {
    await api.wrong.counts(alice.id)
    selfReadOk = true
  } catch {
    selfReadOk = false
  }
  check('以本人身份读取错题集正常（校验不误伤）', selfReadOk)
  let selfWriteOk = false
  try {
    await api.user.updateProfile(alice.id, { profile: '冒烟测试写入' })
    selfWriteOk = true
  } catch {
    selfWriteOk = false
  }
  check('以本人身份写入正常（校验不误伤）', selfWriteOk)

  console.log(`\n===== 结果：通过 ${pass} 项，失败 ${fail} 项 =====`)
  process.exit(fail === 0 ? 0 : 1)
}

main().catch((e) => {
  console.error('\n冒烟测试异常终止：', e)
  process.exit(1)
})
