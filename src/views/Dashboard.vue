<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()

const greeting = computed(() => {
  const h = new Date().getHours()
  if (h < 6) return '夜深了'
  if (h < 12) return '早上好'
  if (h < 14) return '中午好'
  if (h < 18) return '下午好'
  return '晚上好'
})

const today = computed(() =>
  new Date().toLocaleDateString('zh-CN', { month: 'long', day: 'numeric', weekday: 'long' })
)

const cards = [
  { title: '笔记', desc: '本地优先的知识库', to: '/notes', icon: 'i-carbon-document', hue: 'card-teal' },
  { title: '待办', desc: 'GTD 风格任务管理', to: '/todos', icon: 'i-carbon-task', hue: 'card-blue' },
  { title: 'AI 助手', desc: '云端 / 本地双通道', to: '/ai', icon: 'i-carbon-ai-status', hue: 'card-violet' }
]
</script>

<template>
  <div class="space-y-8 max-w-3xl">
    <!-- 问候区 -->
    <div>
      <div class="text-sm text-fg-faint mb-1">{{ today }}</div>
      <h1 class="text-3xl font-bold m-0 tracking-tight">
        {{ greeting }}，<span class="grad-text">冰痕</span> 👋
      </h1>
    </div>

    <!-- 功能卡片 -->
    <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
      <button
        v-for="c in cards"
        :key="c.to"
        @click="router.push(c.to)"
        class="feature-card text-left p-5 rounded-2xl cursor-pointer"
      >
        <span class="icon-chip grid place-items-center w-10 h-10 rounded-xl mb-3" :class="c.hue">
          <span :class="c.icon" class="text-xl" />
        </span>
        <div class="font-semibold text-fg">{{ c.title }}</div>
        <div class="text-sm text-fg-soft mt-0.5">{{ c.desc }}</div>
      </button>
    </div>

    <!-- 状态说明 -->
    <div class="milestone flex items-center gap-3 px-4 py-3 rounded-2xl text-sm">
      <span class="i-carbon-rocket text-brand text-lg shrink-0" />
      <span class="text-fg-soft">M0 脚手架已就绪 · 数据持久化（M1）与 AI 接入（M3）将在后续里程碑上线</span>
    </div>
  </div>
</template>

<style scoped>
.grad-text {
  background: var(--c-brand-grad);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
}

.feature-card {
  background: var(--c-surface);
  border: 1px solid var(--c-border);
  box-shadow: var(--shadow-sm);
  transition: transform 0.18s ease, box-shadow 0.18s ease, border-color 0.18s ease;
}
.feature-card:hover {
  transform: translateY(-3px);
  box-shadow: var(--shadow-md);
  border-color: var(--c-brand);
}

.icon-chip { color: #fff; }
.card-teal { background: linear-gradient(135deg, #14b8a6, #0d9488); }
.card-blue { background: linear-gradient(135deg, #38bdf8, #2563eb); }
.card-violet { background: linear-gradient(135deg, #a78bfa, #7c3aed); }

.milestone {
  background: var(--c-brand-soft);
  border: 1px dashed var(--c-brand);
}
</style>
