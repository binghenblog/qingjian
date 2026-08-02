<script setup lang="ts">
defineProps<{ ariaLabel?: string }>()
const emit = defineEmits<{ (e: 'click'): void }>()
</script>

<template>
  <button
    class="fab fixed bottom-6 right-6 z-30 w-14 h-14 rounded-full bg-brand text-white grid place-items-center shadow-lg hover:scale-105 active:scale-95 transition"
    :aria-label="ariaLabel"
    @click="emit('click')"
  >
    <span class="i-carbon-add text-2xl" />
  </button>
</template>

<style scoped>
.fab {
  background: var(--c-brand-grad);
  box-shadow: 0 8px 24px var(--c-brand-soft);
}
</style>
