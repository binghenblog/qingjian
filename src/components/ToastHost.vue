<script setup lang="ts">
import { useToast, type ToastType, type ToastItem } from '@/composables/useToast'

const { toasts, dismiss } = useToast()

/** 各类型的状态图标（iconify） */
function iconFor(type: ToastType): string {
  switch (type) {
    case 'success':
      return 'i-carbon-checkmark-outline'
    case 'error':
      return 'i-carbon-warning'
    case 'warn':
      return 'i-carbon-warning-alt'
    default:
      return 'i-carbon-information'
  }
}

/** 执行动作按钮回调（如「撤销」）后关闭；@click.stop 已阻止冒泡到外层 dismiss */
function runAction(item: ToastItem) {
  item.action?.onClick()
  dismiss(item.id)
}
</script>

<template>
  <Teleport to="body">
    <!-- 容器不拦截指针事件，仅 Toast 本体可点击关闭。
         移动端（<1024px）：顶部全宽、避让标题栏；桌面端：右上角固定宽 -->
    <div
      class="toast-wrap fixed z-[200] flex flex-col gap-2 pointer-events-none
             top-2 right-2 left-2 w-auto max-w-none
             sm:top-4 sm:right-4 sm:left-auto sm:w-[330px] sm:max-w-[90vw]"
      aria-live="polite"
    >
      <TransitionGroup name="toast">
        <div
          v-for="t in toasts"
          :key="t.id"
          class="toast pointer-events-auto flex items-start gap-2.5 px-3.5 py-2.5 rounded-xl text-sm leading-relaxed cursor-pointer"
          :class="`toast-${t.type}`"
          :role="t.type === 'error' ? 'alert' : 'status'"
          :aria-live="t.type === 'error' ? 'assertive' : 'polite'"
          @click="dismiss(t.id)"
        >
          <span class="toast-icon mt-px shrink-0 text-base" :class="iconFor(t.type)" />
          <span class="toast-msg break-words">{{ t.message }}</span>
          <button
            v-if="t.action"
            type="button"
            class="toast-action ml-auto shrink-0"
            :aria-label="t.action.label"
            @click.stop="runAction(t)"
          >
            {{ t.action.label }}
          </button>
        </div>
      </TransitionGroup>
    </div>
  </Teleport>
</template>

<style scoped>
.toast {
  background: var(--c-surface);
  border: 1px solid var(--c-border);
  box-shadow: var(--shadow-lg);
  color: var(--c-fg);
}
.toast-icon {
  color: var(--c-fg-soft);
}
.toast-action {
  background: transparent;
  border: none;
  color: var(--c-brand-strong);
  font-weight: 600;
  font-size: 0.8125rem;
  cursor: pointer;
  padding: 0.1rem 0.35rem;
  border-radius: 0.5rem;
  white-space: nowrap;
}
.toast-action:hover {
  text-decoration: underline;
}
.toast-success {
  border-left: 3px solid #16a34a;
}
.toast-success .toast-icon {
  color: #16a34a;
}
.toast-error {
  border-left: 3px solid #dc2626;
}
.toast-error .toast-icon {
  color: #dc2626;
}
.toast-warn {
  border-left: 3px solid #d97706;
}
.toast-warn .toast-icon {
  color: #d97706;
}
.toast-info {
  border-left: 3px solid var(--c-brand);
}
.toast-info .toast-icon {
  color: var(--c-brand-strong);
}
.dark .toast-success .toast-icon {
  color: #4ade80;
}
.dark .toast-error .toast-icon {
  color: #f87171;
}
.dark .toast-warn .toast-icon {
  color: #fbbf24;
}

.toast-enter-active,
.toast-leave-active {
  transition: opacity 0.18s ease, transform 0.18s ease;
}
.toast-enter-from,
.toast-leave-to {
  opacity: 0;
  transform: translateX(12px);
}

/* 尊重「减少动态效果」系统偏好（审查 M-45） */
@media (prefers-reduced-motion: reduce) {
  .toast-enter-active,
  .toast-leave-active {
    transition: none;
  }
  .toast-enter-from,
  .toast-leave-to {
    transform: none;
  }
}
</style>
