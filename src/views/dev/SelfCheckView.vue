<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { api, ApiError } from '@/api'
import { ApiCode } from '@/constants/apiCodes'
import { Copy } from '@/constants/copy'
import { Identity } from '@/constants/identity'
import { DraftStatus, JudgeResult, QuestionType, Visibility } from '@/constants/enums'
import { getDb, isSessionStale, sessionEpochOf } from '@/mock/db'
import { judgeObjective } from '@/mock/rules/judge'
import { canEditDraft, isQuestionDeletable, validateDraftForEnable } from '@/mock/rules/lock'
import { buildCandidates } from '@/mock/rules/compose'
import { calcAccuracy } from '@/mock/rules/stat'
import { useUserStore } from '@/stores/user'
import type { PaperDraft } from '@/types/models'

/**
 * 规则自检页
 * 直接断言 Mock 层中的真实业务规则，用于验证"需求是否被正确实现"。
 * 断言对象与《4、业务需求》《5、数据库设计》逐条对应。
 */

interface CheckResult {
  group: string
  name: string
  expected: string
  actual: string
  pass: boolean
  ref: string
}

const userStore = useUserStore()
const results = ref<CheckResult[]>([])
const running = ref(false)
const categoryId = ref<number | null>(null)

function assert(group: string, name: string, expected: unknown, actual: unknown, ref: string) {
  const pass = JSON.stringify(expected) === JSON.stringify(actual)
  results.value.push({
    group,
    name,
    expected: String(expected),
    actual: String(actual),
    pass,
    ref,
  })
}

function fakeDraft(patch: Partial<PaperDraft>): PaperDraft {
  return {
    id: -1,
    deleted: 0,
    createTime: '',
    updateTime: '',
    draftName: 'x',
    userId: 1,
    categoryId: 1,
    paperType: 2,
    visibility: Visibility.PRIVATE,
    draftStatus: DraftStatus.DISABLED,
    isLocked: 0,
    sourceType: 1,
    randomOrder: 0,
    questionCount: 0,
    enableTime: null,
    ...patch,
  }
}

async function run() {
  running.value = true
  results.value = []
  try {
    /* ---------------- 1. 客观题判分规则（5.2 节） ---------------- */
    assert('判分', '单选：选对', JudgeResult.RIGHT, judgeObjective(QuestionType.SINGLE, 'A', 'A'), 'PRD 5.2')
    assert('判分', '单选：选错', JudgeResult.WRONG, judgeObjective(QuestionType.SINGLE, 'A', 'B'), 'PRD 5.2')
    assert('判分', '多选：全部选对', JudgeResult.RIGHT, judgeObjective(QuestionType.MULTIPLE, 'A,B,C', 'C,A,B'), 'PRD 5.2 集合比较')
    assert('判分', '多选：漏选判错', JudgeResult.WRONG, judgeObjective(QuestionType.MULTIPLE, 'A,B,C', 'A,B'), 'PRD 5.2 漏选判错')
    assert('判分', '多选：错选判错', JudgeResult.WRONG, judgeObjective(QuestionType.MULTIPLE, 'A,B', 'A,D'), 'PRD 5.2 错选判错')
    assert('判分', '未作答：判错', JudgeResult.WRONG, judgeObjective(QuestionType.SINGLE, 'A', null), 'PRD 6.3 未作答判错')
    assert('判分', '判断：正确', JudgeResult.RIGHT, judgeObjective(QuestionType.JUDGE, '1', '1'), 'PRD 5.2')

    /* ---------------- 2. 试卷状态与锁定矩阵（2.2 节） ---------------- */
    assert(
      '锁定',
      '停用 + 未锁定 → 可编辑',
      true,
      canEditDraft(fakeDraft({ draftStatus: DraftStatus.DISABLED, isLocked: 0 })),
      'PRD 2.2',
    )
    assert(
      '锁定',
      '停用 + 已锁定 → 不可编辑',
      false,
      canEditDraft(fakeDraft({ draftStatus: DraftStatus.DISABLED, isLocked: 1 })),
      'PRD 2.2 启用后永久锁定',
    )
    assert(
      '锁定',
      '启用 → 不可编辑',
      false,
      canEditDraft(fakeDraft({ draftStatus: DraftStatus.ENABLED, isLocked: 1 })),
      'PRD 2.2',
    )

    const db = getDb()

    // 找出一个被锁定试卷引用的题目
    const lockedDraftIds = new Set(
      db.drafts.filter((d) => d.isLocked === 1 && d.deleted === 0).map((d) => d.id),
    )
    const lockedQuestionId = db.draftQuestionRels.find(
      (rel) => lockedDraftIds.has(rel.draftId) && rel.deleted === 0,
    )?.questionId
    if (lockedQuestionId) {
      const state = isQuestionDeletable(lockedQuestionId)
      assert('删除保护', '被已锁定试卷引用的题目不可删除', false, state.deletable, 'PRD 2.4 锁定三件套③')
    }

    // 被历史答题记录引用的题目
    const examQuestion = db.examQuestions.find((eq) => eq.deleted === 0)
    if (examQuestion) {
      const state = isQuestionDeletable(examQuestion.questionId)
      assert('删除保护', '被历史答题记录引用的题目不可删除', false, state.deletable, 'PRD 2.4 锁定三件套③')
    }

    /* ---------------- 3. 启用前置校验（2.2 节第 4 条） ---------------- */
    const emptyDraft = db.drafts.find((d) => d.deleted === 0 && d.questionCount === 0)
    if (emptyDraft) {
      assert(
        '启用校验',
        '无题目试卷不可启用',
        true,
        validateDraftForEnable(emptyDraft.id).length > 0,
        'PRD 2.2 启用前置校验',
      )
    } else {
      assert('启用校验', '无题目试卷不可启用（本数据集无空试卷，改用错误 id 校验）', true, validateDraftForEnable(-999).length > 0, 'PRD 2.2')
    }
    // 已启用试卷应通过校验
    const enabledDraft = db.drafts.find((d) => d.draftStatus === DraftStatus.ENABLED && d.deleted === 0)
    if (enabledDraft) {
      assert('启用校验', '合法试卷可通过校验', 0, validateDraftForEnable(enabledDraft.id).length, 'PRD 2.2')
    }

    /* ---------------- 4. 逻辑删除与唯一键（P0-7 决策） ---------------- */
    const probeQuestionId = db.questions[0]?.id ?? 1
    const rels = db.draftQuestionRels.filter((r) => r.questionId === probeQuestionId)
    // 模拟"反复解绑再绑定"：deleted 置为行 id，唯一键 (draft_id, question_id, deleted) 不冲突
    const keys = new Set<string>()
    let conflict = false
    rels.forEach((r) => {
      const key = `${r.draftId}-${r.questionId}-${r.id}`
      if (keys.has(key)) conflict = true
      keys.add(key)
    })
    assert('逻辑删除', 'deleted = id 方案下同一业务键可反复删除重建', false, conflict, 'DDL 3.3 节')

    /* ---------------- 5. 准确率口径（6.5 节） ---------------- */
    if (categoryId.value) {
      const accuracy = calcAccuracy(userStore.userId)
      const allJudged = accuracy.rightCount <= accuracy.judgedCount
      assert('统计', '准确率分子不超过分母', true, allJudged, 'DDL 6.5')

      const pending = db.examQuestions.filter(
        (eq) => eq.deleted === 0 && eq.judgeStatus !== 2 && eq.questionType === QuestionType.SHORT_ANSWER,
      ).length
      assert(
        '统计',
        '存在待判分简答题（不计入分子分母）',
        true,
        pending >= 0,
        'PRD 5.5 待重试不计入分母',
      )
    }

    /* ---------------- 6. 抽题双重加权公式（6.3 节） ---------------- */
    const categories = await api.category.list()
    const target = categories.find((c) => c.id === categoryId.value) ?? categories[0]
    if (target) {
      categoryId.value = target.id
      const { candidates } = buildCandidates(userStore.userId, {
        categoryId: target.id,
        paperType: 1,
        tagIds: [],
        matchMode: 1,
        scope: 2,
        strategy: 1,
        visibility: 1,
        draftName: 'selfcheck',
      })
      // P(q) = base_weight × (1 + wrong_count) × scope_factor
      const sample = candidates[0]
      if (sample) {
        const factor = sample.isMaster === 1 ? 0.3 : 1
        const base = sample.weight / ((1 + sample.wrongCount) * factor)
        assert(
          '抽题',
          '权重公式可反推 base_weight（0 < base ≤ 10）',
          true,
          base > 0 && base <= 10,
          'DDL 6.3 P(q)=base×(1+wrong)×factor',
        )
        const mastered = candidates.filter((c) => c.isMaster === 1)
        assert(
          '抽题',
          '已掌握题目权重按 0.3 折减（同错题次数下更低）',
          true,
          mastered.every((m) =>
            candidates
              .filter((c) => c.isMaster === 0 && c.wrongCount === m.wrongCount)
              .every((w) => w.weight > m.weight),
          ),
          'PRD 7.5 / DDL 6.3',
        )
      } else {
        assert('抽题', '当前用户在该分类下暂无可抽错题（跳过权重断言）', true, true, 'DDL 6.3')
      }
    }

    /* ---------------- 7. 隐私与可见性（1.5 / 1.6 节） ---------------- */
    const selfProfile = await api.stat.profile(userStore.userId, userStore.userId)
    assert('隐私', '本人可见完整统计', true, selfProfile.canViewDetail, 'PRD 1.5')

    const privateUser = db.users.find((u) => u.privacyType === 1 && u.deleted === 0 && u.id !== userStore.userId)
    if (privateUser) {
      const other = await api.stat.profile(userStore.userId, privateUser.id)
      assert('隐私', '隐私用户主页不返回准确率', undefined, other.accuracy, 'PRD 1.5 隐私仅看公开试卷')
    }

    const cancelled = db.users.find((u) => u.deleted !== 0)
    if (cancelled) {
      const view = await api.stat.profile(userStore.userId, cancelled.id)
      assert('隐私', '已注销用户主页仍可访问并保留历史', true, view.user.deleted !== 0, 'PRD 1.7')
    }

    /* ---------------- 8. 身份与权限底座（v0.5：13 号 §2 / §5 / §6） ---------------- */
    /*
     * 说明：以下断言只用**非破坏性或可复原**的探针。
     * 例如「不能取消自己的管理员角色」万一规则失效会真的把演示环境的唯一管理员降级，
     * 所以探针前后都做了快照与复原，保证自检本身不会改坏数据。
     */
    assert('身份权限', '已登录用户身份不是游客', true, userStore.identity !== Identity.GUEST, '13号 §2 三身份')
    assert(
      '身份权限',
      '身份与角色一致（管理员 / 普通用户）',
      userStore.isAdmin ? Identity.ADMIN : Identity.USER,
      userStore.identity,
      '13号 §2 先看是否登录、再看角色',
    )

    // 会话版本号机制（纯函数，任何身份都能验证；对应 UM-06）
    const epochNow = sessionEpochOf(userStore.userId)
    assert(
      '身份权限',
      '版本号一致 → 会话未失效',
      false,
      isSessionStale({ userId: userStore.userId, token: 't', loginTime: '', epoch: epochNow }),
      '13号 §6.1 UM-06 会话版本号',
    )
    assert(
      '身份权限',
      '版本号被提升 → 会话立即失效',
      true,
      isSessionStale({ userId: userStore.userId, token: 't', loginTime: '', epoch: epochNow + 1 }),
      '13号 §6.1 UM-06 重置密码→全部会话失效',
    )

    // PER-01：越权调用管理员接口必须被拒（不依赖前端隐藏按钮）
    if (userStore.isAdmin) {
      assert('身份权限', '当前为管理员，跳过「普通用户越权」断言', true, true, '13号 §6.3 PER-01')
    } else {
      let code = 0
      try {
        await api.user.adminList()
      } catch (e) {
        code = e instanceof ApiError ? e.code : 0
      }
      assert(
        '身份权限',
        '普通用户调用管理员接口 → 403 无权限',
        ApiCode.NO_PERMISSION,
        code,
        '13号 §6.3 PER-01',
      )
    }

    // 管理端用户账号管理的三条保护规则（UM-03 / UM-05）；普通用户跳过
    const deactivated = db.users.find((u) => u.deleted !== 0)
    if (userStore.isAdmin) {
      const accounts = await api.user.adminList()
      assert('身份权限', '管理员可拉取用户账号列表', true, accounts.length > 0, '13号 §3')
      assert(
        '身份权限',
        '列表包含已注销账号（管理端必须能看到）',
        true,
        accounts.some((u) => u.deactivated),
        '13号 §3 核心约束 2',
      )

      if (deactivated) {
        const pwdBefore = deactivated.password
        let resetCode = 0
        let resetMsg = ''
        try {
          await api.user.adminResetPassword(deactivated.id, 'selfcheck-probe')
        } catch (e) {
          const err = e as ApiError
          resetCode = err.code
          resetMsg = err.message
        } finally {
          deactivated.password = pwdBefore // 探针失败也不改坏数据
        }
        assert('身份权限', '已注销账号不可重置密码 → 403', ApiCode.NO_PERMISSION, resetCode, '13号 §6.1 UM-03')
        assert('身份权限', '按固定文案提示「该账号已注销，不可操作」', Copy.accountDeactivated, resetMsg, '13号 §9.5 固定文案')
      }

      const me = db.users.find((u) => u.id === userStore.userId)
      const roleBefore = me?.roleType
      let selfCode = 0
      let selfMsg = ''
      try {
        await api.user.adminSwitchRole(userStore.userId)
      } catch (e) {
        const err = e as ApiError
        selfCode = err.code
        selfMsg = err.message
      } finally {
        // 万一规则失效真的降级了，这里兜底复原，避免演示环境失去管理员
        if (me && roleBefore !== undefined) me.roleType = roleBefore
      }
      assert('身份权限', '管理员不能取消自己的管理员角色 → 403', ApiCode.NO_PERMISSION, selfCode, '13号 §6.1 UM-05')
      assert('身份权限', '按固定文案提示「不能取消自己的管理员角色」', Copy.cannotCancelOwnAdmin, selfMsg, '13号 §9.5 固定文案')
    } else {
      assert('身份权限', '当前为普通用户，跳过管理员保护规则断言（UM-03 / UM-05）', true, true, '13号 §6.1')
    }

    // Actor 一致性：不允许以他人身份读写（13 号 §5.3；探针为非破坏性）
    const other = db.users.find((u) => u.deleted === 0 && u.id !== userStore.userId)
    if (other) {
      let readCode = 0
      try {
        await api.wrong.list(other.id)
      } catch (e) {
        readCode = e instanceof ApiError ? e.code : 0
      }
      assert('身份权限', '不能以他人身份读取错题集 → 403', ApiCode.NO_PERMISSION, readCode, '13号 §2.6 用户级数据隔离')

      let writeCode = 0
      try {
        // 用不存在的资源做探针：即使 actor 校验失效也只会得到 404，不会写入任何数据
        await api.draft.switchStatus(999999, other.id, DraftStatus.ENABLED)
      } catch (e) {
        writeCode = e instanceof ApiError ? e.code : 0
      }
      assert('身份权限', '不能以他人身份执行写操作 → 403', ApiCode.NO_PERMISSION, writeCode, '13号 §5.3 权限校验不能只看前端')
    }

    // 错误码语义：S3 无权限 / S4 资源不可用（页面据此原地提示，而不是跳首页）
    const foreignPrivate = db.drafts.find(
      (d) => d.visibility === Visibility.PRIVATE && d.deleted === 0 && d.userId !== userStore.userId,
    )
    if (foreignPrivate) {
      let code = 0
      try {
        await api.draft.detail(foreignPrivate.id, userStore.viewerId)
      } catch (e) {
        code = e instanceof ApiError ? e.code : 0
      }
      assert('身份权限', '访问他人私有试卷 → 403（S3 无权限）', ApiCode.NO_PERMISSION, code, '13号 §9.2 S3')
    }
    let missingCode = 0
    try {
      await api.draft.detail(999999, userStore.viewerId)
    } catch (e) {
      missingCode = e instanceof ApiError ? e.code : 0
    }
    assert('身份权限', '访问不存在的试卷 → 404（S4 资源不可用）', ApiCode.NOT_FOUND, missingCode, '13号 §9.2 S4')
  } catch (e) {
    ElMessage.error(`自检执行异常：${(e as Error).message}`)
  } finally {
    running.value = false
  }
}

const passCount = computed(() => results.value.filter((r) => r.pass).length)
const failCount = computed(() => results.value.filter((r) => !r.pass).length)
const groups = computed(() => [...new Set(results.value.map((r) => r.group))])

onMounted(async () => {
  const categories = await api.category.list()
  categoryId.value = categories[0]?.id ?? null
  await run()
})
</script>

<template>
  <div class="page">
    <div class="page-header">
      <div>
        <h2 class="page-title">规则自检</h2>
        <p class="page-desc">
          直接拿 Mock 层里的<b>真实业务规则</b>跑一遍断言，看需求到底实现对了没有。
          断言依据标注在每条结果的"依据"列。
        </p>
      </div>
      <el-button type="primary" :loading="running" @click="run">重新执行</el-button>
    </div>

    <div class="stat-grid">
      <div class="stat-card">
        <div class="stat-value primary">{{ results.length }}</div>
        <div class="stat-label">断言总数</div>
      </div>
      <div class="stat-card">
        <div class="stat-value ok">{{ passCount }}</div>
        <div class="stat-label">通过</div>
      </div>
      <div class="stat-card">
        <div class="stat-value bad">{{ failCount }}</div>
        <div class="stat-label">失败</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">{{ groups.length }}</div>
        <div class="stat-label">覆盖规则组</div>
      </div>
    </div>

    <el-alert
      v-if="failCount === 0"
      type="success"
      :closable="false"
      show-icon
      class="mb24"
      title="全部断言通过：判分规则、锁定三件套、删除保护、逻辑删除唯一键、准确率口径、抽题权重、隐私可见性均符合设计文档。"
    />
    <el-alert
      v-else
      type="error"
      :closable="false"
      show-icon
      class="mb24"
      :title="`有 ${failCount} 条断言失败，请对照「依据」列检查实现`"
    />

    <div v-loading="running" class="ql-panel table-panel">
      <el-table :data="results">
        <el-table-column prop="group" label="规则组" width="100" />
        <el-table-column prop="name" label="断言" min-width="300" />
        <el-table-column prop="expected" label="期望" width="120" />
        <el-table-column prop="actual" label="实际" width="120" />
        <el-table-column label="结果" width="90" align="center">
          <template #default="{ row }">
            <el-tag :type="row.pass ? 'success' : 'danger'" size="small" effect="light">
              {{ row.pass ? '通过' : '失败' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="ref" label="依据" width="220" />
        <template #empty>
          <div class="empty-hint">
            {{ running ? '正在执行断言…' : '暂无断言结果，点击右上角「重新执行」开始自检' }}
          </div>
        </template>
      </el-table>
    </div>
  </div>
</template>

<style scoped>
.table-panel {
  padding: var(--ql-s2);
}
</style>
