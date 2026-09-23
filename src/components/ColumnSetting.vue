<script setup lang="ts">
/**
 * 列表设置（齿轮按钮 + 列显隐勾选）
 *
 * 交互参考云效工作台的「列表设置」：点击表格工具栏的齿轮 → 勾选要显示哪些列。
 * 设置的合法性（锁定列、至少保留一列）与持久化都由 `useColumnSetting` 负责，
 * 本组件只做呈现与事件转发。
 *
 * `:teleported="false"` 是刻意的：弹层内容留在组件自己的 DOM 里，scoped 样式才能生效；
 * 入口按钮放在 `.filter-bar`（无 overflow 裁剪）中，因此不会被裁掉。
 */
import { computed } from 'vue'
import type { ColumnDef } from '@/composables/useColumnSetting'

const props = defineProps<{
  columns: ColumnDef[]
  visibleKeys: string[]
}>()

const emit = defineEmits<{
  (e: 'toggle', key: string, visible: boolean): void
  (e: 'reset'): void
}>()

/**
 * el-checkbox-group 需要数组模型，而真源在父级（useColumnSetting）。
 * 这里用计算属性的 setter 把「整份勾选结果」拆成逐列的 toggle 事件，
 * 父级再做校验（锁定列不可取消、至少留一列），避免两处各写一份规则。
 */
const checked = computed({
  get: () => props.visibleKeys,
  set: (next: string[]) => {
    for (const column of props.columns) {
      const should = next.includes(column.key)
      const was = props.visibleKeys.includes(column.key)
      if (should !== was) emit('toggle', column.key, should)
    }
  },
})
</script>

<template>
  <el-popover
    trigger="click"
    placement="bottom-end"
    :width="236"
    :teleported="false"
    popper-class="column-setting__popover"
  >
    <template #reference>
      <el-button text class="column-setting__trigger" title="列表设置" aria-label="列表设置">
        <Icon icon="ph:gear-six" />
      </el-button>
    </template>

    <div class="column-setting__body">
      <div class="column-setting__head">
        <span class="column-setting__title">显示项</span>
        <el-button text size="small" @click="emit('reset')">恢复默认</el-button>
      </div>

      <el-checkbox-group v-model="checked" class="column-setting__list">
        <el-checkbox
          v-for="column in columns"
          :key="column.key"
          :value="column.key"
          :disabled="column.locked"
        >
          {{ column.label }}
        </el-checkbox>
      </el-checkbox-group>

      <div class="column-setting__foot">设置按账号保存在本机，可随时恢复默认</div>
    </div>
  </el-popover>
</template>

<style scoped>
.column-setting__trigger {
  padding: 4px;
  color: var(--ql-muted);
}

.column-setting__trigger:hover {
  color: var(--ql-primary);
  background: var(--ql-primary-soft);
}

.column-setting__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--ql-s1);
  padding-bottom: var(--ql-s1);
  margin-bottom: var(--ql-s1);
  border-bottom: 1px solid var(--ql-border-light);
}

.column-setting__title {
  font-size: var(--ql-fs-small);
  font-weight: 600;
  color: var(--ql-title);
}

/* 复选项竖排（EP 默认 inline-block 会横着排） */
.column-setting__list {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.column-setting__foot {
  margin-top: var(--ql-s1);
  padding-top: var(--ql-s1);
  border-top: 1px solid var(--ql-border-light);
  font-size: var(--ql-fs-tip);
  line-height: 1.6;
  color: var(--ql-muted);
}
</style>
