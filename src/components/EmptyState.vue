<script setup lang="ts">
/**
 * 统一空状态（16 号 C-4 / §6.4，验收 S-12）
 *
 * 版式固定为三段：图标 + 一句具体文案 + 一个明确操作按钮（可省略按钮）。
 * 图标来自 Iconify `ph` 图标集（与全站业务图标同源），不使用 Emoji 或外链插画，
 * 保证 Demo 离线可用、体积达标（16 号 §8.2）。
 *
 * 表格内部的小空态仍用紧凑 `.empty-hint`（§6.4.2），不套用本组件。
 */
import EmptyIllustration from '@/components/EmptyIllustration.vue'

withDefaults(
  defineProps<{
    /** Iconify ph 图标名，如 'ph:books' */
    icon?: string
    /** 空状态标题（一句具体的事实/引导） */
    title?: string
    /** 补充说明 */
    desc?: string
    /** 操作按钮文案；不传则不渲染按钮 */
    actionText?: string
    /** 紧凑版式：用于卡片内 / 窄面板 */
    compact?: boolean
  }>(),
  {
    icon: 'ph:tray',
    title: '',
    desc: '',
    actionText: '',
    compact: false,
  },
)

const emit = defineEmits<{ action: [] }>()
</script>

<template>
  <div class="empty-state" :class="{ 'empty-state--compact': compact }">
    <!-- 页面级空状态用插画（§6.4.1）；紧凑态退回 ph 图标，避免在窄面板里占过大面积（§6.4.2） -->
    <EmptyIllustration v-if="!compact" />
    <Icon v-else :icon="icon" class="empty-state__icon" />
    <div v-if="title" class="empty-state__title">{{ title }}</div>
    <div v-if="desc" class="empty-state__desc">{{ desc }}</div>
    <div v-if="actionText" class="empty-state__actions">
      <el-button type="primary" plain @click="emit('action')">{{ actionText }}</el-button>
    </div>
  </div>
</template>
