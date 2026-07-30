<script setup lang="ts">
import { ref, nextTick, computed, watch, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useSettingsStore } from '@/stores/settings'
import { createProvider, type ChatMessage, type AIConfig } from '@/services/ai'

const settings = useSettingsStore()
const { t } = useI18n()

interface Bubble {
  role: 'user' | 'assistant'
  content: string
}

/** 会话内历史持久化（审查 M-17）：切页/刷新不丢，关浏览器即清 */
const HISTORY_KEY = 'qingjian.ai-history'

function loadHistory(): Bubble[] {
  try {
    const raw = sessionStorage.getItem(HISTORY_KEY)
    const list = raw ? JSON.parse(raw) : []
    return Array.isArray(list) ? list : []
  } catch {
    return []
  }
}

const input = ref('')
const loading = ref(false)
const bubbles = ref<Bubble[]>(loadHistory())
const scrollEl = ref<HTMLElement>()
/** 屏幕阅读器状态播报（审查 C-6）：流式生成/停止/出错时通知 */
const srStatus = ref('')

watch(
  bubbles,
  (v) => {
    try {
      sessionStorage.setItem(HISTORY_KEY, JSON.stringify(v))
    } catch {
      /* 配额满等异常忽略 */
    }
  },
  { deep: true }
)

function clearHistory() {
  bubbles.value = []
  sessionStorage.removeItem(HISTORY_KEY)
}

const channelLabel = computed(() => {
  const type = settings.aiProvider === 'cloud' ? t('ai.channelCloud') : t('ai.channelLocal')
  return `${type} · ${settings.aiModel}`
})

const needsKey = computed(() => settings.aiProvider === 'cloud' && !settings.aiApiKey.trim())

function buildConfig(): AIConfig {
  return {
    type: settings.aiProvider,
    baseUrl: settings.aiBaseUrl,
    apiKey: settings.aiApiKey,
    model: settings.aiModel
  }
}

async function scrollBottom() {
  await nextTick()
  scrollEl.value?.scrollTo({ top: scrollEl.value.scrollHeight, behavior: 'smooth' })
}

/** 流式请求中止（审查 M-3） */
let controller: AbortController | null = null

function stop() {
  controller?.abort()
}

onUnmounted(() => controller?.abort())

async function send() {
  const text = input.value.trim()
  if (!text || loading.value) return
  if (needsKey.value) return
  input.value = ''
  bubbles.value.push({ role: 'user', content: text })
  loading.value = true
  await scrollBottom()

  const assistant: Bubble = { role: 'assistant', content: '' }
  bubbles.value.push(assistant)
  srStatus.value = t('ai.generating')

  const messages: ChatMessage[] = bubbles.value
    .filter((b) => b !== assistant && b.content)
    .map((b) => ({ role: b.role, content: b.content }))

  controller = new AbortController()
  try {
    const provider = createProvider(buildConfig())
    for await (const token of provider.chat(messages, controller.signal)) {
      assistant.content += token
      await scrollBottom()
    }
    if (!assistant.content) assistant.content = t('ai.emptyModelResponse')
  } catch (e: unknown) {
    if (e instanceof DOMException && e.name === 'AbortError') {
      if (!assistant.content) assistant.content = t('ai.stopped')
      srStatus.value = t('ai.stoppedStatus')
    } else {
      const msg = e instanceof Error ? e.message : t('ai.errorFallback')
      assistant.content = t('ai.errorBody', { msg })
      srStatus.value = t('ai.errorStatus')
    }
  } finally {
    controller = null
    loading.value = false
    await scrollBottom()
  }
}
</script>

<template>
  <div class="flex flex-col h-full max-w-3xl">
    <!-- 屏幕阅读器状态播报（审查 C-6） -->
    <div class="sr-only" role="status" aria-live="polite">{{ srStatus }}</div>
    <!-- 通道状态条 -->
    <div class="flex items-center gap-2 mb-3 text-xs text-fg-faint">
      <span class="w-1.5 h-1.5 rounded-full" :class="settings.aiProvider === 'cloud' ? 'bg-sky-500' : 'bg-brand'" />
      <span>{{ t('ai.channelPrefix') }}{{ channelLabel }}</span>
      <button
        v-if="bubbles.length"
        @click="clearHistory"
        class="ml-auto bg-transparent border-none text-fg-faint hover:text-red-500 cursor-pointer text-xs p-0"
        :title="t('ai.clearChat')"
        :aria-label="t('ai.clearChat')"
      >{{ t('ai.clearChat') }}</button>
      <RouterLink to="/settings" class="text-brand-strong hover:underline" :class="{ 'ml-auto': !bubbles.length }">{{ t('ai.goToSettings') }}</RouterLink>
    </div>

    <!-- 对话区（role=log：屏幕阅读器可感知新回复追加，审查 H-12） -->
    <div ref="scrollEl" class="flex-1 overflow-auto space-y-4 pb-4" role="log" aria-live="polite" aria-label="对话记录">
      <!-- 空状态 -->
      <div v-if="bubbles.length === 0" class="grid place-items-center h-full text-center">
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
        v-for="(b, i) in bubbles"
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
        @keydown.enter.exact.prevent="send"
        :placeholder="needsKey ? t('ai.placeholderNeedsKey') : t('ai.placeholder')"
        rows="1"
        class="flex-1 px-3 py-2 bg-transparent border-none outline-none text-sm text-fg placeholder:text-fg-faint resize-none max-h-32 leading-relaxed"
      />
      <!-- 流式输出中显示停止按钮（M-3） -->
      <button
        v-if="loading"
        @click="stop"
        class="stop-btn w-9 h-9 grid place-items-center rounded-xl shrink-0 cursor-pointer"
        :title="t('ai.stop')"
        :aria-label="t('ai.stop')"
      >
        <span class="i-carbon-stop-filled text-base" />
      </button>
      <button
        v-else
        @click="send"
        :disabled="!input.trim() || needsKey"
        class="btn-primary w-9 h-9 grid place-items-center rounded-xl shrink-0"
        :aria-label="t('ai.send')"
      >
        <span class="i-carbon-send-alt text-base" />
      </button>
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
