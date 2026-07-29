<script setup lang="ts">
import { useTheme, type ThemeMode } from '@/composables/useTheme'
import { useSettingsStore, type AIProviderType } from '@/stores/settings'

const { theme, setTheme } = useTheme()
const settings = useSettingsStore()

const modes: { value: ThemeMode; label: string; icon: string }[] = [
  { value: 'light', label: '浅色', icon: 'i-carbon-sun' },
  { value: 'dark', label: '深色', icon: 'i-carbon-moon' },
  { value: 'system', label: '跟随系统', icon: 'i-carbon-laptop' }
]

const channels: { value: AIProviderType; label: string; icon: string }[] = [
  { value: 'local', label: '本地 Ollama', icon: 'i-carbon-computer' },
  { value: 'cloud', label: '云端兼容', icon: 'i-carbon-cloud' }
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

    <!-- AI 通道 -->
    <section class="setting-card rounded-2xl p-5 space-y-4">
      <div>
        <div class="font-semibold text-sm mb-1">AI 通道</div>
        <p class="text-xs text-fg-faint mt-0 mb-3">选择本地或云端模型，配置保存在本地</p>
        <div class="seg inline-flex p-1 rounded-xl gap-1">
          <button
            v-for="c in channels"
            :key="c.value"
            @click="settings.aiProvider = c.value"
            class="seg-item flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm cursor-pointer border-none"
            :class="settings.aiProvider === c.value ? 'seg-active' : ''"
          >
            <span :class="c.icon" class="text-base" />
            {{ c.label }}
          </button>
        </div>
      </div>

      <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <label class="field">
          <span class="field-label">接口地址</span>
          <input
            v-model="settings.aiBaseUrl"
            class="input-modern w-full px-3 py-2 text-sm"
            :placeholder="settings.aiProvider === 'local' ? 'http://127.0.0.1:11434' : 'https://api.openai.com/v1'"
          />
        </label>
        <label class="field">
          <span class="field-label">模型</span>
          <input
            v-model="settings.aiModel"
            class="input-modern w-full px-3 py-2 text-sm"
            :placeholder="settings.aiProvider === 'local' ? 'llama3' : 'gpt-4o-mini'"
          />
        </label>
      </div>

      <label v-if="settings.aiProvider === 'cloud'" class="field">
        <span class="field-label">API Key</span>
        <input
          v-model="settings.aiApiKey"
          type="password"
          class="input-modern w-full px-3 py-2 text-sm"
          placeholder="sk-..."
        />
        <p class="field-hint">
          ⚠️ 仅保存在本机浏览器（localStorage）。纯 Web 端直连云端可能受 CORS 限制；Tauri 打包后建议经本地后端中转（M5）。
        </p>
      </label>
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

.field { display: flex; flex-direction: column; gap: 5px; }
.field-label { font-size: 12px; color: var(--c-fg-soft); font-weight: 500; }
.field-hint {
  font-size: 11px;
  color: var(--c-fg-faint);
  margin: 2px 0 0;
  line-height: 1.5;
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
