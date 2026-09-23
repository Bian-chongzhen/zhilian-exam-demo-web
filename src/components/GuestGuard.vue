<script setup lang="ts">
/**
 * S1 置灰禁用态外壳
 *
 * 依据《13、知练题库 v0.5 需求规格文档.md》：
 *   - §9.2 S1：控件**真实 disabled**、hover 出 tooltip 说明原因、点击不产生任何写入
 *   - §4.4 方式A（已定案）：游客的禁写按钮「置灰 + tooltip「登录后可用」+ 点击弹登录」
 *
 * 为什么需要遮罩：浏览器不会在 disabled 元素上派发 click 事件（也不冒泡给父元素），
 * 所以「真实 disabled」与「点击有反馈」必须靠一层透明遮罩同时满足。
 *
 * 用法：
 *   <GuestGuard>
 *     <el-button type="primary" :disabled="userStore.isGuest" @click="startExam">开始答题</el-button>
 *   </GuestGuard>
 *
 * 注意：置灰只是界面表现，**服务层同样会拒绝游客写入**（§5.3 安全约束）。
 */
import { computed } from 'vue'
import { useUserStore } from '@/stores/user'
import { useLoginPrompt } from '@/composables/useLoginPrompt'
import { Copy } from '@/constants/copy'

const props = withDefaults(
  defineProps<{
    /** 是否处于禁用条件；不传时按「游客」自动判定（默认场景） */
    disabled?: boolean | null
    /** 置灰原因：必须说明「为什么不能用」，不能只写「不可用」（§9.4） */
    tip?: string
    /** 是否由本组件承接点击引导；外部已单独处理过的场景可置 false */
    interceptClick?: boolean
  }>(),
  { disabled: null, tip: Copy.guestDisabledTip, interceptClick: true },
)

const userStore = useUserStore()
const { promptLogin } = useLoginPrompt()

const isDisabled = computed(() => props.disabled ?? userStore.isGuest)
const showMask = computed(() => isDisabled.value && props.interceptClick)

function onClick(): void {
  if (isDisabled.value) void promptLogin()
}
</script>

<template>
  <el-tooltip :content="tip" :disabled="!isDisabled" placement="top">
    <span class="s1-guard">
      <slot :disabled="isDisabled" />
      <span
        v-if="showMask"
        class="s1-guard__mask"
        role="button"
        tabindex="0"
        @click="onClick"
        @keydown.enter="onClick"
        @keydown.space.prevent="onClick"
      />
    </span>
  </el-tooltip>
</template>
