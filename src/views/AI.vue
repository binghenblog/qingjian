<script setup lang="ts">
import { ref } from 'vue'
import { defaultProvider, type ChatMessage } from '@/services/ai'

const input = ref('')
const reply = ref('')
const loading = ref(false)

async function send() {
  if (!input.value.trim()) return
  loading.value = true
  const messages: ChatMessage[] = [{ role: 'user', content: input.value }]
  reply.value = await defaultProvider.chat(messages)
  loading.value = false
  input.value = ''
}
</script>

<template>
  <div class="space-y-4">
    <h2 class="text-xl font-semibold">AI 助手</h2>
    <p class="text-sm text-fg-soft">
      统一 AIProvider 接口；M3 接入云端（OpenAI 兼容）与本地（Ollama）双通道，经 Tauri 后端中转，Key 不进前端包体。
    </p>
    <div class="flex gap-2">
      <input
        v-model="input"
        @keyup.enter="send"
        placeholder="说点什么…"
        class="flex-1 px-3 py-2 rounded border border-border bg-bg-soft outline-none"
      />
      <button @click="send" :disabled="loading" class="px-4 py-2 rounded bg-brand text-white disabled:opacity-50">
        发送
      </button>
    </div>
    <div v-if="reply" class="p-3 rounded border border-border bg-bg-soft text-sm">{{ reply }}</div>
  </div>
</template>
