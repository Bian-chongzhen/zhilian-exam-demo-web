<script setup lang="ts">
/**
 * 收藏按钮（v1-plus 模块3，全站收口）
 *
 * 依据 14 号 模块3 与 15 号 FA-02 / FA-04 / FA-07：
 *   - 未收藏 / 已收藏 由图标区分（Iconify `ph:star` / `ph:star-fill`），点击切换并给 toast
 *   - **文案里不再拼 ☆ / ⭐ 字符**：图标已经表达状态，再拼字符会出现「图标星 + 字符星」
 *     两颗星；且 ⭐ 属 Emoji，违反 16 号 D-6（禁止 Emoji 充当功能图标）与 §8.1（图标统一 Iconify）
 *   - `compact`：只显示星标图标（用于卡片内等空间紧凑处）；非 compact 为「图标 + 收藏 / 已收藏」
 *   - 同一用户不能重复收藏同一资源（服务层唯一性兜底）
 *   - 游客：S1 置灰 + tooltip「登录后可用」+ 点击弹登录（复用 v0.5 的 GuestGuard）
 *   - 收藏只是个人标记，**不会改变资源业务状态**
 *
 * 收口理由：收藏按钮出现在试卷详情、错题卡片、知识点详情与广场卡片四处，
 * 若各页自行实现，「已收藏/未收藏」的取数、文案与游客处理必然漂移。
 */
import { onMounted, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { api } from '@/api'
import { FavoriteTargetType } from '@/constants/enums'
import { useUserStore } from '@/stores/user'
import GuestGuard from '@/components/GuestGuard.vue'

const props = withDefaults(
  defineProps<{
    targetType: FavoriteTargetType
    targetId: number
    /**
     * 父级批量拿到的初始状态（列表页为避免逐条请求时传入）。
     * 传 undefined 表示由本组件自行查询。
     */
    initial?: boolean
    size?: 'small' | 'default'
    /** 紧凑模式：只显示星标图标，不带文字 */
    compact?: boolean
  }>(),
  { initial: undefined, size: 'small', compact: false },
)

const emit = defineEmits<{ (e: 'change', favorited: boolean): void }>()

const userStore = useUserStore()
const favorited = ref(props.initial ?? false)
const busy = ref(false)

watch(
  () => props.initial,
  (value) => {
    if (value !== undefined) favorited.value = value
  },
)

onMounted(async () => {
  if (props.initial !== undefined || userStore.isGuest) return
  try {
    favorited.value = await api.favorite.isFavorited(
      userStore.userId,
      props.targetType,
      props.targetId,
    )
  } catch {
    // 收藏状态取不到不影响主流程（按钮保持未收藏）
    favorited.value = false
  }
})

async function toggle() {
  if (userStore.isGuest) return // 由 GuestGuard 承接点击引导
  busy.value = true
  try {
    const next = await api.favorite.toggle(userStore.userId, props.targetType, props.targetId)
    favorited.value = next
    emit('change', next)
    ElMessage.success(next ? '已收藏' : '已取消收藏')
  } catch (e) {
    ElMessage.error((e as Error).message)
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <GuestGuard>
    <el-button
      :size="size"
      :type="favorited ? 'primary' : 'default'"
      :plain="favorited"
      :disabled="userStore.isGuest"
      :loading="busy"
      @click="toggle"
    >
      <Icon :icon="favorited ? 'ph:star-fill' : 'ph:star'" :class="{ 'fav-icon': !compact }" />
      <span v-if="!compact">{{ favorited ? '已收藏' : '收藏' }}</span>
    </el-button>
  </GuestGuard>
</template>

<style scoped>
.fav-icon {
  margin-right: 4px;
  font-size: 14px;
}
</style>
