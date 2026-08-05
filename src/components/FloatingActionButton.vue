<script setup lang="ts">
import { useI18n } from 'vue-i18n'

defineProps<{ ariaLabel?: string }>()
const emit = defineEmits<{ (e: 'click'): void }>()

const { t } = useI18n()
</script>

<template>
  <!-- 仅移动端显示(flex lg:hidden)：PC 端用页面右上角文字按钮代替（要求一.1） -->
  <button
    class="fab flex lg:hidden fixed right-6 z-30 w-[52px] h-[52px] rounded-full text-white grid place-items-center cursor-pointer"
    :style="{ bottom: 'calc(var(--safe-bottom) + 72px)' }"
    :aria-label="ariaLabel || t('common.add')"
    @click="emit('click')"
  >
    <span class="i-carbon-add text-2xl leading-none" />
  </button>
</template>

<style scoped>
/* 扁平无阴影 FAB（要求二）：纯色填充、无渐变无描边无高光；
   hover 仅缩放+加深、active 回弹缩小，全程无 box-shadow */
.fab {
  background: #26a69a;
  box-shadow: none;
  transition: transform 0.2s ease, background-color 0.2s ease;
}
.fab:hover {
  transform: scale(1.06);
  background: #209489;
}
.fab:active {
  transform: scale(0.96);
  background: #1c877e;
}
</style>
