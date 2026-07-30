<script setup lang="ts">
import { watch, nextTick, ref, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useConfirm } from '@/composables/useConfirm'

const { t } = useI18n()
const { state, resolve } = useConfirm()

const okEl = ref<HTMLButtonElement>()

/** 打开时聚焦确认按钮，并支持 Esc 取消 / Enter 确认（审查 H-11 可访问性） */
function onKey(e: KeyboardEvent) {
  if (!state.open) return
  if (e.key === 'Escape') {
    e.preventDefault()
    resolve(false)
  } else if (e.key === 'Enter') {
    e.preventDefault()
    resolve(true)
  }
}

watch(
  () => state.open,
  async (v) => {
    if (v) {
      window.addEventListener('keydown', onKey)
      await nextTick()
      okEl.value?.focus()
    } else {
      window.removeEventListener('keydown', onKey)
    }
  }
)

onUnmounted(() => window.removeEventListener('keydown', onKey))
</script>

<template>
  <Teleport to="body">
    <Transition name="fade">
      <div
        v-if="state.open"
        class="confirm-mask fixed inset-0 z-[100] grid place-items-center bg-black/40 backdrop-blur-sm"
        @click.self="resolve(false)"
        role="alertdialog"
        aria-modal="true"
        :aria-label="state.title || state.message"
      >
        <div class="confirm-box w-[360px] max-w-[90vw] rounded-2xl p-5">
          <h3 v-if="state.title" class="m-0 mb-2 text-base font-semibold text-fg">{{ state.title }}</h3>
          <p class="m-0 mb-5 text-sm text-fg-soft leading-relaxed whitespace-pre-wrap">{{ state.message }}</p>
          <div class="flex justify-end gap-2.5">
            <button
              class="confirm-cancel px-4 py-2 rounded-xl text-sm cursor-pointer"
              @click="resolve(false)"
            >
              {{ state.cancelText || t('common.cancel') }}
            </button>
            <button
              ref="okEl"
              class="confirm-ok px-4 py-2 rounded-xl text-sm cursor-pointer"
              :class="state.danger ? 'confirm-danger' : ''"
              @click="resolve(true)"
            >
              {{ state.confirmText || t('common.confirm') }}
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.confirm-box {
  background: var(--c-surface);
  border: 1px solid var(--c-border);
  box-shadow: var(--shadow-lg);
}
.confirm-cancel {
  background: var(--c-bg);
  border: 1px solid var(--c-border);
  color: var(--c-fg-soft);
  transition: border-color 0.15s ease, color 0.15s ease, background-color 0.15s ease;
}
.confirm-cancel:hover {
  border-color: var(--c-brand);
  color: var(--c-fg);
}
.confirm-ok {
  background: var(--c-brand-grad);
  border: 1px solid transparent;
  color: #fff;
  transition: opacity 0.15s ease, box-shadow 0.15s ease;
}
.confirm-ok:hover {
  opacity: 0.9;
  box-shadow: 0 3px 10px var(--c-brand-soft);
}
.confirm-ok.confirm-danger {
  background: #dc2626;
}
.confirm-ok.confirm-danger:hover {
  box-shadow: 0 3px 10px rgba(220, 38, 38, 0.3);
}
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.15s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
