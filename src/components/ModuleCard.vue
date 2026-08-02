<script setup lang="ts">
defineProps<{ to?: string; title?: string }>()
</script>

<template>
  <RouterLink
    v-if="to"
    :to="to"
    class="module-card block rounded-2xl border border-border bg-surface p-4 hover:border-brand transition-colors"
  >
    <slot />
  </RouterLink>
  <div v-else class="module-card block rounded-2xl border border-border bg-surface p-4">
    <slot />
  </div>
</template>

<style scoped>
.module-card {
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
}
.module-card:hover {
  box-shadow: 0 4px 16px var(--c-brand-soft);
}
</style>
