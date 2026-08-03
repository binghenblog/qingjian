<script setup lang="ts">
/**
 * 桌面端专属快捷键提示：悬浮 / 键盘聚焦时显示快捷键徽标 + 说明。
 * 触摸设备（hover:none / pointer:coarse）自动隐藏，避免遮挡。
 */
withDefaults(
  defineProps<{
    keys: string // 如 "Ctrl K" 或 "Ctrl+N"，按 + 拆分显示
    label?: string // 说明文字（已翻译）
    placement?: 'top' | 'bottom'
  }>(),
  { placement: 'top' }
)
</script>

<template>
  <span class="kbd-tip-wrap inline-flex">
    <slot />
    <span
      class="kbd-tip"
      :class="placement === 'bottom' ? 'kbd-tip-bottom' : 'kbd-tip-top'"
      role="tooltip"
    >
      <kbd v-for="(k, i) in keys.split('+')" :key="i" class="kbd-key">{{ k.trim() }}</kbd>
      <span v-if="label" class="kbd-label">{{ label }}</span>
    </span>
  </span>
</template>

<style scoped>
.kbd-tip-wrap {
  position: relative;
}
.kbd-tip {
  position: absolute;
  left: 50%;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 10px;
  background: var(--c-surface);
  border: 1px solid var(--c-border);
  border-radius: var(--radius);
  box-shadow: var(--shadow-md);
  color: var(--c-fg-soft);
  font-size: 12px;
  white-space: nowrap;
  opacity: 0;
  pointer-events: none;
  transform: translateX(-50%) translateY(4px);
  transition: opacity 0.15s ease, transform 0.15s ease;
  z-index: 60;
}
.kbd-tip-top {
  bottom: calc(100% + 8px);
}
.kbd-tip-bottom {
  top: calc(100% + 8px);
}
.kbd-tip-wrap:hover .kbd-tip,
.kbd-tip-wrap:focus-within .kbd-tip {
  opacity: 1;
  transform: translateX(-50%) translateY(0);
}
.kbd-key {
  font-family: inherit;
  font-size: 11px;
  padding: 2px 6px;
  border-radius: 6px;
  border: 1px solid var(--c-border);
  background: var(--c-bg);
  color: var(--c-fg-faint);
  box-shadow: inset 0 -1px 0 var(--c-border);
}
.kbd-label {
  color: var(--c-fg-soft);
}
/* 桌面端专属：触摸 / 粗指针设备不显示悬浮提示，避免误触遮挡 */
@media (hover: none), (pointer: coarse) {
  .kbd-tip {
    display: none;
  }
}
</style>
