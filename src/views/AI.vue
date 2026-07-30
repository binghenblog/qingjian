<script setup lang="ts">
import { ref, nextTick, computed, watch, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useSettingsStore } from '@/stores/settings'
import { useAiStore } from '@/stores/ai'
import { useConfirm } from '@/composables/useConfirm'
import type { ChatSession } from '@/types'

const settings = useSettingsStore()
const ai = useAiStore()
const { t } = useI18n()
const { confirm } = useConfirm()

const input = ref('')
const scrollEl = ref<HTMLElement>()
/** 移动端会话抽屉显隐 */
const showSessions = ref(false)
/** 内联重命名状态 */
const editingId = ref<string | null>(null)
const editingTitle = ref('')

/** 当前会话消息 */
const messages = computed(() => ai.current?.messages ?? [])

const channelLabel = computed(() => {
  const type = settings.aiProvider === 'cloud' ? t('ai.channelCloud') : t('ai.channelLocal')
  return `${type} · ${settings.aiModel}`
})

const needsKey = computed(() => settings.aiProvider === 'cloud' && !settings.aiApiKey.trim())

async function scrollBottom() {
  await nextTick()
  scrollEl.value?.scrollTo({ top: scrollEl.value.scrollHeight, behavior: 'smooth' })
}

/** 提交输入框内容（流式发送已下沉到 store，便于命令面板 / 笔记页复用） */
function submit() {
  const text = input.value.trim()
  if (!text) return
  input.value = ''
  void ai.send(text)
}

function clearHistory() {
  const s = ai.current
  if (!s) return
  s.messages = []
}

function openNewSession() {
  ai.addSession()
  showSessions.value = false
  void nextTick(scrollBottom)
}

async function onDelete(session: ChatSession) {
  if (
    !(await confirm({
      title: t('ai.deleteChatTitle'),
      message: t('ai.deleteChatMsg', { title: session.title || t('ai.untitledChat') }),
      confirmText: t('ai.deleteChat'),
      danger: true
    }))
  )
    return
  ai.deleteSession(session.id)
}

function startRename(session: ChatSession) {
  editingId.value = session.id
  editingTitle.value = session.title
}

function commitRename() {
  if (editingId.value) ai.renameSession(editingId.value, editingTitle.value)
  editingId.value = null
}

// 切换会话后滚动到底部
watch(
  () => ai.currentId,
  () => void nextTick(scrollBottom)
)

onMounted(() => {
  void ai.load()
  void nextTick(scrollBottom)
})
</script>

<template>
  <div class="flex h-full gap-3 min-h-0">
    <!-- 会话列表：桌面常驻 / 移动端抽屉 -->
    <aside
      class="w-56 shrink-0 flex flex-col rounded-2xl bg-surface border border-border overflow-hidden"
      :class="showSessions ? 'flex' : 'hidden md:flex'"
    >
      <div class="flex items-center justify-between px-3 py-2.5 border-b border-border shrink-0">
        <span class="text-sm font-semibold">{{ t('ai.sessions') }}</span>
        <button class="icon-btn" @click="openNewSession" :title="t('ai.newChat')" :aria-label="t('ai.newChat')">
          <span class="i-carbon-add text-base" />
        </button>
      </div>
      <ul class="flex-1 overflow-auto p-1.5 space-y-1">
        <li v-for="s in ai.sessions" :key="s.id">
          <div
            class="group flex items-center gap-1.5 px-2.5 py-2 rounded-xl cursor-pointer text-sm"
            :class="s.id === ai.currentId ? 'sess-active' : ''"
            @click="ai.selectSession(s.id); showSessions = false"
          >
            <template v-if="editingId === s.id">
              <input
                v-model="editingTitle"
                autofocus
                @keydown.enter.prevent="commitRename"
                @keydown.esc.prevent="editingId = null"
                @blur="commitRename"
                class="sess-rename flex-1 px-1 py-0.5 text-sm bg-transparent border-none outline-none min-w-0"
                :aria-label="t('ai.renameChat')"
              />
            </template>
            <template v-else>
              <span class="sess-title flex-1 truncate" @dblclick="startRename(s)">{{ s.title || t('ai.untitledChat') }}</span>
              <button
                class="sess-icon opacity-0 group-hover:opacity-100"
                @click.stop="startRename(s)"
                :title="t('ai.renameChat')"
                :aria-label="t('ai.renameChat')"
              >
                <span class="i-carbon-edit text-xs" />
              </button>
              <button
                class="sess-icon opacity-0 group-hover:opacity-100 hover:text-red-500"
                @click.stop="onDelete(s)"
                :title="t('ai.deleteChat')"
                :aria-label="t('ai.deleteChat')"
              >
                <span class="i-carbon-trash-can text-xs" />
              </button>
            </template>
          </div>
        </li>
        <li v-if="ai.sessions.length === 0" class="text-xs text-fg-faint px-2.5 py-3 text-center">
          {{ t('ai.noChats') }}
        </li>
      </ul>
    </aside>

    <!-- 主对话区 -->
    <div class="flex-1 flex flex-col min-w-0">
      <!-- 屏幕阅读器状态播报（审查 C-6） -->
      <div class="sr-only" role="status" aria-live="polite">{{ ai.status }}</div>

      <!-- 通道状态条 -->
      <div class="flex items-center gap-2 mb-3 text-xs text-fg-faint shrink-0">
        <button class="icon-btn md:hidden" @click="showSessions = !showSessions" :aria-label="t('ai.sessions')">
          <span class="i-carbon-list" />
        </button>
        <span class="w-1.5 h-1.5 rounded-full" :class="settings.aiProvider === 'cloud' ? 'bg-sky-500' : 'bg-brand'" />
        <span>{{ t('ai.channelPrefix') }}{{ channelLabel }}</span>
        <button
          v-if="messages.length"
          @click="clearHistory"
          class="ml-auto bg-transparent border-none text-fg-faint hover:text-red-500 cursor-pointer text-xs p-0"
          :title="t('ai.clearChat')"
          :aria-label="t('ai.clearChat')"
        >{{ t('ai.clearChat') }}</button>
        <RouterLink to="/settings" class="text-brand-strong hover:underline" :class="{ 'ml-auto': !messages.length }">{{ t('ai.goToSettings') }}</RouterLink>
      </div>

      <!-- 对话区（role=log：屏幕阅读器可感知新回复追加，审查 H-12） -->
      <div ref="scrollEl" class="flex-1 overflow-auto space-y-4 pb-4" role="log" aria-live="polite" aria-label="对话记录">
        <!-- 空状态 -->
        <div v-if="messages.length === 0" class="grid place-items-center h-full text-center">
          <div>
            <span class="ai-orb inline-grid place-items-center w-14 h-14 rounded-2xl mb-3">
              <span class="i-carbon-ai-status text-2xl text-white" />
            </span>
            <h3 class="font-semibold m-0 mb-1">{{ t('ai.title') }}</h3>
            <p class="text-sm text-fg-faint m-0 max-w-xs leading-relaxed" v-html="t('ai.emptyHint')" />
          </div>
        </div>

        <!-- 气泡 -->
        <div
          v-for="(b, i) in messages"
          :key="i"
          class="flex"
          :class="b.role === 'user' ? 'justify-end' : 'justify-start'"
        >
          <div
            class="max-w-[78%] px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap break-words"
            :class="b.role === 'user' ? 'bubble-user' : 'bubble-ai'"
          >
            <template v-if="b.content">{{ b.content }}</template>
            <span v-else class="dots flex gap-1.5 items-center">
              <span class="dot" /><span class="dot" style="animation-delay: 0.15s" /><span class="dot" style="animation-delay: 0.3s" />
            </span>
          </div>
        </div>
      </div>

      <!-- 输入区 -->
      <div class="composer flex items-end gap-2.5 p-2.5 rounded-2xl shrink-0">
        <textarea
          v-model="input"
          @keydown.enter.exact.prevent="submit"
          :placeholder="needsKey ? t('ai.placeholderNeedsKey') : t('ai.placeholder')"
          rows="1"
          class="flex-1 px-3 py-2 bg-transparent border-none outline-none text-sm text-fg placeholder:text-fg-faint resize-none max-h-32 leading-relaxed"
        />
        <!-- 流式输出中显示停止按钮（M-3） -->
        <button
          v-if="ai.isStreaming"
          @click="ai.stop()"
          class="stop-btn w-9 h-9 grid place-items-center rounded-xl shrink-0 cursor-pointer"
          :title="t('ai.stop')"
          :aria-label="t('ai.stop')"
        >
          <span class="i-carbon-stop-filled text-base" />
        </button>
        <button
          v-else
          @click="submit"
          :disabled="!input.trim() || needsKey"
          class="btn-primary w-9 h-9 grid place-items-center rounded-xl shrink-0"
          :aria-label="t('ai.send')"
        >
          <span class="i-carbon-send-alt text-base" />
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.ai-orb {
  background: var(--c-brand-grad);
  box-shadow: 0 6px 20px var(--c-brand-soft);
}

.bubble-user {
  background: var(--c-brand-grad);
  color: #fff;
  border-radius: 16px 16px 4px 16px;
}
.bubble-ai {
  background: var(--c-surface);
  border: 1px solid var(--c-border);
  border-radius: 16px 16px 16px 4px;
}

.composer {
  background: var(--c-surface);
  border: 1px solid var(--c-border);
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
}
.composer:focus-within {
  border-color: var(--c-brand);
  box-shadow: 0 0 0 3px var(--c-brand-soft);
}

.stop-btn {
  background: var(--c-bg);
  border: 1px solid var(--c-border);
  color: #ef4444;
  transition: border-color 0.15s ease;
}
.stop-btn:hover { border-color: #ef4444; }

.sess-active {
  background: var(--c-brand-soft);
  color: var(--c-brand-strong);
  font-weight: 600;
}
.dark .sess-active { color: var(--c-brand); }

.icon-btn {
  display: grid;
  place-items: center;
  width: 28px;
  height: 28px;
  border-radius: 8px;
  border: none;
  background: transparent;
  color: var(--c-fg-soft);
  cursor: pointer;
  transition: color 0.15s ease, background-color 0.15s ease;
}
.icon-btn:hover { color: var(--c-fg); background: var(--c-bg); }

.sess-icon {
  display: grid;
  place-items: center;
  width: 22px;
  height: 22px;
  border-radius: 6px;
  border: none;
  background: transparent;
  color: var(--c-fg-faint);
  cursor: pointer;
  transition: color 0.15s ease, background-color 0.15s ease;
}
.sess-icon:hover { color: var(--c-fg); background: var(--c-bg); }

.sess-rename {
  color: var(--c-fg);
  border-bottom: 1px solid var(--c-border);
}

.dots { min-height: 18px; }
.dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--c-fg-faint);
  animation: bounce 1s infinite ease-in-out;
}
@keyframes bounce {
  0%, 80%, 100% { transform: translateY(0); opacity: 0.4; }
  40% { transform: translateY(-4px); opacity: 1; }
}
</style>
