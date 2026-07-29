<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useTheme, type ThemeMode } from '@/composables/useTheme'
import { useSettingsStore, type AIProviderType } from '@/stores/settings'
import { useNoteStore } from '@/stores/notes'
import { useTodoStore } from '@/stores/todos'
import { exportToFile, readBackupFile, importBackup, type ImportMode } from '@/services/backup'

const { theme, setTheme } = useTheme()
const settings = useSettingsStore()
const noteStore = useNoteStore()
const todoStore = useTodoStore()

onMounted(() => noteStore.load())

/* ---------- 数据管理 ---------- */
const noteCount = computed(() => noteStore.notes.length)
const todoCount = computed(() => todoStore.todos.length)

const fileInput = ref<HTMLInputElement>()
const importMode = ref<ImportMode>('merge')
const busy = ref(false)
const dataMsg = ref<{ type: 'ok' | 'err'; text: string } | null>(null)

async function onExport() {
  try {
    busy.value = true
    await exportToFile()
    dataMsg.value = { type: 'ok', text: '备份文件已下载（不含 API Key）' }
  } catch (e) {
    dataMsg.value = { type: 'err', text: `导出失败：${(e as Error).message}` }
  } finally {
    busy.value = false
  }
}

function pickFile(mode: ImportMode) {
  importMode.value = mode
  fileInput.value?.click()
}

async function onFileChosen(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  ;(e.target as HTMLInputElement).value = ''
  if (!file) return
  if (
    importMode.value === 'replace' &&
    !confirm('覆盖导入会清空当前所有笔记与待办，并用备份内容替换。确定继续吗？')
  )
    return
  try {
    busy.value = true
    const backup = await readBackupFile(file)
    const r = await importBackup(backup, importMode.value)
    dataMsg.value = {
      type: 'ok',
      text: `导入成功：笔记 ${r.notes} 条、待办 ${r.todos} 条（${importMode.value === 'merge' ? '合并' : '覆盖'}模式），页面即将刷新…`
    }
    // localStorage 数据需重新初始化各 store，最稳妥的方式是整页刷新
    setTimeout(() => location.reload(), 1200)
  } catch (err) {
    dataMsg.value = { type: 'err', text: `导入失败：${(err as Error).message}` }
  } finally {
    busy.value = false
  }
}

/* ---------- 快捷键说明 ---------- */
const shortcuts = [
  { keys: ['Ctrl', 'K'], desc: '命令面板 · 全局搜索' },
  { keys: ['Alt', '1'], desc: '仪表盘' },
  { keys: ['Alt', '2'], desc: '笔记' },
  { keys: ['Alt', '3'], desc: '待办' },
  { keys: ['Alt', '4'], desc: 'AI 助手' },
  { keys: ['Alt', '5'], desc: '设置' }
]

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

    <!-- 个人资料 -->
    <section class="setting-card rounded-2xl p-5">
      <div class="font-semibold text-sm mb-1">个人资料</div>
      <p class="text-xs text-fg-faint mt-0 mb-3">仪表盘问候语中显示的名字，仅存本机</p>
      <input
        v-model="settings.userName"
        placeholder="输入你的名字，如：冰痕"
        class="input-modern w-full max-w-xs px-3 py-2 text-sm"
        maxlength="12"
      />
    </section>

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

      <div v-if="settings.aiProvider === 'cloud'" class="field">
        <span class="field-label">API Key</span>
        <input
          v-model="settings.aiApiKey"
          type="password"
          class="input-modern w-full px-3 py-2 text-sm"
          placeholder="sk-..."
        />
        <label class="flex items-center gap-2 text-xs text-fg-soft mt-2 cursor-pointer select-none">
          <input v-model="settings.aiKeyRemember" type="checkbox" class="cursor-pointer" />
          在本机记住密钥（写入 localStorage；不勾选则关闭浏览器即清除）
        </label>
        <p class="field-hint">
          ⚠️ 密钥仅保存在本机浏览器，默认只在当前会话有效。纯 Web 端直连云端可能受 CORS 限制；桌面版将经本地后端中转并加密保管，更安全。
        </p>
      </div>
    </section>

    <!-- 数据与存储 -->
    <section class="setting-card rounded-2xl p-5 space-y-4">
      <div>
        <div class="font-semibold text-sm mb-1">数据与存储</div>
        <p class="text-xs text-fg-faint mt-0 mb-0">
          当前本机数据：<b class="text-fg">{{ noteCount }}</b> 条笔记 ·
          <b class="text-fg">{{ todoCount }}</b> 条待办。备份为 JSON 文件，可跨设备恢复。
        </p>
      </div>

      <div class="flex flex-wrap items-center gap-2">
        <button class="btn-primary px-4 py-2 rounded-xl text-sm flex items-center gap-1.5" :disabled="busy" @click="onExport">
          <span class="i-carbon-download text-base" />
          导出备份
        </button>
        <button class="data-btn px-4 py-2 rounded-xl text-sm flex items-center gap-1.5" :disabled="busy" @click="pickFile('merge')">
          <span class="i-carbon-upload text-base" />
          导入（合并）
        </button>
        <button class="data-btn data-btn-danger px-4 py-2 rounded-xl text-sm flex items-center gap-1.5" :disabled="busy" @click="pickFile('replace')">
          <span class="i-carbon-warning-alt text-base" />
          导入（覆盖）
        </button>
        <input ref="fileInput" type="file" accept=".json,application/json" class="hidden" @change="onFileChosen" />
      </div>

      <p v-if="dataMsg" class="text-xs m-0" :class="dataMsg.type === 'ok' ? 'msg-ok' : 'msg-err'">
        {{ dataMsg.text }}
      </p>
      <p class="field-hint m-0">
        合并：按 id 去重，同一笔记保留较新版本；覆盖：清空当前数据后整体恢复（会先确认）。备份不包含 API Key。
      </p>
    </section>

    <!-- 快捷键 -->
    <section class="setting-card rounded-2xl p-5">
      <div class="font-semibold text-sm mb-1">快捷键</div>
      <p class="text-xs text-fg-faint mt-0 mb-4">随时随地快速跳转</p>
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <div v-for="s in shortcuts" :key="s.desc" class="flex items-center justify-between px-3 py-2 rounded-xl kbd-row">
          <span class="text-sm text-fg-soft">{{ s.desc }}</span>
          <span class="flex items-center gap-1">
            <kbd v-for="k in s.keys" :key="k" class="kbd">{{ k }}</kbd>
          </span>
        </div>
      </div>
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

/* 数据管理按钮 */
.data-btn {
  background: var(--c-bg);
  border: 1px solid var(--c-border);
  color: var(--c-fg-soft);
  cursor: pointer;
  transition: all 0.15s ease;
}
.data-btn:hover:not(:disabled) {
  color: var(--c-fg);
  border-color: var(--c-brand);
  background: var(--c-brand-soft);
}
.data-btn-danger:hover:not(:disabled) {
  color: #dc2626;
  border-color: #dc262666;
  background: #dc26261a;
}
.data-btn:disabled { opacity: 0.5; cursor: not-allowed; }

.msg-ok { color: var(--c-brand-strong); }
.dark .msg-ok { color: var(--c-brand); }
.msg-err { color: #dc2626; }

/* 快捷键行 */
.kbd-row {
  background: var(--c-bg);
  border: 1px solid var(--c-border);
}
.kbd {
  font-family: inherit;
  font-size: 11px;
  padding: 2px 7px;
  border-radius: 6px;
  background: var(--c-surface);
  border: 1px solid var(--c-border);
  box-shadow: 0 1px 0 var(--c-border);
  color: var(--c-fg-soft);
}
</style>
