<script setup lang="ts">
import { useRouter } from 'vue-router'

const router = useRouter()

const cards = [
  { title: '笔记', desc: '本地优先的知识库', to: '/notes', icon: 'i-carbon-document' },
  { title: '待办', desc: 'GTD 风格任务', to: '/todos', icon: 'i-carbon-task' },
  { title: 'AI 助手', desc: '云端 / 本地双通道', to: '/ai', icon: 'i-carbon-ai-status' }
]
</script>

<template>
  <div class="space-y-6">
    <h1 class="text-2xl font-bold">欢迎回来 👋</h1>
    <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
      <button
        v-for="c in cards"
        :key="c.to"
        @click="router.push(c.to)"
        class="text-left p-4 rounded-xl border border-border bg-bg-soft hover:border-brand transition"
      >
        <span :class="c.icon" class="text-2xl text-brand" />
        <div class="mt-2 font-medium">{{ c.title }}</div>
        <div class="text-sm text-fg-soft">{{ c.desc }}</div>
      </button>
    </div>
    <p class="text-sm text-fg-soft">M0 脚手架已就绪 · 数据层 / AI 接入将在后续里程碑实现。</p>
  </div>
</template>
