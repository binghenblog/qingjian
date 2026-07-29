<script setup lang="ts">
import { useTheme, type ThemeMode } from '@/composables/useTheme'

const { theme, setTheme } = useTheme()

const modes: { value: ThemeMode; label: string; icon: string }[] = [
  { value: 'light', label: '浅色', icon: 'i-carbon-sun' },
  { value: 'dark', label: '深色', icon: 'i-carbon-moon' },
  { value: 'system', label: '跟随系统', icon: 'i-carbon-laptop' }
]
</script>

<template>
  <div class="space-y-5 max-w-2xl">
    <h2 class="text-xl font-bold m-0">设置</h2>

    <!-- 外观 -->
    <section class="setting-card rounded-2xl p-5">
      <div class="font-semibold text-sm mb-1">外观</div>
      <p class="text-xs text-fg-faint mt-0 mb-4">选择界面主题模式</p>
      <div class="seg inline-flex p-1 rounded-xl gap-1">
        <button
          v-for="m in modes"
          :key="m.value"
          @click="setTheme(m.value)"
          class="seg-item flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm cursor-pointer border-none"
          :class="theme === m.value ? 'seg-active' : ''"
        >
          <span :class="m.icon" class="text-base" />
          {{ m.label }}
        </button>
      </div>
    </section>

    <!-- 数据（占位） -->
    <section class="setting-card rounded-2xl p-5">
      <div class="font-semibold text-sm mb-1">数据与存储</div>
      <p class="text-xs text-fg-faint mt-0 mb-0">
        M4 实现：存储路径选择 · AI Key 本地加密 · 数据导出/导入 · Obsidian Vault 路径绑定
      </p>
    </section>

    <!-- 关于 -->
    <section class="setting-card rounded-2xl p-5 flex items-center gap-4">
      <span class="logo w-11 h-11 rounded-xl grid place-items-center text-white text-lg font-bold shrink-0">青</span>
      <div>
        <div class="font-semibold text-sm">青简 QingJian</div>
        <div class="text-xs text-fg-faint mt-0.5">v0.1.0 · 轻量 · 现代 · 开源 · 本地优先 · MIT License</div>
      </div>
    </section>
  </div>
</template>

<style scoped>
.setting-card {
  background: var(--c-surface);
  border: 1px solid var(--c-border);
}

.seg {
  background: var(--c-bg);
  border: 1px solid var(--c-border);
}
.seg-item {
  background: transparent;
  color: var(--c-fg-soft);
  transition: all 0.15s ease;
}
.seg-item:hover { color: var(--c-fg); }
.seg-active {
  background: var(--c-surface);
  color: var(--c-brand-strong);
  font-weight: 600;
  box-shadow: var(--shadow-sm);
}
.dark .seg-active { color: var(--c-brand); }

.logo {
  background: var(--c-brand-grad);
  box-shadow: 0 4px 12px var(--c-brand-soft);
}
</style>
