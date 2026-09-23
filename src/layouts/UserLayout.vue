<script setup lang="ts">
/**
 * 兼容别名：应用外壳已统一为 AppLayout（左侧折叠导航 + 顶部 header + 面包屑）。
 * 保留此文件避免旧的引用路径失效，请勿在新代码中使用。
 */
import AppLayout from './AppLayout.vue'
</script>

<template>
  <AppLayout />
</template>
