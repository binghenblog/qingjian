<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import type { TodoPriority } from '@/types'

defineProps<{ priority: TodoPriority; tag?: string }>()

const { t } = useI18n()

const priorityMeta: Record<TodoPriority, { label: string; cls: string }> = {
  high: { label: 'todos.priorityHigh', cls: 'p-high' },
  medium: { label: 'todos.priorityMedium', cls: 'p-medium' },
  low: { label: 'todos.priorityLow', cls: 'p-low' }
}
</script>

<template>
  <span class="flex items-center gap-1.5 shrink-0">
    <span class="badge" :class="(priorityMeta[priority] ?? priorityMeta.medium).cls">{{ t((priorityMeta[priority] ?? priorityMeta.medium).label) }}</span>
    <span v-if="tag" class="badge badge-tag">
      <span class="i-carbon-tag text-[10px]" />
      {{ tag }}
    </span>
  </span>
</template>

<style scoped>
.badge {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  font-size: 10px;
  line-height: 1;
  padding: 2px 6px;
  border-radius: 999px;
  font-weight: 600;
}
.p-high   { background: #ef44441a; color: #dc2626; }
.p-medium { background: #f59e0b1a; color: #d97706; }
.p-low    { background: #64748b1a; color: #64748b; }
.dark .p-high   { background: #ef444426; color: #f87171; }
.dark .p-medium { background: #f59e0b26; color: #fbbf24; }
.dark .p-low    { background: #94a3b826; color: #94a3b8; }

.badge-tag {
  background: var(--c-brand-soft);
  color: var(--c-brand-strong);
  font-weight: 500;
}
.dark .badge-tag { color: var(--c-brand); }
</style>
