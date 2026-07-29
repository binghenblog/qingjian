<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { useTodoStore } from '@/stores/todos'
import TodoBadges from '@/components/TodoBadges.vue'

const router = useRouter()
const store = useTodoStore()

const today = computed(() =>
  new Date().toLocaleDateString('zh-CN', { month: 'long', day: 'numeric', weekday: 'long' })
)

const greeting = computed(() => {
  const h = new Date().getHours()
  if (h < 6) return '夜深了'
  if (h < 12) return '早上好'
  if (h < 14) return '中午好'
  if (h < 18) return '下午好'
  return '晚上好'
})

/** 今日待办：未完成，按优先级排序，最多 6 条 */
const topPending = computed(() => store.pending.slice(0, 6))

/** 统计数据 */
const total = computed(() => store.todos.length)
const done = computed(() => store.doneCount)
const completionRate = computed(() => (total.value ? Math.round((done.value / total.value) * 100) : 0))

/** 本周完成数 */
const weekDone = computed(() => {
  const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000
  return store.todos.filter((t) => t.done && t.createdAt > weekAgo).length
})

/** 今日新增 */
const todayAdded = computed(() => {
  const start = new Date().setHours(0, 0, 0, 0)
  return store.todos.filter((t) => t.createdAt >= start).length
})

/** 本周每日完成数（周日到周六） */
const weekBars = computed(() => {
  const bars: number[] = new Array(7).fill(0)
  const now = new Date()
  const base = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const startOfWeek = base.getTime() - base.getDay() * 24 * 60 * 60 * 1000
  store.todos.forEach((t) => {
    if (!t.done) return
    const dayIdx = Math.floor((t.createdAt - startOfWeek) / (24 * 60 * 60 * 1000))
    if (dayIdx >= 0 && dayIdx < 7) bars[dayIdx]++
  })
  const max = Math.max(1, ...bars)
  return bars.map((count) => ({ count, height: `${Math.round((count / max) * 100)}%` }))
})

const weekLabels = ['日', '一', '二', '三', '四', '五', '六']

function addTodo() {
  router.push('/todos')
}

function addProgress() {
  // 未来可打开"记一笔进展"弹窗；现在跳到待办页
  router.push('/todos')
}
</script>

<template>
  <div class="dashboard space-y-6 max-w-5xl">
    <!-- 顶部标题栏 -->
    <div class="flex items-end justify-between">
      <div>
        <div class="text-xs font-medium text-fg-faint tracking-wide mb-1">{{ today }}</div>
        <h1 class="text-2xl font-bold m-0 tracking-tight">
          {{ greeting }}，<span class="grad-text">冰痕</span>
        </h1>
      </div>
      <div class="flex items-center gap-2.5">
        <button @click="addTodo" class="action-btn flex items-center gap-1.5 px-3.5 py-2 text-sm">
          <span class="i-carbon-add text-base" />
          新工作
        </button>
        <button @click="addProgress" class="btn-primary flex items-center gap-1.5 px-4 py-2 text-sm">
          <span class="i-carbon-edit text-base" />
          记一笔进展
        </button>
      </div>
    </div>

    <!-- Hero 主视觉卡片 -->
    <section class="hero-card relative p-7 min-h-[180px] flex flex-col justify-between">
      <div class="relative z-10 max-w-lg">
        <div class="text-xs font-medium text-blue-100/80 mb-2">今天，只要记录真正重要的事</div>
        <h2 class="text-2xl sm:text-3xl font-bold m-0 leading-snug">
          把混乱编译成秩序。
        </h2>
        <p class="text-sm text-blue-50/90 mt-2 mb-0 leading-relaxed">
          每一次记录，都会进入你的周报、成果库与技能轨迹。
        </p>
      </div>
      <div class="relative z-10 mt-5">
        <button @click="addProgress" class="btn-secondary flex items-center gap-1.5 px-4 py-2 text-sm">
          <span class="i-carbon-edit text-base" />
          记下刚刚的进展
        </button>
      </div>
    </section>

    <!-- 两栏内容 -->
    <div class="grid grid-cols-1 lg:grid-cols-5 gap-5">
      <!-- 左侧：今日待办 -->
      <section class="panel lg:col-span-3 rounded-2xl p-5">
        <div class="flex items-center justify-between mb-4">
          <div class="flex items-center gap-2">
            <span class="text-xs font-bold text-fg-faint tracking-wider">TODAY</span>
            <span class="font-semibold">今天要推进</span>
            <span v-if="total" class="text-xs text-fg-faint">
              {{ done }} / {{ total }} 已完成
            </span>
          </div>
          <button
            @click="router.push('/todos')"
            class="text-xs text-fg-faint hover:text-brand cursor-pointer bg-transparent border-none flex items-center gap-1"
          >
            全部待办
            <span class="i-carbon-arrow-right" />
          </button>
        </div>

        <TransitionGroup v-if="topPending.length" name="list" tag="ul" class="space-y-2 p-0 m-0 list-none">
          <li
            v-for="t in topPending"
            :key="t.id"
            class="todo-row group flex items-center gap-3 px-3 py-3 rounded-xl"
          >
            <button
              @click="store.toggle(t.id)"
              class="check w-5 h-5 rounded-full flex items-center justify-center shrink-0 cursor-pointer"
              :class="{ 'check-done': t.done }"
            >
              <span v-if="t.done" class="i-carbon-checkmark text-[11px] leading-none text-white" />
            </button>
            <span class="flex-1 text-sm truncate">{{ t.title }}</span>
            <TodoBadges :priority="t.priority" :tag="t.tag" />
          </li>
        </TransitionGroup>

        <div v-else class="empty grid place-items-center py-12 rounded-xl text-center">
          <div>
            <span class="i-carbon-checkmark-outline text-3xl text-fg-faint" />
            <p class="text-sm text-fg-faint mt-2 mb-0">
              {{ total ? '所有待办都完成了，干得漂亮 🎉' : '暂无待办，从右上角添加第一项吧' }}
            </p>
          </div>
        </div>
      </section>

      <!-- 右侧：本周整体进展 -->
      <section class="panel lg:col-span-2 rounded-2xl p-5 flex flex-col">
        <div class="flex items-center justify-between mb-5">
          <span class="font-semibold">本周整体进展</span>
          <span class="text-xs text-fg-faint">最近 7 天</span>
        </div>

        <div class="grid grid-cols-3 gap-3 mb-5">
          <div class="stat-cell rounded-xl p-3 text-center">
            <div class="text-2xl font-bold text-fg">{{ todayAdded }}</div>
            <div class="text-[11px] text-fg-faint mt-0.5">今日新增</div>
          </div>
          <div class="stat-cell rounded-xl p-3 text-center">
            <div class="text-2xl font-bold text-fg">{{ weekDone }}</div>
            <div class="text-[11px] text-fg-faint mt-0.5">本周完成</div>
          </div>
          <div class="stat-cell rounded-xl p-3 text-center">
            <div class="text-2xl font-bold text-brand-strong">{{ completionRate }}%</div>
            <div class="text-[11px] text-fg-faint mt-0.5">完成率</div>
          </div>
        </div>

        <div class="flex-1 flex items-end justify-between gap-1 px-1">
          <div
            v-for="(bar, idx) in weekBars"
            :key="idx"
            class="bar-col flex flex-col items-center gap-1.5 flex-1"
          >
            <div class="bar-track w-full rounded-t-md relative" style="height: 84px;">
              <div
                class="bar-fill absolute bottom-0 left-0 right-0 rounded-t-md transition-all duration-500"
                :style="{ height: bar.height }"
              />
            </div>
            <span class="text-[10px] text-fg-faint">{{ weekLabels[idx] }}</span>
          </div>
        </div>
      </section>
    </div>

    <!-- 快捷入口 -->
    <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
      <button
        v-for="c in [
          { title: '笔记', desc: '本地优先的知识库', to: '/notes', icon: 'i-carbon-document', hue: 'card-teal' },
          { title: '待办', desc: 'GTD 风格任务管理', to: '/todos', icon: 'i-carbon-task', hue: 'card-blue' },
          { title: 'AI 助手', desc: '云端 / 本地双通道', to: '/ai', icon: 'i-carbon-ai-status', hue: 'card-violet' }
        ]"
        :key="c.to"
        @click="router.push(c.to)"
        class="feature-card text-left p-4 rounded-2xl cursor-pointer"
      >
        <span class="icon-chip grid place-items-center w-9 h-9 rounded-lg mb-3" :class="c.hue">
          <span :class="c.icon" class="text-lg" />
        </span>
        <div class="font-semibold text-sm">{{ c.title }}</div>
        <div class="text-xs text-fg-soft mt-0.5">{{ c.desc }}</div>
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

.action-btn {
  background: var(--c-surface);
  border: 1px solid var(--c-border);
  color: var(--c-fg);
  border-radius: var(--radius);
  font-weight: 500;
  cursor: pointer;
  transition: border-color 0.15s ease, background-color 0.15s ease;
}
.action-btn:hover {
  border-color: var(--c-brand);
  background: var(--c-surface-hover);
}

.panel {
  background: var(--c-surface);
  border: 1px solid var(--c-border);
  box-shadow: var(--shadow-sm);
}

.todo-row {
  background: var(--c-bg);
  border: 1px solid transparent;
  transition: border-color 0.15s ease, box-shadow 0.15s ease, background-color 0.15s ease;
}
.todo-row:hover {
  border-color: var(--c-border);
  background: var(--c-surface);
  box-shadow: var(--shadow-sm);
}

.check {
  border: 2px solid var(--c-border);
  background: transparent;
  transition: all 0.15s ease;
}
.check:hover {
  border-color: var(--c-brand);
  background: var(--c-brand-soft);
}
.check-done {
  border-color: var(--c-brand);
  background: var(--c-brand-grad);
}

.empty { border: 1.5px dashed var(--c-border); }

.stat-cell {
  background: var(--c-bg);
  border: 1px solid var(--c-border);
}

.bar-track { background: var(--c-bg); }
.bar-fill { background: var(--c-brand-grad); }

.feature-card {
  background: var(--c-surface);
  border: 1px solid var(--c-border);
  box-shadow: var(--shadow-sm);
  transition: transform 0.18s ease, box-shadow 0.18s ease, border-color 0.18s ease;
}
.feature-card:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow-md);
  border-color: var(--c-brand);
}

.icon-chip { color: #fff; }
.card-teal { background: linear-gradient(135deg, #14b8a6, #0d9488); }
.card-blue { background: linear-gradient(135deg, #38bdf8, #2563eb); }
.card-violet { background: linear-gradient(135deg, #a78bfa, #7c3aed); }

.milestone {
  background: var(--c-hero-soft);
  border: 1px dashed #bfdbfe;
}
.dark .milestone {
  background: rgba(30, 64, 175, 0.12);
  border-color: rgba(59, 130, 246, 0.35);
}

.list-enter-active, .list-leave-active { transition: all 0.2s ease; }
.list-enter-from { opacity: 0; transform: translateY(-6px); }
.list-leave-to { opacity: 0; transform: translateX(10px); }
</style>
