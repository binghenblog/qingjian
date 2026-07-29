<script setup lang="ts">
import { ref, nextTick } from 'vue'
import { defaultProvider, type ChatMessage } from '@/services/ai'

interface Bubble {
  role: 'user' | 'assistant'
  content: string
}

const input = ref('')
const loading = ref(false)
const bubbles = ref<Bubble[]>([])
const scrollEl = ref<HTMLElement>()

async function send() {
  const text = input.value.trim()
  if (!text || loading.value) return
  input.value = ''
  bubbles.value.push({ role: 'user', content: text })
  loading.value = true
  await scrollBottom()

  const messages: ChatMessage[] = [{ role: 'user', content: text }]
  const reply = await defaultProvider.chat(messages)
  bubbles.value.push({ role: 'assistant', content: reply })
  loading.value = false
  await scrollBottom()
}

async function scrollBottom() {
  await nextTick()
  scrollEl.value?.scrollTo({ top: scrollEl.value.scrollHeight, behavior: 'smooth' })
}
</script>

<template>
  <div class="flex flex-col h-full max-w-3xl">
    <!-- 对话区 -->
    <div ref="scrollEl" class="flex-1 overflow-auto space-y-4 pb-4">
      <!-- 空状态 -->
      <div v-if="bubbles.length === 0" class="grid place-items-center h-full text-center">
        <div>
          <span class="ai-orb inline-grid place-items-center w-14 h-14 rounded-2xl mb-3">
            <span class="i-carbon-ai-status text-2xl text-white" />
          </span>
          <h3 class="font-semibold m-0 mb-1">AI 助手</h3>
          <p class="text-sm text-fg-faint m-0 max-w-xs">
            M3 将接入云端（OpenAI 兼容）与本地（Ollama）双通道，Key 经 Tauri 后端中转，不进前端包体
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
          class="max-w-[78%] px-4 py-2.5 text-sm leading-relaxed"
          :class="b.role === 'user' ? 'bubble-user' : 'bubble-ai'"
        >
          {{ b.content }}
        </div>
      </div>

      <!-- 加载中 -->
      <div v-if="loading" class="flex justify-start">
        <div class="bubble-ai px-4 py-3 flex gap-1.5 items-center">
          <span class="dot" /><span class="dot" style="animation-delay: 0.15s" /><span class="dot" style="animation-delay: 0.3s" />
        </div>
      </div>
    </div>

    <!-- 输入区 -->
    <div class="composer flex items-end gap-2.5 p-2.5 rounded-2xl shrink-0">
      <input
        v-model="input"
        @keyup.enter="send"
        placeholder="说点什么…（当前为 Stub 占位通道）"
        class="flex-1 px-3 py-2 bg-transparent border-none outline-none text-sm text-fg placeholder:text-fg-faint"
      />
      <button
        @click="send"
        :disabled="loading || !input.trim()"
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
