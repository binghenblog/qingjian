<script setup lang="ts">
/**
 * 统一空状态组件：图标 + 主文案 + 可选次文案 + 可选操作按钮。
 * 复用 Dashboard 的精致空态样式（实线边框 + 轻阴影 + hover 上浮），
 * 供 Todos / Notes / Ledger / Fitness / Anniversaries / Quotes / AI 各页复用，
 * 消除各页空态样式差异（有的虚线、有的纯文字）。
 */
withDefaults(
  defineProps<{
    icon?: string // iconify 类名，如 'i-carbon-task'
    title?: string
    hint?: string
    actionLabel?: string
    /** 紧凑模式：小图标 + 单行文字，用于嵌在卡片内的列表空态 */
    compact?: boolean
  }>(),
  { icon: 'i-carbon-information', title: '', hint: '', actionLabel: '', compact: false }
)

const emit = defineEmits<{ action: [] }>()
</script>

<template>
  <div
    class="empty grid place-items-center rounded-2xl text-center"
    :class="compact ? 'py-6' : 'py-12'"
  >
    <div>
      <span
        v-if="icon && !compact"
        class="icon-chip inline-grid place-items-center w-14 h-14 rounded-2xl mb-3"
      >
        <span :class="icon" class="text-2xl" />
      </span>
      <span
        v-else-if="icon && compact"
        class="icon-mini inline-grid place-items-center w-9 h-9 rounded-xl mb-2 mx-auto"
      >
        <span :class="icon" class="text-base" />
      </span>
      <p class="m-0 leading-relaxed" :class="compact ? 'text-xs text-fg-faint' : 'text-sm font-medium text-fg-soft mb-1'">
        {{ title }}
      </p>
      <p v-if="hint" class="text-sm text-fg-faint m-0 leading-relaxed">{{ hint }}</p>
      <button
        v-if="actionLabel"
        type="button"
        class="btn-secondary mt-4 px-4 py-2 text-sm"
        @click="emit('action')"
      >
        {{ actionLabel }}
      </button>
    </div>
  </div>
</template>

<style scoped>
.empty {
  border: 1px solid var(--c-border);
  background: var(--c-surface);
  box-shadow: var(--shadow-sm);
  transition: box-shadow 0.15s ease, transform 0.15s ease, border-color 0.15s ease;
}
.empty:hover {
  box-shadow: var(--shadow-md);
  transform: translateY(-2px);
  border-color: var(--c-brand);
}
.icon-chip {
  background: var(--c-brand-soft);
  color: var(--c-brand-strong);
}
.dark .icon-chip {
  color: var(--c-brand);
}
.icon-mini {
  background: var(--c-brand-soft);
  color: var(--c-brand-strong);
}
.dark .icon-mini {
  color: var(--c-brand);
}
</style>
