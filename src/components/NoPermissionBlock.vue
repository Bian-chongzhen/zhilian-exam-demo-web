<script setup lang="ts">
/**
 * S3 拦截态 / S4 资源不可用态的统一提示块
 *
 * 依据《13、知练题库 v0.5 需求规格文档.md》：
 *   - §9.2 S3：已登录但无权限 → **原地渲染提示块，URL 不变**，不跳首页、不静默回退
 *   - §9.2 S4：资源已删除 / 已转私有 / 已废弃 → 提示「该资源已不存在或已被删除」
 *   - §9.7-6：三类系统级提示共用同一版式（居中、上下 40px 留白、一个主操作按钮）
 *
 * 版式类 `.state-block` 定义在 global.css §19，全站复用。
 */
import { useRouter } from 'vue-router'
import { useUserStore } from '@/stores/user'
import { IdentityLabel } from '@/constants/identity'
import { Copy } from '@/constants/copy'

withDefaults(
  defineProps<{
    /** 标题：默认「无权访问」，S4 场景传「该资源已不存在或已被删除」 */
    title?: string
    /** 说明：不传时展示当前身份，帮助用户理解为什么被拦 */
    desc?: string
    /** 图标（Iconify ph 图标集） */
    icon?: string
    /** 是否显示「返回上一页」 */
    showBack?: boolean
  }>(),
  {
    title: Copy.noPermission,
    desc: '',
    icon: 'ph:lock-simple',
    showBack: true,
  },
)

const router = useRouter()
const userStore = useUserStore()
</script>

<template>
  <div class="ql-panel">
    <div class="state-block">
      <Icon :icon="icon" class="state-block__icon" />
      <div class="state-block__title">{{ title }}</div>
      <div class="state-block__desc">
        <slot name="desc">{{ desc || `当前身份：${IdentityLabel[userStore.identity]}` }}</slot>
      </div>
      <div class="state-block__actions">
        <el-button v-if="showBack" text @click="router.back()">返回上一页</el-button>
        <el-button type="primary" @click="router.push('/')">去公开试卷广场</el-button>
      </div>
    </div>
  </div>
</template>
