<script setup lang="ts">
import { ref, nextTick, computed } from 'vue'
import { useSettingsStore } from '@/stores/settings'
import { createProvider, type ChatMessage, type AIConfig } from '@/services/ai'

const settings = useSettingsStore()

interface Bubble {
  role: 'user' | 'assistant'
  content: string
}

const input = ref('')
const loading = ref(false)
const bubbles = ref<Bubble[]>([])
const scrollEl = ref<HTMLElement>()

const channelLabel = computed(() => {
  const type = settings.aiProvider === 'cloud' ? '云端' : '本地 Ollama'
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

  const messages: ChatMessage[] = bubbles.value
    .filter((b) => b !== assistant && b.content)
    .map((b) => ({ role: b.role, content: b.content }))

  try {
    const provider = createProvider(buildConfig())
    for await (const token of provider.chat(messages)) {
      assistant.content += token
      await scrollBottom()
    }
    if (!assistant.content) assistant.content = '（模型未返回内容）'
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : '请求失败'
    assistant.content = `⚠️ ${msg}\n\n如为云端通道，纯 Web 端可能受 CORS 限制；桌面版会经本地后端中转解决此问题。`
  } finally {
    loading.value = false
    await scrollBottom()
  }
}
</script>

<template>
  <div class="flex flex-col h-full max-w-3xl">
    <!-- 通道状态条 -->
    <div class="flex items-center gap-2 mb-3 text-xs text-fg-faint">
      <span class="w-1.5 h-1.5 rounded-full" :class="settings.aiProvider === 'cloud' ? 'bg-sky-500' : 'bg-brand'" />
      <span>当前通道：{{ channelLabel }}</span>
      <RouterLink to="/settings" class="ml-auto text-brand-strong hover:underline">去设置切换</RouterLink>
    </div>

    <!-- 对话区 -->
    <div ref="scrollEl" class="flex-1 overflow-auto space-y-4 pb-4">
      <!-- 空状态 -->
      <div v-if="bubbles.length === 0" class="grid place-items-center h-full text-center">
        <div>
          <span class="ai-orb inline-grid place-items-center w-14 h-14 rounded-2xl mb-3">
            <span class="i-carbon-ai-status text-2xl text-white" />
          </span>
          <h3 class="font-semibold m-0 mb-1">AI 助手</h3>
          <p class="text-sm text-fg-faint m-0 max-w-xs leading-relaxed">
            支持本地 Ollama 与云端 OpenAI 兼容双通道，流式输出。<br />
            默认走本地通道，请先安装并启动 Ollama。
          </p>
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
        :placeholder="needsKey ? '云端通道需要先在设置填写 API Key' : '说点什么…（Enter 发送）'"
        rows="1"
        class="flex-1 px-3 py-2 bg-transparent border-none outline-none text-sm text-fg placeholder:text-fg-faint resize-none max-h-32 leading-relaxed"
      />
      <button
        @click="send"
        :disabled="loading || !input.trim() || needsKey"
        class="btn-primary w-9 h-9 grid place-items-center rounded-xl shrink-0"
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
