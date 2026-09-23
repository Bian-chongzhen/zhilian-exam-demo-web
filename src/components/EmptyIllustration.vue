<script setup lang="ts">
/**
 * 空状态插画（16 号 §6.4 / §8.2，验收 S-12 / S-16）
 *
 * 为什么是「内联 SVG」而不是外链插画：
 *   - §8.2 硬性要求「交付前必须落地本地、离线可用、单图 ≤200KB」——内联 SVG 天然满足（约 1KB）；
 *   - §8.2.1 要求插画「必须与本项目浅色基调（§5.1）相容」——
 *     本插画所有色值直接取自 §5.1 设计令牌（primary-soft / surface / border 等），
 *     因此改 --ql-hue 一个参数即可整体换色，永远不会出现「插画配色和主题打架」；
 *   - §8.2.3 要求「必须有明确尺寸与 aspect-ratio，避免布局抖动」——见下方固定 viewBox + aspect-ratio；
 *   - §8.2.5 禁止「用插画填充本应是空白的区域」——只在空状态出现，不做装饰性滥用。
 * 来源与许可：本项目自绘，随项目代码一同授权（无第三方素材授权问题）。
 */
</script>

<template>
  <!-- 装饰性插画：内容信息由 EmptyState 的文案承载，故 aria-hidden -->
  <svg
    class="empty-illustration"
    viewBox="0 0 200 150"
    role="presentation"
    aria-hidden="true"
    focusable="false"
  >
    <!-- 地面投影：让插画「落」在页面上，避免飘浮感 -->
    <ellipse class="art-shadow" cx="100" cy="132" rx="62" ry="9" />

    <!-- 后层卡片：轻微旋转制造层次与错位（对齐 §5.4 的非对称取向） -->
    <rect
      class="art-back"
      x="58"
      y="26"
      width="84"
      height="96"
      rx="12"
      transform="rotate(-5 100 74)"
    />

    <!-- 前层卡片 -->
    <rect class="art-card" x="52" y="32" width="96" height="96" rx="12" />

    <!-- 卡片顶部强调条（点缀色浅底，面积受控） -->
    <rect class="art-bar" x="64" y="44" width="40" height="7" rx="3.5" />

    <!-- 文本占位行 -->
    <rect class="art-line" x="64" y="62" width="72" height="6" rx="3" />
    <rect class="art-line" x="64" y="76" width="60" height="6" rx="3" />
    <rect class="art-line" x="64" y="90" width="44" height="6" rx="3" />

    <!-- 点缀：一枚点缀色圆点，打破卡片方正的轮廓 -->
    <circle class="art-dot-soft" cx="152" cy="46" r="10" />
    <circle class="art-dot" cx="152" cy="46" r="3.5" />
    <circle class="art-dot-line" cx="48" cy="112" r="4" />
  </svg>
</template>

<style scoped>
/*
 * 固定尺寸 + aspect-ratio：位置与大小在首帧即确定，不产生 CLS（§8.2.3）。
 * 宽度用 8 的倍数（168px），与全站栅格一致。
 */
.empty-illustration {
  display: block;
  width: 168px;
  height: auto;
  aspect-ratio: 4 / 3;
}

/* 所有色值来自设计令牌，无硬编码（S-1） */
.art-shadow {
  fill: var(--ql-surface-sunken);
}

.art-back {
  fill: var(--ql-surface-sunken);
}

.art-card {
  fill: var(--ql-surface);
  stroke: var(--ql-border);
  stroke-width: 2;
}

.art-bar {
  fill: var(--ql-primary-soft);
}

.art-line {
  fill: var(--ql-border-light);
}

.art-dot-soft {
  fill: var(--ql-primary-soft);
}

.art-dot {
  fill: var(--ql-primary);
}

.art-dot-line {
  fill: var(--ql-primary-line);
}
</style>
