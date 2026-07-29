<script setup lang="ts">
import { useTheme, type ThemeMode } from '@/composables/useTheme'

const { theme, setTheme } = useTheme()

const modes: { value: ThemeMode; label: string }[] = [
  { value: 'light', label: '浅色' },
  { value: 'dark', label: '深色' },
  { value: 'system', label: '跟随系统' }
]
</script>

<template>
  <div class="space-y-4">
    <h2 class="text-xl font-semibold">设置</h2>
    <div>
      <div class="text-sm text-fg-soft mb-2">主题</div>
      <div class="flex gap-2">
        <button
          v-for="m in modes"
          :key="m.value"
          @click="setTheme(m.value)"
          class="px-3 py-1.5 rounded border text-sm"
          :class="theme === m.value ? 'border-brand text-brand' : 'border-border text-fg-soft'"
        >
          {{ m.label }}
        </button>
      </div>
    </div>
    <p class="text-sm text-fg-soft">
      M4 实现数据存储路径、AI Key 本地加密配置、数据导出/导入、Obsidian Vault 路径选择。
    </p>
  </div>
</template>
