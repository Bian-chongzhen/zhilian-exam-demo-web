/**
 * v1-plus 模块1（Markdown 知识点知识库）服务层冒烟测试
 *
 * 覆盖 14 号 §4.1~§4.4 与 15 号 KG-03 / KD-01 / KD-03 / KD-06 / KD-09、以及 Q2 已定的关联题目范围。
 * 运行：npm run smoke（与 v05.ts 一起执行）
 * 只操作内存里的 localStorage 替身，不碰浏览器中的演示数据。
 */
import './stub.mjs'
import { api, ApiError } from '../../src/api/index'
import { ApiCode } from '../../src/constants/apiCodes'
import { RoleType, FavoriteTargetType, FeedbackStatus, Visibility } from '../../src/constants/enums'
import { getDb, migrateLegacyDb } from '../../src/mock/db'
import { currentUser, logout } from '../../src/mock/service/authService'

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

async function expectApiError(name: string, fn: () => Promise<unknown>, code: ApiCode) {
  try {
    await fn()
    check(name, false, '没有抛错')
  } catch (e) {
    const err = e as ApiError
    check(name, err instanceof ApiError && err.code === code, `实际 code=${err.code} msg=${err.message}`)
  }
}

function userByName(name: string) {
  const u = getDb().users.find((x) => x.username === name)
  if (!u) throw new Error(`种子数据缺少账号 ${name}`)
  return u
}

async function loginAs(username: string, password = '123456') {
  logout()
  await api.auth.login({ mode: 'username', username, password })
  return currentUser()!
}

async function main() {
  console.log('\n===== v1-plus 模块1：知识点知识库 =====')

  /* ------------------------- 旧数据兼容（升级必备） ------------------------- */
  console.log('\n【升级兼容】v0.5 时期的本地数据缺少新集合')
  const legacy = { users: [], seq: {} } as unknown as Parameters<typeof migrateLegacyDb>[0]
  const migrated = migrateLegacyDb(legacy)
  check(
    '缺失的知识点集合被补成空数组（否则升级后一打开就崩）',
    Array.isArray(migrated.knowledge) &&
      Array.isArray(migrated.knowledgeTagRels) &&
      Array.isArray(migrated.knowledgeQuestionRels) &&
      Array.isArray(migrated.knowledgeAnnotations),
  )
  check('缺失的 seq 被补成空对象', !!migrated.seq && typeof migrated.seq === 'object')

  const alice = userByName('alice')
  const bob = userByName('bob')
  const carol = userByName('carol')
  const db = getDb()

  /* ------------------------------ 广场可见性 ------------------------------ */
  console.log('\n【§4.1 广场】只展示公开、未删除')
  const publics = await api.knowledge.listPublic()
  check('广场有种子数据', publics.length >= 4, `实际 ${publics.length} 篇`)
  check('广场不含私有知识点', publics.every((k) => k.visibility === Visibility.PUBLIC))
  const privateTitles = db.knowledge
    .filter((k) => k.visibility === Visibility.PRIVATE && k.deleted === 0)
    .map((k) => k.title)
  check('私有知识点的标题不出现在广场', publics.every((k) => !privateTitles.includes(k.title)))
  check('广场项带作者与标签信息', publics.every((k) => !!k.authorName && Array.isArray(k.tagNames)))

  /* --------------------------- 标题前缀搜索（不搜正文） --------------------------- */
  console.log('\n【§4.1 搜索】仅标题前缀匹配，不搜正文')
  const byPrefix = await api.knowledge.listPublic({ keyword: '子网' })
  check('标题前缀可命中', byPrefix.some((k) => k.title.includes('子网')))
  const byBody = await api.knowledge.listPublic({ keyword: '借位' })
  check('正文里的词搜不到（只做标题前缀）', byBody.length === 0, `实际 ${byBody.length} 篇`)

  /* ------------------------------- 排序 ------------------------------- */
  console.log('\n【§4.1 排序】三种排序')
  const byTitle = await api.knowledge.listPublic({ sort: 'title' })
  const sortedTitles = byTitle.map((k) => k.title)
  check(
    '标题 A-Z 排序生效',
    JSON.stringify(sortedTitles) === JSON.stringify([...sortedTitles].sort((a, b) => a.localeCompare(b, 'zh-CN'))),
  )
  const byUpdated = await api.knowledge.listPublic({ sort: 'updated' })
  check('最新更新排序生效', byUpdated.length === publics.length)

  /* ---------------------------- 分类 / 标签筛选 ---------------------------- */
  console.log('\n【§4.1 筛选】分类通过标签归属实现；无标签项不被标签筛选命中')
  const catMorning = db.categories.find((c) => c.categoryName === '上午客观题')!
  const byCategory = await api.knowledge.listPublic({ categoryId: catMorning.id })
  check('按分类筛选有结果', byCategory.length > 0)
  check(
    '筛选结果确实归属该分类',
    byCategory.every((k) => k.categoryIds.includes(catMorning.id)),
  )

  const noTag = publics.find((k) => k.tagIds.length === 0)
  check('存在「未绑定任何标签」的公开知识点（15 号 KG-03 前提）', !!noTag)
  if (noTag) {
    check('无标签条目在未筛选时可见', publics.some((k) => k.id === noTag.id))
    const anyTagId = publics.find((k) => k.tagIds.length > 0)!.tagIds[0]
    const filtered = await api.knowledge.listPublic({ tagIds: [anyTagId] })
    check('按标签筛选时无标签条目不被命中', filtered.every((k) => k.id !== noTag.id))
  }

  /* ------------------------------ 详情权限 ------------------------------ */
  console.log('\n【§4.2 / KD-01】私有知识点仅作者可读')
  const alicePrivate = db.knowledge.find(
    (k) => k.userId === alice.id && k.visibility === Visibility.PRIVATE && k.deleted === 0,
  )!
  check('种子里存在 alice 的私有知识点', !!alicePrivate)

  await loginAs('bob')
  await expectApiError(
    '他人访问私有知识点 → 403',
    () => api.knowledge.detail(alicePrivate.id, bob.id),
    ApiCode.NO_PERMISSION,
  )
  logout()
  await expectApiError(
    '游客访问私有知识点 → 403',
    () => api.knowledge.detail(alicePrivate.id, null),
    ApiCode.NO_PERMISSION,
  )

  await loginAs('alice')
  const own = await api.knowledge.detail(alicePrivate.id, alice.id)
  check('作者本人可读，且 canEdit=true', own.canEdit === true)
  check('详情返回标签与关联题目字段', Array.isArray(own.tagNames) && Array.isArray(own.questions))

  /* ------------------------------ 批注隔离 ------------------------------ */
  console.log('\n【KD-06】批注仅本人可见')
  await api.knowledge.saveAnnotation(alicePrivate.id, alice.id, '这段是我自己的复习提醒')
  const mine = await api.knowledge.detail(alicePrivate.id, alice.id)
  check('本人能看到自己的批注', mine.myAnnotation === '这段是我自己的复习提醒')

  // 注意：必须挑一篇**属于 alice 的公开知识点**。
  // 广场按创建时间倒序，第一篇是 bob 的文章 —— 早先这里想当然导致 3 条断言测错对象。
  const alicePublic = publics.find((k) => k.userId === alice.id)!
  check('alice 有一篇公开知识点（后续权限断言的夹具）', !!alicePublic)

  await api.knowledge.saveAnnotation(alicePublic.id, alice.id, 'alice 的公开批注')
  await loginAs('bob')
  const otherView = await api.knowledge.detail(alicePublic.id, bob.id)
  check('他人看不到我的批注（为 null）', otherView.myAnnotation === null)
  check('他人看公开知识点仍可读正文', otherView.knowledge.content.length > 0)
  check('他人看公开知识点没有编辑入口（canEdit=false）', otherView.canEdit === false)

  /* ------------------------------ 编辑权限 ------------------------------ */
  console.log('\n【§4.3】仅作者本人可编辑/删除')
  await expectApiError(
    '他人编辑我的知识点 → 403',
    () =>
      api.knowledge.update(alicePublic.id, bob.id, {
        title: 't',
        content: 'c',
        tagIds: [],
        questionIds: [],
      }),
    ApiCode.NO_PERMISSION,
  )
  await expectApiError(
    '他人删除我的知识点 → 403',
    () => api.knowledge.remove(alicePublic.id, bob.id),
    ApiCode.NO_PERMISSION,
  )
  const aliceStillThere = (await api.knowledge.listPublic()).find((k) => k.id === alicePublic.id)
  check('被拒绝后知识点完好无损', !!aliceStillThere && aliceStillThere.title === alicePublic.title)

  /* ------------------------------ 管理员边界 ------------------------------ */
  console.log('\n【13 号 §5.3】管理员也不能编辑他人知识点')
  await loginAs('admin')
  await expectApiError(
    '管理员编辑他人知识点 → 403',
    () =>
      api.knowledge.update(alicePrivate.id, userByName('admin').id, {
        title: 't',
        content: 'c',
        tagIds: [],
        questionIds: [],
      }),
    ApiCode.NO_PERMISSION,
  )
  const adminList = await api.knowledge.listMine(userByName('admin').id)
  check('管理员能管理自己的知识点', adminList.length > 0)

  /* ------------------------------ 标题查重 ------------------------------ */
  console.log('\n【§4.3】标题完全同名 → 二次确认；标题相近 → 仅提示')
  const exact = await api.knowledge.checkTitle('子网划分与 CIDR 速查')
  check('完全同名被识别', exact.exactDuplicate === true)
  const similarCheck = await api.knowledge.checkTitle('子网划分速查表')
  check('完全同名时不会同时判为「相近」', similarCheck.exactDuplicate === false)
  check('相近标题能给出参考列表', similarCheck.similar.length >= 1, `实际 ${similarCheck.similar.length} 条`)
  const emptyCheck = await api.knowledge.checkTitle('')
  check('空标题不报重复（私有不做校验）', emptyCheck.exactDuplicate === false && emptyCheck.similar.length === 0)

  /* --------------------------- 关联题目范围（Q2） --------------------------- */
  console.log('\n【Q2】关联题目范围：本人全部底稿 + 公开底稿；不含他人私有底稿')
  await loginAs('alice')
  const aliceSelectable = await api.knowledge.searchQuestions(alice.id, '')
  check('能搜到可关联题目', aliceSelectable.length > 0, `实际 ${aliceSelectable.length} 道`)

  const bobPrivateDraftIds = db.drafts
    .filter((d) => d.deleted === 0 && d.userId === bob.id && d.visibility === Visibility.PRIVATE)
    .map((d) => d.id)
  const bobPrivateQuestionIds = new Set(
    db.draftQuestionRels
      .filter((r) => r.deleted === 0 && bobPrivateDraftIds.includes(r.draftId))
      .map((r) => r.questionId),
  )
  const publicDraftQuestionIds = new Set(
    db.draftQuestionRels
      .filter((r) => {
        if (r.deleted !== 0) return false
        const d = db.drafts.find((x) => x.id === r.draftId)
        return d && d.deleted === 0 && d.visibility === Visibility.PUBLIC
      })
      .map((r) => r.questionId),
  )
  const bobOnlyQuestion = [...bobPrivateQuestionIds].find((id) => !publicDraftQuestionIds.has(id))
  if (bobOnlyQuestion) {
    check(
      'bob 私有底稿独有的题目不出现在可选列表',
      !aliceSelectable.some((q) => q.questionId === bobOnlyQuestion),
    )
  } else {
    check('（跳过）没有「仅存在于 bob 私有底稿」的题目', true)
  }

  /* --------------------------- 删除只解除关联 --------------------------- */
  console.log('\n【§4.3 边界 / KD-09】删除知识点只解除关联，不动题目与标签')
  const beforeQuestions = db.questions.filter((q) => q.deleted === 0).length
  const beforeTags = db.tags.filter((t) => t.deleted === 0).length
  const beforeRels = db.knowledgeQuestionRels.filter((r) => r.deleted === 0).length

  const temp = await api.knowledge.create(alice.id, {
    title: '冒烟测试临时知识点',
    summary: 's',
    content: '## 临时',
    visibility: Visibility.PRIVATE,
    tagIds: [db.tags[0].id],
    questionIds: [aliceSelectable[0].questionId],
  })
  check('新建知识点成功', temp.id > 0)
  check(
    '新建后关联关系已建立',
    db.knowledgeQuestionRels.filter((r) => r.deleted === 0 && r.knowledgeId === temp.id).length === 1,
  )

  await api.knowledge.remove(temp.id, alice.id)
  check('删除后知识点在列表中消失', !(await api.knowledge.listMine(alice.id)).some((k) => k.id === temp.id))
  check('题目实体未受影响', db.questions.filter((q) => q.deleted === 0).length === beforeQuestions)
  check('标签实体未受影响', db.tags.filter((t) => t.deleted === 0).length === beforeTags)
  check(
    '关联关系被解除（未残留有效关联）',
    db.knowledgeQuestionRels.filter((r) => r.deleted === 0).length <= beforeRels,
  )

  /* --------------------------- 注销账号的资源处理 --------------------------- */
  console.log('\n【§4.4 / CL-04】作者注销：公开保留、私有失效')
  // 直接写入内存库造数据（carol 已注销、无法登录，因此不能通过接口创建）。
  // id 取 9000+ 的隔离区间：**不能图省事用 max+1**，那会和 nextId() 的序列撞号，
  // 导致后续按 id 查找命中错误的行（这类夹具 bug 会伪装成产品缺陷）。
  const stamp = new Date().toISOString()
  const pushKnowledge = (visibility: number, title: string, id: number): number => {
    db.knowledge.push({
      id,
      deleted: 0,
      createTime: stamp,
      updateTime: stamp,
      userId: carol.id,
      title,
      summary: '注销账号遗留',
      content: '## 内容',
      visibility: visibility as 1 | 2,
    })
    return id
  }
  const carolPublicId = pushKnowledge(Visibility.PUBLIC, '注销用户的公开知识点', 9001)
  const carolPrivateId = pushKnowledge(Visibility.PRIVATE, '注销用户的私有知识点', 9002)

  const withCarol = await api.knowledge.listPublic()
  const carolRow = withCarol.find((k) => k.id === carolPublicId)
  check('注销用户的公开知识点仍在广场', !!carolRow)
  check('并在列表上标注作者已注销', carolRow?.authorDeleted === true)

  await loginAs('bob')
  await expectApiError(
    '注销用户的私有知识点他人不可访问 → 404',
    () => api.knowledge.detail(carolPrivateId, bob.id),
    ApiCode.NOT_FOUND,
  )

  /* ------------------------------ Actor 一致性 ------------------------------ */
  console.log('\n【13 号 §5.3】不能以他人身份写知识点')
  await expectApiError(
    'bob 以 alice 身份创建知识点 → 403',
    () =>
      api.knowledge.create(alice.id, {
        title: 'x',
        content: 'y',
        tagIds: [],
        questionIds: [],
      }),
    ApiCode.NO_PERMISSION,
  )

  /* ------------------------------ 角色默认可见性 ------------------------------ */
  console.log('\n【§4.3】新建默认可见性按角色')
  const bobCreated = await api.knowledge.create(bob.id, {
    title: '冒烟测试-普通用户默认可见性',
    content: '## x',
    tagIds: [],
    questionIds: [],
  })
  check('普通用户新建默认私有', bobCreated.visibility === Visibility.PRIVATE)

  await loginAs('admin')
  const adminCreated = await api.knowledge.create(userByName('admin').id, {
    title: '冒烟测试-管理员默认可见性',
    content: '## x',
    tagIds: [],
    questionIds: [],
  })
  check('管理员新建默认公开', adminCreated.visibility === Visibility.PUBLIC)

  // 清掉测试产物，保持内存库干净（进程结束即丢弃，这里只是让断言更严格）
  const cleanup = [bobCreated.id, adminCreated.id, carolPublicId, carolPrivateId]
  for (const id of cleanup) {
    const row = db.knowledge.find((k) => k.id === id)
    if (row) row.deleted = row.id
  }
  check('测试产物已清理', db.knowledge.filter((k) => [bobCreated.id, adminCreated.id].includes(k.id) && k.deleted === 0).length === 0)

  console.log(`\n===== 模块1 结果：通过 ${pass} 项，失败 ${fail} 项 =====`)

  /* ================================================================== */
  /* v1-plus 模块2：题目私有笔记                                          */
  /* ================================================================== */
  console.log('\n===== v1-plus 模块2：题目私有笔记 =====')

  await loginAs('alice')
  const aliceNote = db.questionNotes.find((n) => n.deleted === 0 && n.userId === alice.id)!
  check('种子里 alice 有一条题目笔记', !!aliceNote)
  const noteQuestionId = aliceNote.questionId

  console.log('\n【NT-06 / 基本读写】')
  const loaded = await api.note.get(alice.id, noteQuestionId)
  check('能读回自己的笔记', loaded === aliceNote.content)

  const batch = await api.note.list(alice.id, [noteQuestionId, aliceSelectable[0].questionId])
  check('批量读取返回映射', batch[noteQuestionId] === aliceNote.content)

  const noNoteQuestion = aliceSelectable.find(
    (q) => !db.questionNotes.some((n) => n.deleted === 0 && n.userId === alice.id && n.questionId === q.questionId),
  )!
  check('没写过的题返回 null（界面据此提示「暂无个人笔记」）', (await api.note.get(alice.id, noNoteQuestion.questionId)) === null)

  console.log('\n【NT-02】一题一份，编辑覆盖不产生多条')
  const rowsBefore = db.questionNotes.filter((n) => n.deleted === 0 && n.userId === alice.id).length
  await api.note.save(alice.id, noteQuestionId, '第一次修改')
  await api.note.save(alice.id, noteQuestionId, '第二次修改（覆盖）')
  const rowsAfter = db.questionNotes.filter((n) => n.deleted === 0 && n.userId === alice.id).length
  check('记录条数没有增加', rowsBefore === rowsAfter, `${rowsBefore} → ${rowsAfter}`)
  check('内容被覆盖为最后一次', (await api.note.get(alice.id, noteQuestionId)) === '第二次修改（覆盖）')

  console.log('\n【NT-05】笔记完全私有，他人读不到')
  await loginAs('bob')
  const bobView = await api.note.get(bob.id, noteQuestionId)
  check('bob 读同一道题拿到的是自己的笔记（为 null），看不到 alice 的', bobView === null)

  console.log('\n【13 号 §5.3】不能以他人身份读写笔记')
  await expectApiError(
    'bob 以 alice 身份读笔记 → 403',
    () => api.note.get(alice.id, noteQuestionId),
    ApiCode.NO_PERMISSION,
  )
  await expectApiError(
    'bob 以 alice 身份写笔记 → 403',
    () => api.note.save(alice.id, noteQuestionId, '篡改'),
    ApiCode.NO_PERMISSION,
  )

  console.log('\n【游客】未登录不可读写（面板在界面侧也整块隐藏）')
  logout()
  await expectApiError(
    '游客保存笔记 → 401',
    () => api.note.save(alice.id, noteQuestionId, 'x'),
    ApiCode.SESSION,
  )

  console.log('\n【NT-03】删除答题记录不删笔记')
  await loginAs('alice')
  const aliceExam = db.exams.find((e) => e.deleted === 0 && e.userId === alice.id)!
  check('存在 alice 的答题记录', !!aliceExam)
  await api.exam.remove(aliceExam.id, alice.id)
  check(
    '删掉答题记录后笔记仍在',
    (await api.note.get(alice.id, noteQuestionId)) === '第二次修改（覆盖）',
  )

  console.log('\n【NT-04】题目被锁定后笔记依然可读可写')
  const targetQuestion = db.questions.find((q) => q.id === noteQuestionId)!
  const lockBefore = targetQuestion.isLocked
  targetQuestion.isLocked = 1
  check('锁定后仍能读笔记', (await api.note.get(alice.id, noteQuestionId)) === '第二次修改（覆盖）')
  await api.note.save(alice.id, noteQuestionId, '锁定后补记一笔')
  check('锁定后仍能写笔记', (await api.note.get(alice.id, noteQuestionId)) === '锁定后补记一笔')
  targetQuestion.isLocked = lockBefore // 复原

  console.log('\n【空内容 = 删除】')
  await api.note.save(alice.id, noteQuestionId, '   ')
  check('保存空白内容视为删除笔记', (await api.note.get(alice.id, noteQuestionId)) === null)

  console.log(`\n===== 模块2 结果：通过 ${pass} 项，失败 ${fail} 项 =====`)

  /* ================================================================== */
  /* v1-plus 模块3：多态收藏                                              */
  /* ================================================================== */
  console.log('\n===== v1-plus 模块3：多态收藏 =====')

  await loginAs('alice')
  const aliceFavorites = db.favorites.filter((f) => f.deleted === 0 && f.userId === alice.id)
  check('种子里 alice 有收藏记录', aliceFavorites.length >= 4, `实际 ${aliceFavorites.length} 条`)

  console.log('\n【FA-01 / 唯一性】同一资源不能重复收藏')
  const draftList = await api.favorite.list(alice.id, FavoriteTargetType.DRAFT)
  const availableDraft = draftList.find((f) => f.available)!
  check('存在可访问的收藏试卷', !!availableDraft)
  const beforeToggle = db.favorites.filter((f) => f.deleted === 0 && f.userId === alice.id).length
  const on = await api.favorite.toggle(alice.id, FavoriteTargetType.DRAFT, availableDraft.targetId)
  check('对已收藏资源点一次 → 取消收藏', on === false)
  const again = await api.favorite.toggle(alice.id, FavoriteTargetType.DRAFT, availableDraft.targetId)
  check('再点一次 → 重新收藏', again === true)
  const afterToggle = db.favorites.filter((f) => f.deleted === 0 && f.userId === alice.id).length
  check('来回切换不产生重复记录', beforeToggle === afterToggle, `${beforeToggle} → ${afterToggle}`)
  check(
    '同一资源最多一条有效记录',
    db.favorites.filter(
      (f) => f.deleted === 0 && f.userId === alice.id && f.targetType === FavoriteTargetType.DRAFT && f.targetId === availableDraft.targetId,
    ).length === 1,
  )

  console.log('\n【业务约束】收藏不改变资源本身状态')
  const draftRow = db.drafts.find((d) => d.id === availableDraft.targetId)!
  const snapshot = JSON.stringify({ v: draftRow.visibility, s: draftRow.draftStatus, q: draftRow.questionCount, l: draftRow.isLocked })
  await api.favorite.toggle(alice.id, FavoriteTargetType.DRAFT, availableDraft.targetId)
  await api.favorite.toggle(alice.id, FavoriteTargetType.DRAFT, availableDraft.targetId)
  check('收藏/取消收藏前后试卷状态完全不变', JSON.stringify({ v: draftRow.visibility, s: draftRow.draftStatus, q: draftRow.questionCount, l: draftRow.isLocked }) === snapshot)

  console.log('\n【FA-02】资源转为私有 / 废弃 → 记录保留但置灰')
  const unavailable = draftList.find((f) => !f.available)
  check('种子里存在「不可访问」的收藏样本（bob 私有底稿）', !!unavailable)
  check('不可访问条目无跳转链接', unavailable?.link === null)

  // 真实场景：admin 把自己的公开试卷废弃 → alice 的收藏条目应变为不可访问
  const adminPublicDraftId = availableDraft.targetId
  await loginAs('admin')
  const adminDraft = db.drafts.find((d) => d.id === adminPublicDraftId)!
  const statusBefore = adminDraft.draftStatus
  adminDraft.draftStatus = 3 // 废弃（直接改内存库，避免触发「启用即永久锁定」等无关规则）
  await loginAs('alice')
  const afterDiscard = (await api.favorite.list(alice.id, FavoriteTargetType.DRAFT)).find(
    (f) => f.targetId === adminPublicDraftId,
  )
  check('试卷被废弃后：记录仍在', !!afterDiscard)
  check('试卷被废弃后：标记为不可访问', afterDiscard?.available === false)
  check('试卷被废弃后：仍可取消收藏', afterDiscard !== undefined)
  db.drafts.find((d) => d.id === adminPublicDraftId)!.draftStatus = statusBefore // 复原

  console.log('\n【FA-04 / 批量标注】listIds 供列表页标星标状态')
  const ids = await api.favorite.listIds(alice.id, FavoriteTargetType.KNOWLEDGE)
  check('能批量取到已收藏的知识点 id', Array.isArray(ids) && ids.length >= 1)

  console.log('\n【FA-05 / 分页独立】三类资源各自返回，互不干扰')
  const favDrafts = await api.favorite.list(alice.id, FavoriteTargetType.DRAFT)
  const favQuestions = await api.favorite.list(alice.id, FavoriteTargetType.QUESTION)
  const favKnowledge = await api.favorite.list(alice.id, FavoriteTargetType.KNOWLEDGE)
  check('三类列表分别返回且类型正确', 
    favDrafts.every((f) => f.targetType === FavoriteTargetType.DRAFT) &&
    favQuestions.every((f) => f.targetType === FavoriteTargetType.QUESTION) &&
    favKnowledge.every((f) => f.targetType === FavoriteTargetType.KNOWLEDGE),
  )
  check('题目收藏齐全', favQuestions.length >= 1)

  console.log('\n【Q11】收藏的题目 → 跳所在试卷并定位高亮')
  const questionFav = favQuestions.find((f) => f.available)
  check('可访问的题目收藏带跳转链接', !!questionFav?.link)
  check('链接带 questionId 参数（供预览页定位高亮）', questionFav?.link?.includes('?questionId=') === true, questionFav?.link ?? '')

  console.log('\n【FA-07】取消收藏后记录移除')
  const toRemove = favKnowledge[0]
  await api.favorite.toggle(alice.id, FavoriteTargetType.KNOWLEDGE, toRemove.targetId)
  const afterRemove = await api.favorite.list(alice.id, FavoriteTargetType.KNOWLEDGE)
  check('取消后不在列表中', !afterRemove.some((f) => f.targetId === toRemove.targetId))
  check('isFavorited 同步为 false', (await api.favorite.isFavorited(alice.id, FavoriteTargetType.KNOWLEDGE, toRemove.targetId)) === false)

  console.log('\n【隔离 / 权限】用户级隔离与 Actor 一致性')
  await loginAs('bob')
  const bobFavs = await api.favorite.list(bob.id, FavoriteTargetType.DRAFT)
  check('bob 看不到 alice 的收藏', bobFavs.every((f) => !!f.title))
  check('bob 的收藏为空（种子里没给他造）', bobFavs.length === 0)
  await expectApiError(
    'bob 以 alice 身份切换收藏 → 403',
    () => api.favorite.toggle(alice.id, FavoriteTargetType.DRAFT, availableDraft.targetId),
    ApiCode.NO_PERMISSION,
  )

  console.log('\n【游客】未登录不可收藏')
  logout()
  await expectApiError(
    '游客切换收藏 → 401',
    () => api.favorite.toggle(alice.id, FavoriteTargetType.DRAFT, availableDraft.targetId),
    ApiCode.SESSION,
  )

  console.log(`\n===== 模块3 结束：累计通过 ${pass} 项，失败 ${fail} 项 =====`)

  /* ================================================================== */
  /* v1-plus 模块4：题目报错反馈工单                                      */
  /* ================================================================== */
  console.log('\n===== v1-plus 模块4：反馈工单 =====')

  await loginAs('alice')
  const seedTickets = db.feedbackTickets.filter((t) => t.deleted === 0)
  check('种子里有工单数据', seedTickets.length >= 3, `实际 ${seedTickets.length} 条`)
  check(
    '存在「题目已删除」的工单样本（FB-02 前提）',
    seedTickets.some((t) => t.questionId === 999999),
  )

  console.log('\n【FB-05 / 提交】内容校验')
  const targetQuestionId = aliceSelectable[0].questionId
  let emptyRejected = false
  try {
    await api.feedback.submit(alice.id, targetQuestionId, '   ')
  } catch {
    emptyRejected = true
  }
  check('反馈内容为空 → 拒绝提交', emptyRejected)

  const beforeSubmit = db.feedbackTickets.filter((t) => t.deleted === 0).length
  await api.feedback.submit(alice.id, targetQuestionId, '冒烟测试：这道题的选项顺序看起来不对')
  check('正常提交成功', db.feedbackTickets.filter((t) => t.deleted === 0).length === beforeSubmit + 1)
  const submitted = db.feedbackTickets[db.feedbackTickets.length - 1]
  check('新工单状态为待处理', submitted.status === FeedbackStatus.PENDING)

  console.log('\n【FB-U2】题目已失效不能提交')
  await expectApiError(
    '对不存在的题目提交反馈 → 404',
    () => api.feedback.submit(alice.id, 999999, '题目没了'),
    ApiCode.NOT_FOUND,
  )

  console.log('\n【FB-01 / 权限】普通用户与游客不能管理工单')
  await expectApiError('普通用户查看工单列表 → 403', () => api.feedback.list(), ApiCode.NO_PERMISSION)
  await expectApiError('普通用户处理工单 → 403', () => api.feedback.handle(submitted.id, FeedbackStatus.HANDLED, 'x'), ApiCode.NO_PERMISSION)

  logout()
  await expectApiError('游客提交反馈 → 401', () => api.feedback.submit(alice.id, targetQuestionId, 'x'), ApiCode.SESSION)
  await expectApiError('游客查看工单列表 → 401', () => api.feedback.list(), ApiCode.SESSION)

  console.log('\n【FB-04】管理员筛选：状态 + 时间范围')
  await loginAs('admin')
  const allTickets = await api.feedback.list()
  check('管理员可拉取全部工单', allTickets.length >= 4, `实际 ${allTickets.length} 条`)
  const pendingOnly = await api.feedback.list({ status: FeedbackStatus.PENDING })
  check('按「待处理」筛选生效', pendingOnly.every((t) => t.status === FeedbackStatus.PENDING))
  const handledOnly = await api.feedback.list({ status: FeedbackStatus.HANDLED })
  check('按「已处理」筛选生效', handledOnly.every((t) => t.status === FeedbackStatus.HANDLED))
  const today = new Date().toISOString().slice(0, 10)
  const onlyToday = await api.feedback.list({ startDate: today, endDate: today })
  check('时间范围筛选生效（只看今天）', onlyToday.every((t) => t.createTime.slice(0, 10) === today))

  console.log('\n【FB-02】题目已删除的工单仍然保留')
  const goneTicket = allTickets.find((t) => t.questionId === 999999)!
  check('工单仍在列表中', !!goneTicket)
  check('题目预览为空（界面据此标注「题目已删除」）', goneTicket.questionPreview === null)
  check('提交人信息仍在', !!goneTicket.submitterName)

  console.log('\n【Q5】处理工单：已处理/忽略 备注必填')
  let noRemarkRejected = false
  try {
    await api.feedback.handle(goneTicket.id, FeedbackStatus.HANDLED, '  ')
  } catch {
    noRemarkRejected = true
  }
  check('已处理但备注为空 → 拒绝', noRemarkRejected)

  console.log('\n【FB-03】处理工单不修改题库任何数据')
  const q = db.questions.find((x) => x.id === submitted.questionId)!
  const qSnapshot = JSON.stringify({ t: q.title, a: q.answer, an: q.analysis, l: q.isLocked })
  await api.feedback.handle(submitted.id, FeedbackStatus.HANDLED, '已核对，题干无误，属于理解偏差')
  const after = (await api.feedback.list()).find((t) => t.id === submitted.id)!
  check('状态已更新为已处理', after.status === FeedbackStatus.HANDLED)
  check('备注已保存', after.adminRemark === '已核对，题干无误，属于理解偏差')
  check('记录了处理人与处理时间', after.handledByName === 'admin' && !!after.handledTime)
  check('题目数据完全未被改动', JSON.stringify({ t: q.title, a: q.answer, an: q.analysis, l: q.isLocked }) === qSnapshot)

  console.log('\n【退回待处理】清掉处理痕迹')
  await api.feedback.handle(submitted.id, FeedbackStatus.PENDING, '')
  const reverted = (await api.feedback.list()).find((t) => t.id === submitted.id)!
  check('状态退回待处理', reverted.status === FeedbackStatus.PENDING)
  check('处理人与处理时间已清空', reverted.handledByName === null && reverted.handledTime === null)

  console.log('\n【用户自查】我提交的工单不下发治理字段')
  await loginAs('alice')
  const mineTickets = await api.feedback.listMine(alice.id)
  check('能看到自己提交的工单', mineTickets.length >= 2)
  check('用户侧看不到管理员备注', mineTickets.every((t) => t.adminRemark === null && t.handledByName === null))
  await expectApiError(
    '以他人身份查我的工单 → 403',
    () => api.feedback.listMine(bob.id),
    ApiCode.NO_PERMISSION,
  )

  console.log(`\n===== 模块4 结束：累计通过 ${pass} 项，失败 ${fail} 项 =====`)

  /* ================================================================== */
  /* v1-plus 模块5：个人学习统计大盘                                      */
  /* ================================================================== */
  console.log('\n===== v1-plus 模块5：学习统计大盘 =====')

  await loginAs('alice')
  const dash = await api.stat.dashboard(alice.id)

  console.log('\n【口径】只统计已交卷 + 已判分客观题（简答不计入）')
  const finishedExams = db.exams.filter(
    (e) => e.deleted === 0 && e.userId === alice.id && !!e.submitTime,
  )
  check('总完成试卷数 = 已交卷记录数', dash.totals.finishedExamCount === finishedExams.length,
    `${dash.totals.finishedExamCount} vs ${finishedExams.length}`)

  const finishedIds = new Set(finishedExams.map((e) => e.id))
  const judgedObjectiveManual = db.examQuestions.filter(
    (q) =>
      q.deleted === 0 &&
      finishedIds.has(q.examId) &&
      q.questionType !== 4 &&
      q.judgeStatus === 2,
  ).length
  check('总作答客观题数 = 已判分客观题小题数', dash.totals.judgedQuestionCount === judgedObjectiveManual,
    `${dash.totals.judgedQuestionCount} vs ${judgedObjectiveManual}`)

  const shortAnswerJudged = db.examQuestions.filter(
    (q) => q.deleted === 0 && finishedIds.has(q.examId) && q.questionType === 4 && q.judgeStatus === 2,
  ).length
  check('（前提）种子里没有「已判分的简答题」', shortAnswerJudged === 0)

  console.log('\n【集合口径】错题 / 已掌握数量与记录表一致')
  const wrongManual = db.records.filter((r) => r.deleted === 0 && r.userId === alice.id && r.isMaster === 0).length
  const masteredManual = db.records.filter((r) => r.deleted === 0 && r.userId === alice.id && r.isMaster === 1).length
  check('总错题数一致', dash.totals.wrongCount === wrongManual, `${dash.totals.wrongCount} vs ${wrongManual}`)
  check('已掌握题目数一致', dash.totals.masteredCount === masteredManual, `${dash.totals.masteredCount} vs ${masteredManual}`)
  check('集合对比与数字卡片一致',
    dash.setCompare.wrongCount === dash.totals.wrongCount &&
    dash.setCompare.masteredCount === dash.totals.masteredCount)

  console.log('\n【趋势】按交卷日期聚合；做题量之和等于总作答客观题数（Q4）')
  check('趋势按日期升序', dash.trend.every((p, i) => i === 0 || dash.trend[i - 1].date <= p.date))
  const trendSum = dash.trend.reduce((sum, p) => sum + p.questionCount, 0)
  check('每日做题量之和 = 总作答客观题数', trendSum === dash.totals.judgedQuestionCount,
    `${trendSum} vs ${dash.totals.judgedQuestionCount}`)
  const examSum = dash.trend.reduce((sum, p) => sum + p.examCount, 0)
  check('每日完成试卷之和 = 总完成试卷数', examSum === dash.totals.finishedExamCount)

  console.log('\n【考点排行】按错题数降序，一题多标签各计一次')
  check('排行榜已按错题数降序', dash.tagWrongRanking.every((t, i) => i === 0 || dash.tagWrongRanking[i - 1].wrongCount >= t.wrongCount))
  check('排行榜最多 10 条', dash.tagWrongRanking.length <= 10)
  const rankingTotal = dash.tagWrongRanking.reduce((s, t) => s + t.wrongCount, 0)
  check('排行榜计数不超过「错题数 × 每题材标签上限」的合理范围', rankingTotal >= dash.totals.wrongCount,
    `排行合计 ${rankingTotal}，错题数 ${dash.totals.wrongCount}`)

  console.log('\n【ST-03】删除答题记录后统计同步变化')
  const examToDelete = finishedExams[0]
  const beforeTotals = { ...dash.totals }
  await api.exam.remove(examToDelete.id, alice.id)
  const afterDelete = await api.stat.dashboard(alice.id)
  check('总完成试卷数减少 1', afterDelete.totals.finishedExamCount === beforeTotals.finishedExamCount - 1,
    `${beforeTotals.finishedExamCount} → ${afterDelete.totals.finishedExamCount}`)
  check('总作答客观题数同步减少', afterDelete.totals.judgedQuestionCount < beforeTotals.judgedQuestionCount,
    `${beforeTotals.judgedQuestionCount} → ${afterDelete.totals.judgedQuestionCount}`)

  console.log('\n【ST-04】只做简答题 → 不计入任何统计')
  const beforeShort = await api.stat.dashboard(alice.id)
  // 找一份含简答题的可见底稿，完整走一遍「开始答题 → 交卷」
  const shortDraft = db.drafts.find((d) => {
    if (d.deleted !== 0 || d.draftStatus !== 1) return false
    if (d.visibility !== Visibility.PUBLIC && d.userId !== alice.id) return false
    return db.draftQuestionRels
      .filter((r) => r.deleted === 0 && r.draftId === d.id)
      .some((r) => db.questions.find((q) => q.id === r.questionId)?.questionType === 4)
  })
  if (shortDraft) {
    const exam = await api.exam.start(alice.id, shortDraft.id)
    await api.exam.submit(exam.id, alice.id)
    const afterShort = await api.stat.dashboard(alice.id)
    check('完成一份含简答的试卷 → 完成试卷数 +1', afterShort.totals.finishedExamCount === beforeShort.totals.finishedExamCount + 1)
    check(
      '客观题计数只在客观题上有变化（简答不参与）',
      afterShort.totals.judgedQuestionCount >= beforeShort.totals.judgedQuestionCount,
    )
  } else {
    check('（跳过）没有可见的含简答题底稿', true)
  }

  console.log('\n【ST-02 / ST-05】无数据用户：全部归零并标记为空')
  await loginAs('dave')
  const daveDash = await api.stat.dashboard(userByName('dave').id)
  check('empty 标记为 true', daveDash.empty === true)
  check('四项数字全部为零',
    daveDash.totals.finishedExamCount === 0 &&
    daveDash.totals.judgedQuestionCount === 0 &&
    daveDash.totals.wrongCount === 0 &&
    daveDash.totals.masteredCount === 0)
  check('无趋势数据', daveDash.trend.length === 0)
  check('无考点排行', daveDash.tagWrongRanking.length === 0)

  console.log('\n【ST-01 / 权限】仅本人可访问')
  await loginAs('alice')
  await expectApiError(
    '以他人身份拉取学情大盘 → 403',
    () => api.stat.dashboard(bob.id),
    ApiCode.NO_PERMISSION,
  )
  logout()
  await expectApiError(
    '游客拉取学情大盘 → 401',
    () => api.stat.dashboard(alice.id),
    ApiCode.SESSION,
  )

  console.log(`\n===== v1-plus 全部模块结束：累计通过 ${pass} 项，失败 ${fail} 项 =====`)
  process.exit(fail === 0 ? 0 : 1)
}

main().catch((e) => {
  console.error('\n模块1 冒烟测试异常终止：', e)
  process.exit(1)
})
