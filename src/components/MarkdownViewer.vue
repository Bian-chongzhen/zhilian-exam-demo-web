<script setup lang="ts">
/**
 * Markdown 渲染唯一入口
 *
 * 依据《16、样式优化.md》§9.3 第 1 条：**全站 Markdown 只允许一处渲染实现**
 * （与题干渲染收口 `QuestionContent` 同一原则）。知识点详情、编辑预览、批注、题目笔记
 * 全部复用它，禁止各页自行拼装。
 *
 * 安全（14 号 §11 Q8 已确认「禁用原始 HTML 注入」）：
 *   markdown-it 默认 `html: false`，这里**显式写死**并在下方说明为什么可以安全地配合 v-html ——
 *   因为原始 HTML 会被转义成文本，渲染结果只包含 markdown-it 自己生成的白名单标签。
 *   ⚠ 若将来有人把 html 改成 true，v-html 立刻变成 XSS 通道：**改这一行等于开洞**。
 *
 * 排版规格见 16 号 §9.3：正文 14px / 行高 1.7；标题 20/16/15；代码块浅底等宽 + 6px 圆角；
 * 表格细描边；引用块左侧 3px 描边；全部走设计令牌，无硬编码色值。
 */
import MarkdownIt from 'markdown-it'
import { computed } from 'vue'

const props = withDefaults(
  defineProps<{
    source: string
    /** 紧凑排版：用于批注、题目笔记这类嵌入区域（字号降一级、段落间距收紧） */
    compact?: boolean
  }>(),
  { compact: false },
)

const md = new MarkdownIt({
  html: false, // ← 安全关键：禁止原始 HTML 注入（Q8）
  linkify: true, // 裸链接自动识别
  breaks: true, // 单个换行即换行，写讲义更符合直觉
})

const rendered = computed(() => md.render(props.source ?? ''))
</script>

<template>
  <!-- eslint-disable-next-line vue/no-v-html -- 渲染结果来自 html:false 的 markdown-it，原始 HTML 已被转义 -->
  <div class="ql-markdown" :class="{ 'is-compact': compact }" v-html="rendered" />
</template>

<style scoped>
.ql-markdown {
  font-size: var(--ql-fs-body);
  line-height: 1.7;
  color: var(--ql-text);
  word-break: break-word;
}

.ql-markdown.is-compact {
  font-size: var(--ql-fs-small);
}

.ql-markdown :deep(> *:first-child) {
  margin-top: 0;
}

.ql-markdown :deep(> *:last-child) {
  margin-bottom: 0;
}

.ql-markdown :deep(h1) {
  font-size: var(--ql-fs-page);
  font-weight: 600;
  color: var(--ql-title);
  margin: var(--ql-s3) 0 var(--ql-s2);
  line-height: 1.4;
}

.ql-markdown :deep(h2) {
  font-size: var(--ql-fs-section);
  font-weight: 600;
  color: var(--ql-title);
  margin: var(--ql-s3) 0 var(--ql-s1);
  line-height: 1.45;
}

.ql-markdown :deep(h3),
.ql-markdown :deep(h4) {
  font-size: 15px;
  font-weight: 600;
  color: var(--ql-title);
  margin: var(--ql-s2) 0 var(--ql-s1);
}

.ql-markdown :deep(p) {
  margin: 0 0 var(--ql-s2);
}

.ql-markdown :deep(ul),
.ql-markdown :deep(ol) {
  margin: 0 0 var(--ql-s2);
  padding-left: 22px;
}

.ql-markdown :deep(li) {
  margin-bottom: 4px;
}

.ql-markdown :deep(a) {
  color: var(--ql-primary);
  text-decoration: none;
  border-bottom: 1px solid var(--ql-primary-line);
}

.ql-markdown :deep(a:hover) {
  color: var(--ql-primary-hover);
}

.ql-markdown :deep(code) {
  font-family: 'JetBrains Mono', Consolas, Monaco, 'Courier New', monospace;
  font-size: 13px;
  padding: 1px 5px;
  border-radius: var(--ql-radius-sm);
  background: var(--ql-surface-sunken);
  color: var(--ql-title);
}

.ql-markdown :deep(pre) {
  margin: 0 0 var(--ql-s2);
  padding: var(--ql-s2);
  border-radius: var(--ql-radius-sm);
  background: var(--ql-surface-sunken);
  border: 1px solid var(--ql-border-light);
  overflow-x: auto;
}

.ql-markdown :deep(pre code) {
  padding: 0;
  background: transparent;
  border: none;
  line-height: 1.7;
}

.ql-markdown :deep(blockquote) {
  margin: 0 0 var(--ql-s2);
  padding: var(--ql-s1) var(--ql-s2);
  border-left: 3px solid var(--ql-primary);
  border-radius: 0 var(--ql-radius-sm) var(--ql-radius-sm) 0;
  background: var(--ql-primary-soft);
  color: var(--ql-text);
}

.ql-markdown :deep(blockquote p:last-child) {
  margin-bottom: 0;
}

.ql-markdown :deep(table) {
  width: 100%;
  margin: 0 0 var(--ql-s2);
  border-collapse: collapse;
  font-size: var(--ql-fs-small);
}

.ql-markdown :deep(th),
.ql-markdown :deep(td) {
  padding: 6px 10px;
  border: 1px solid var(--ql-border-light);
  text-align: left;
}

.ql-markdown :deep(th) {
  background: var(--ql-surface-soft);
  color: var(--ql-title);
  font-weight: 600;
}

.ql-markdown :deep(hr) {
  margin: var(--ql-s3) 0;
  border: none;
  border-top: 1px solid var(--ql-border);
}

.ql-markdown :deep(img) {
  max-width: 100%;
  border-radius: var(--ql-radius-sm);
}
</style>
