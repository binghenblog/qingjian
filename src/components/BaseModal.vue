<script setup lang="ts">
import { watch, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'

/**
 * 全局居中弹窗（PC / 移动端共用一套）。
 * - 顶部：标题 + 右上角圆形叉号关闭按钮
 * - 中部：默认插槽放表单（复用 theme.css 的 input / .input-modern 样式）
 * - 底部：左侧取消(.btn-secondary) + 右侧保存(.btn-primary)，固定操作栏
 * - 半透明黑色遮罩；点击遮罩 / 取消 / 叉号均可关闭；打开时锁定 body 滚动
 * - PC 固定适中宽度(max-width 480px)；移动端占屏幕 90%，底部按钮垂直堆叠
 */
const props = withDefaults(
  defineProps<{
    modelValue: boolean
    title: string
    saveLabel?: string
    cancelLabel?: string
  }>(),
  { saveLabel: '', cancelLabel: '' }
)

const emit = defineEmits<{ 'update:modelValue': [boolean]; save: [] }>()

const { t } = useI18n()

function close() {
  emit('update:modelValue', false)
}
function onSave() {
  emit('save')
}

// 打开时锁定底层页面滚动（要求三.4）
watch(
  () => props.modelValue,
  (open) => {
    if (typeof document !== 'undefined') {
      document.body.style.overflow = open ? 'hidden' : ''
    }
  }
)
onUnmounted(() => {
  if (typeof document !== 'undefined') document.body.style.overflow = ''
})
</script>

<template>
  <Teleport to="body">
    <Transition name="modal-fade">
      <div v-if="modelValue" class="modal-mask" @click.self="close">
        <div class="modal-card" role="dialog" aria-modal="true" :aria-label="title">
          <header class="modal-head">
            <h3 class="modal-title">{{ title }}</h3>
            <button class="modal-x" type="button" :aria-label="t('common.cancel')" @click="close">
              <span class="i-carbon-close" />
            </button>
          </header>

          <div class="modal-body">
            <slot />
          </div>

          <footer class="modal-foot">
            <button class="btn-secondary modal-btn" type="button" @click="close">
              {{ cancelLabel || t('common.cancel') }}
            </button>
            <button class="btn-primary modal-btn" type="button" @click="onSave">
              {{ saveLabel || t('common.save') }}
            </button>
          </footer>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.modal-mask {
  position: fixed;
  inset: 0;
  z-index: 60;
  background: var(--c-overlay);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
}
.modal-card {
  width: 100%;
  max-width: 480px;
  max-height: 90vh;
  display: flex;
  flex-direction: column;
  background: var(--c-surface);
  border: 1px solid var(--c-border);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-lg);
  overflow: hidden;
}
.modal-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid var(--c-border);
  flex-shrink: 0;
}
.modal-title {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: var(--c-fg);
}
.modal-x {
  width: 30px;
  height: 30px;
  border-radius: 9999px;
  display: grid;
  place-items: center;
  color: var(--c-fg-faint);
  background: transparent;
  border: none;
  cursor: pointer;
  transition: background-color 0.15s ease, color 0.15s ease;
}
.modal-x:hover {
  background: var(--c-surface-hover);
  color: var(--c-fg);
}
.modal-body {
  padding: 20px;
  overflow-y: auto;
  flex: 1;
}
.modal-foot {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  padding: 14px 20px;
  border-top: 1px solid var(--c-border);
  flex-shrink: 0;
}
.modal-btn {
  min-width: 88px;
  padding: 9px 16px;
  font-size: 14px;
}

/* 移动端：占屏幕 90% 宽，底部按钮垂直堆叠（要求三.5） */
@media (max-width: 1023px) {
  .modal-card {
    max-width: 90%;
  }
  .modal-foot {
    flex-direction: column-reverse;
  }
  .modal-btn {
    width: 100%;
  }
}

/* 过渡：遮罩淡入 + 卡片轻微上移缩放 */
.modal-fade-enter-active,
.modal-fade-leave-active {
  transition: opacity 0.2s ease;
}
.modal-fade-enter-active .modal-card,
.modal-fade-leave-active .modal-card {
  transition: transform 0.2s ease, opacity 0.2s ease;
}
.modal-fade-enter-from,
.modal-fade-leave-to {
  opacity: 0;
}
.modal-fade-enter-from .modal-card,
.modal-fade-leave-to .modal-card {
  transform: translateY(8px) scale(0.98);
  opacity: 0;
}
</style>
