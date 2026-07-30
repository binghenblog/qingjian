<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useTheme, type ThemeMode } from '@/composables/useTheme'
import { useSettingsStore, type AIProviderType } from '@/stores/settings'
import { useNoteStore } from '@/stores/notes'
import { useTodoStore } from '@/stores/todos'
import { useConfirm } from '@/composables/useConfirm'
import { exportToFile, readBackupFile, importBackup, type ImportMode } from '@/services/backup'
import { SUPPORTED_LOCALES } from '@/i18n'

const { theme, setTheme } = useTheme()
const settings = useSettingsStore()
const noteStore = useNoteStore()
const todoStore = useTodoStore()
const { t } = useI18n()
const { confirm } = useConfirm()

onMounted(() => noteStore.load())

/* ---------- 数据管理 ---------- */
const noteCount = computed(() => noteStore.notes.length)
const todoCount = computed(() => todoStore.todos.length)

const fileInput = ref<HTMLInputElement>()
const importMode = ref<ImportMode>('merge')
const busy = ref(false)
const dataMsg = ref<{ type: 'ok' | 'err'; text: string } | null>(null)
/** 导入成功后需要刷新才生效（审查 M-31）：改为手动确认，不再 1.2s 后强制刷新 */
const needReload = ref(false)

async function onExport() {
  try {
    busy.value = true
    await exportToFile()
    dataMsg.value = { type: 'ok', text: t('settings.exported') }
  } catch (e) {
    dataMsg.value = { type: 'err', text: t('settings.exportFailed', { msg: (e as Error).message }) }
  } finally {
    busy.value = false
  }
}

function pickFile(mode: ImportMode) {
  importMode.value = mode
  fileInput.value?.click()
}

/** 导入成功后手动刷新（审查 M-31）：localStorage 数据需重新初始化各 store */
function reload() {
  location.reload()
}

async function onFileChosen(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  ;(e.target as HTMLInputElement).value = ''
  if (!file) return
  if (
    importMode.value === 'replace' &&
    !(await confirm({
      title: t('settings.importReplaceTitle'),
      message: t('settings.importReplaceMsg'),
      confirmText: t('settings.importReplace'),
      danger: true
    }))
  )
    return
  try {
    busy.value = true
    const backup = await readBackupFile(file)
    const r = await importBackup(backup, importMode.value)
    // 导入后主动刷新内存态，避免 UI 继续显示旧数据（审查 H-15 / M-45）
    try {
      await noteStore.reload()
      todoStore.reload()
      dataMsg.value = {
        type: 'ok',
        text: t('settings.importSuccess', {
          notes: r.notes,
          todos: r.todos,
          mode: importMode.value === 'merge' ? t('settings.importMerge') : t('settings.importReplace')
        })
      }
      needReload.value = false
    } catch {
      // 刷新失败（如 IndexedDB 不可用）再退回手动整页刷新
      dataMsg.value = {
        type: 'ok',
        text: t('settings.importSuccessManual', { notes: r.notes, todos: r.todos })
      }
      needReload.value = true
    }
  } catch (err) {
    dataMsg.value = { type: 'err', text: t('settings.importFailed', { msg: (err as Error).message }) }
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
  { value: 'light', label: 'settings.themeLight', icon: 'i-carbon-sun' },
  { value: 'dark', label: 'settings.themeDark', icon: 'i-carbon-moon' },
  { value: 'system', label: 'settings.themeSystem', icon: 'i-carbon-laptop' }
]

const channels: { value: AIProviderType; label: string; icon: string }[] = [
  { value: 'local', label: 'settings.channelLocal', icon: 'i-carbon-laptop' },
  { value: 'cloud', label: 'settings.channelCloud', icon: 'i-carbon-cloud' }
]

const locales = SUPPORTED_LOCALES
</script>

<template>
  <div class="space-y-5 max-w-2xl">
    <h2 class="text-xl font-bold m-0">{{ t('settings.title') }}</h2>

    <!-- 个人资料 -->
    <section class="setting-card rounded-2xl p-5">
      <div class="font-semibold text-sm mb-1">{{ t('settings.profile') }}</div>
      <p class="text-xs text-fg-faint mt-0 mb-3">{{ t('settings.profileHint') }}</p>
      <input
        v-model="settings.userName"
        :placeholder="t('settings.namePlaceholder')"
        class="input-modern w-full max-w-xs px-3 py-2 text-sm"
        maxlength="12"
      />
    </section>

    <!-- 外观 -->
    <section class="setting-card rounded-2xl p-5">
      <div class="font-semibold text-sm mb-1">{{ t('settings.appearance') }}</div>
      <p class="text-xs text-fg-faint mt-0 mb-4">{{ t('settings.appearanceHint') }}</p>
      <div class="seg inline-flex p-1 rounded-xl gap-1" role="radiogroup" :aria-label="t('settings.themeAria')">
        <button
          v-for="m in modes"
          :key="m.value"
          @click="setTheme(m.value)"
          role="radio"
          :aria-checked="theme === m.value ? 'true' : 'false'"
          class="seg-item flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm cursor-pointer border-none"
          :class="theme === m.value ? 'seg-active' : ''"
        >
          <span :class="m.icon" class="text-base" />
          {{ t(m.label) }}
        </button>
      </div>
    </section>

    <!-- 语言 -->
    <section class="setting-card rounded-2xl p-5">
      <div class="font-semibold text-sm mb-1">{{ t('settings.langTitle') }}</div>
      <p class="text-xs text-fg-faint mt-0 mb-3">{{ t('settings.langHint') }}</p>
      <label class="field max-w-xs">
        <select
          v-model="settings.locale"
          class="input-modern w-full px-3 py-2 text-sm"
          :aria-label="t('settings.langAria')"
        >
          <option v-for="l in locales" :key="l.code" :value="l.code">{{ l.label }}</option>
        </select>
      </label>
    </section>

    <!-- AI 通道 -->
    <section class="setting-card rounded-2xl p-5 space-y-4">
      <div>
        <div class="font-semibold text-sm mb-1">{{ t('settings.aiTitle') }}</div>
        <p class="text-xs text-fg-faint mt-0 mb-3">{{ t('settings.aiHint') }}</p>
      <div class="seg inline-flex p-1 rounded-xl gap-1" role="radiogroup" :aria-label="t('settings.aiTitle')">
        <button
          v-for="c in channels"
          :key="c.value"
          @click="settings.aiProvider = c.value"
          role="radio"
          :aria-checked="settings.aiProvider === c.value ? 'true' : 'false'"
          class="seg-item flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm cursor-pointer border-none"
          :class="settings.aiProvider === c.value ? 'seg-active' : ''"
        >
          <span :class="c.icon" class="text-base" />
          {{ t(c.label) }}
        </button>
      </div>
      </div>

      <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <label class="field">
          <span class="field-label">{{ t('settings.fieldAddress') }}</span>
          <input
            v-model="settings.aiBaseUrl"
            class="input-modern w-full px-3 py-2 text-sm"
            :placeholder="settings.aiProvider === 'local' ? 'http://127.0.0.1:11434' : 'https://api.openai.com/v1'"
          />
        </label>
        <label class="field">
          <span class="field-label">{{ t('settings.fieldModel') }}</span>
          <input
            v-model="settings.aiModel"
            class="input-modern w-full px-3 py-2 text-sm"
            :placeholder="settings.aiProvider === 'local' ? 'llama3' : 'gpt-4o-mini'"
          />
        </label>
      </div>

      <div v-if="settings.aiProvider === 'cloud'" class="field">
        <span class="field-label">{{ t('settings.fieldApiKey') }}</span>
        <input
          v-model="settings.aiApiKey"
          type="password"
          class="input-modern w-full px-3 py-2 text-sm"
          placeholder="sk-..."
        />
        <label class="flex items-center gap-2 text-xs text-fg-soft mt-2 cursor-pointer select-none">
          <input v-model="settings.aiKeyRemember" type="checkbox" class="cursor-pointer" />
          {{ t('settings.rememberKey') }}
        </label>
        <p class="field-hint">
          {{ t('settings.keyHint') }}
        </p>
      </div>
    </section>

    <!-- 数据与存储 -->
    <section class="setting-card rounded-2xl p-5 space-y-4">
      <div>
        <div class="font-semibold text-sm mb-1">{{ t('settings.dataTitle') }}</div>
        <p class="text-xs text-fg-faint mt-0 mb-0">
          {{ t('settings.dataHint', { notes: noteCount, todos: todoCount }) }}
        </p>
      </div>

      <div class="flex flex-wrap items-center gap-2">
        <button class="btn-primary px-4 py-2 rounded-xl text-sm flex items-center gap-1.5" :disabled="busy" @click="onExport">
          <span class="i-carbon-download text-base" />
          {{ t('settings.exportBtn') }}
        </button>
        <button class="data-btn px-4 py-2 rounded-xl text-sm flex items-center gap-1.5" :disabled="busy" @click="pickFile('merge')">
          <span class="i-carbon-upload text-base" />
          {{ t('settings.importMerge') }}
        </button>
        <button class="data-btn data-btn-danger px-4 py-2 rounded-xl text-sm flex items-center gap-1.5" :disabled="busy" @click="pickFile('replace')">
          <span class="i-carbon-warning-alt text-base" />
          {{ t('settings.importReplace') }}
        </button>
        <input ref="fileInput" type="file" accept=".json,application/json" class="hidden" @change="onFileChosen" />
      </div>

      <p v-if="dataMsg" class="text-xs m-0" :class="dataMsg.type === 'ok' ? 'msg-ok' : 'msg-err'" aria-live="polite">
        {{ dataMsg.text }}
      </p>
      <button
        v-if="needReload"
        @click="reload"
        class="btn-primary px-4 py-2 rounded-xl text-sm"
      >{{ t('settings.reloadBtn') }}</button>
      <p class="field-hint m-0">
        {{ t('settings.backupHint') }}
      </p>
    </section>

    <!-- 快捷键 -->
    <section class="setting-card rounded-2xl p-5">
      <div class="font-semibold text-sm mb-1">{{ t('settings.shortcutTitle') }}</div>
      <p class="text-xs text-fg-faint mt-0 mb-4">{{ t('settings.shortcutHint') }}</p>
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
        <div class="font-semibold text-sm">{{ t('app.name') }} QingJian</div>
        <div class="text-xs text-fg-faint mt-0.5">{{ t('about.desc', { version: t('app.version') }) }}</div>
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
  transition: color 0.15s ease, background-color 0.15s ease, box-shadow 0.15s ease;
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
  transition: color 0.15s ease, border-color 0.15s ease, background-color 0.15s ease;
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
