<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useTodoStore, dateKey } from '@/stores/todos'
import { useSettingsStore } from '@/stores/settings'
import TodoBadges from '@/components/TodoBadges.vue'
import { DAILY_CATEGORY } from '@/types'

const router = useRouter()
const store = useTodoStore()
const settings = useSettingsStore()
const { t } = useI18n()
/** 显示名：设置里可自定义，默认「朋友」 */
const displayName = computed(() => settings.userName.trim() || '朋友')

/** 响应式时间戳：每分钟刷新一次，跨午夜后日期/问候语自动更新（审查 M-37） */
const now = ref(new Date())
let clockTimer: number | undefined
onMounted(() => {
  clockTimer = window.setInterval(() => (now.value = new Date()), 60_000)
})
onUnmounted(() => clearInterval(clockTimer))

const today = computed(() =>
  now.value.toLocaleDateString('zh-CN', { month: 'long', day: 'numeric', weekday: 'long' })
)

const greeting = computed(() => {
  const h = now.value.getHours()
  if (h < 6) return 'dashboard.greetingNight'
  if (h < 12) return 'dashboard.greetingMorning'
  if (h < 14) return 'dashboard.greetingNoon'
  if (h < 18) return 'dashboard.greetingAfternoon'
  return 'dashboard.greetingEvening'
})

/** 今日待办：未完成（每日任务按今天判定、优先展示），最多 6 条 */
const topPending = computed(() => store.pending.slice(0, 6))

/** 统计数据 */
const total = computed(() => store.todos.length)
const done = computed(() => store.doneCount)
const completionRate = computed(() => (total.value ? Math.round((done.value / total.value) * 100) : 0))

/** 今日新增 */
const todayAdded = computed(() => {
  const start = new Date(now.value.getFullYear(), now.value.getMonth(), now.value.getDate()).getTime()
  return store.todos.filter((t) => t.createdAt >= start).length
})

/** 本周每日完成数（周一到周日，按实际完成日期统计，符合中国习惯，审查 L-30） */
const weekBars = computed(() => {
  const base = new Date(now.value.getFullYear(), now.value.getMonth(), now.value.getDate())
  // 距本周一的天数：getDay() 0=周日…6=周六 → (dow + 6) % 7
  const diffToMonday = (base.getDay() + 6) % 7
  const startOfWeek = base.getTime() - diffToMonday * 24 * 60 * 60 * 1000
  const bars: number[] = []
  for (let i = 0; i < 7; i++) {
    const d = new Date(startOfWeek + i * 24 * 60 * 60 * 1000)
    bars.push(store.completedCountOn(dateKey(d)))
  }
  const max = Math.max(1, ...bars)
  return bars.map((count) => ({ count, height: `${Math.round((count / max) * 100)}%` }))
})

/** 本周完成总数 */
const weekDone = computed(() => weekBars.value.reduce((s, b) => s + b.count, 0))

const weekLabels = ['一', '二', '三', '四', '五', '六', '日']

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
          {{ t(greeting) }}，<span class="grad-text">{{ displayName }}</span>
        </h1>
      </div>
      <div class="flex items-center gap-2.5">
        <button @click="addTodo" class="action-btn flex items-center gap-1.5 px-3.5 py-2 text-sm">
          <span class="i-carbon-add text-base" />
          {{ t('dashboard.newWork') }}
        </button>
        <button @click="addProgress" class="btn-primary flex items-center gap-1.5 px-4 py-2 text-sm">
          <span class="i-carbon-edit text-base" />
          {{ t('dashboard.logProgress') }}
        </button>
      </div>
    </div>

    <!-- Hero 主视觉卡片 -->
    <section class="hero-card relative p-7 min-h-[180px] flex flex-col justify-between">
      <div class="relative z-10 max-w-lg">
        <div class="text-xs font-medium text-blue-100/80 mb-2">{{ t('dashboard.heroHint') }}</div>
        <h2 class="text-2xl sm:text-3xl font-bold m-0 leading-snug">
          {{ t('dashboard.heroTitle') }}
        </h2>
        <p class="text-sm text-blue-50/90 mt-2 mb-0 leading-relaxed">
          {{ t('dashboard.heroSub') }}
        </p>
      </div>
      <div class="relative z-10 mt-5">
        <button @click="addProgress" class="btn-secondary flex items-center gap-1.5 px-4 py-2 text-sm">
          <span class="i-carbon-edit text-base" />
          {{ t('dashboard.heroCta') }}
        </button>
      </div>
    </section>

    <!-- 两栏内容 -->
    <div class="grid grid-cols-1 lg:grid-cols-5 gap-5">
      <div class="lg:col-span-3 space-y-5">
      <!-- 左侧：今日待办 -->
      <section class="panel rounded-2xl p-5">
        <div class="flex items-center justify-between mb-4">
          <div class="flex items-center gap-2">
            <span class="text-xs font-bold text-fg-faint tracking-wider">TODAY</span>
            <span class="font-semibold">{{ t('dashboard.todayPush') }}</span>
            <span v-if="total" class="text-xs text-fg-faint">
              {{ t('dashboard.doneOf', { done, total }) }}
            </span>
            <span v-if="store.yesterdayMissed > 0" class="missed-chip text-[11px] px-2 py-0.5 rounded-full">
              {{ t('dashboard.yesterdayMissed', { n: store.yesterdayMissed }) }}
            </span>
          </div>
          <button
            @click="router.push('/todos')"
            class="text-xs text-fg-faint hover:text-brand cursor-pointer bg-transparent border-none flex items-center gap-1"
          >
            {{ t('dashboard.allTodos') }}
            <span class="i-carbon-arrow-right" />
          </button>
        </div>

        <TransitionGroup v-if="topPending.length" name="list" tag="ul" class="space-y-2 p-0 m-0 list-none">
          <li
            v-for="todo in topPending"
            :key="todo.id"
            class="todo-row group flex items-center gap-3 px-3 py-3 rounded-xl"
          >
            <button
              @click="store.toggle(todo.id)"
              role="checkbox"
              :aria-checked="store.isDone(todo) ? 'true' : 'false'"
              :aria-label="t('todos.completeTask', { title: todo.title })"
              class="check w-5 h-5 rounded-full flex items-center justify-center shrink-0 cursor-pointer"
              :class="{ 'check-done': store.isDone(todo) }"
            >
              <span v-if="store.isDone(todo)" class="i-carbon-checkmark text-[13px] leading-none text-white" />
            </button>
            <span class="flex-1 text-sm truncate">{{ todo.title }}</span>
            <span
              class="cat-chip text-[11px] px-2 py-0.5 rounded-full shrink-0"
              :class="todo.category === DAILY_CATEGORY ? 'cat-daily' : ''"
            >
              {{ todo.category }}
            </span>
            <TodoBadges :priority="todo.priority" :tag="todo.tag" />
          </li>
        </TransitionGroup>

        <div v-else class="empty grid place-items-center py-12 rounded-xl text-center">
          <div>
            <span class="i-carbon-checkmark-outline text-3xl text-fg-faint" />
            <p class="text-sm text-fg-faint mt-2 mb-0">
              {{ total ? t('dashboard.emptyDone') : t('dashboard.emptyNone') }}
            </p>
          </div>
        </div>
        </section>
        <!-- 今日日程（v0.3.0 与待办合并） -->
        <section class="panel rounded-2xl p-5">
          <div class="flex items-center justify-between mb-4">
            <span class="font-semibold">{{ t('schedule.today') }}</span>
            <button
              @click="router.push('/todos')"
              class="text-xs text-fg-faint hover:text-brand cursor-pointer bg-transparent border-none flex items-center gap-1"
            >
              {{ t('dashboard.allTodos') }}
              <span class="i-carbon-arrow-right" />
            </button>
          </div>
          <TransitionGroup v-if="store.agenda.today.length" name="list" tag="ul" class="space-y-2 p-0 m-0 list-none">
            <li
              v-for="todo in store.agenda.today"
              :key="todo.id"
              class="todo-row group flex items-center gap-3 px-3 py-3 rounded-xl"
            >
              <button
                @click="store.toggle(todo.id)"
                role="checkbox"
                :aria-checked="store.isDone(todo) ? 'true' : 'false'"
                :aria-label="t('todos.completeTask', { title: todo.title })"
                class="check w-5 h-5 rounded-full flex items-center justify-center shrink-0 cursor-pointer"
                :class="{ 'check-done': store.isDone(todo) }"
              >
                <span v-if="store.isDone(todo)" class="i-carbon-checkmark text-[13px] leading-none text-white" />
              </button>
              <span class="flex-1 text-sm truncate">{{ todo.title }}</span>
              <span class="cat-chip text-[11px] px-2 py-0.5 rounded-full shrink-0">{{ todo.category }}</span>
            </li>
          </TransitionGroup>
          <div v-else class="empty grid place-items-center py-8 rounded-xl text-center">
            <p class="text-sm text-fg-faint mt-0 mb-0">{{ t('schedule.emptyToday') }}</p>
          </div>
        </section>
      </div>

      <!-- 右侧：本周整体进展 -->
      <section class="panel lg:col-span-2 rounded-2xl p-5 flex flex-col">
        <div class="flex items-center justify-between mb-5">
          <span class="font-semibold">{{ t('dashboard.weekProgress') }}</span>
          <span class="text-xs text-fg-faint">{{ t('dashboard.recent7') }}</span>
        </div>

        <div class="grid grid-cols-3 gap-3 mb-5">
          <div class="stat-cell rounded-xl p-3 text-center">
            <div class="text-2xl font-bold text-fg">{{ todayAdded }}</div>
            <div class="text-[11px] text-fg-faint mt-0.5">{{ t('dashboard.todayAdded') }}</div>
          </div>
          <div class="stat-cell rounded-xl p-3 text-center">
            <div class="text-2xl font-bold text-fg">{{ weekDone }}</div>
            <div class="text-[11px] text-fg-faint mt-0.5">{{ t('dashboard.weekDone') }}</div>
          </div>
          <div class="stat-cell rounded-xl p-3 text-center">
            <div class="text-2xl font-bold text-brand-strong">{{ completionRate }}%</div>
            <div class="text-[11px] text-fg-faint mt-0.5">{{ t('dashboard.completionRate') }}</div>
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
                class="bar-fill absolute bottom-0 left-0 right-0 rounded-t-md transition-width duration-500"
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
          { title: 'dashboard.featureNotes', desc: 'dashboard.featureNotesDesc', to: '/notes', icon: 'i-carbon-document', hue: 'card-teal' },
          { title: 'dashboard.featureTodos', desc: 'dashboard.featureTodosDesc', to: '/todos', icon: 'i-carbon-task', hue: 'card-blue' },
          { title: 'dashboard.featureAi', desc: 'dashboard.featureAiDesc', to: '/ai', icon: 'i-carbon-ai-status', hue: 'card-violet' }
        ]"
        :key="c.to"
        @click="router.push(c.to)"
        class="feature-card text-left p-4 rounded-2xl cursor-pointer"
      >
        <span class="icon-chip grid place-items-center w-9 h-9 rounded-lg mb-3" :class="c.hue">
          <span :class="c.icon" class="text-lg" />
        </span>
        <div class="font-semibold text-sm">{{ t(c.title) }}</div>
        <div class="text-xs text-fg-soft mt-0.5">{{ t(c.desc) }}</div>
      </button>
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

/* .check / .check-done 已抽取到全局 theme.css（审查 M-23） */

.empty { border: 1.5px dashed var(--c-border); }

/* 分类芯片 */
.cat-chip {
  background: var(--c-bg);
  color: var(--c-fg-faint);
  border: 1px solid var(--c-border);
  font-weight: 500;
}
.cat-daily {
  background: var(--c-brand-soft);
  color: var(--c-brand-strong);
  border-color: transparent;
}
.dark .cat-daily { color: var(--c-brand); }

/* 昨日遗留提示芯片（琥珀色突出） */
.missed-chip {
  background: #f59e0b1a;
  color: #d97706;
  font-weight: 600;
}
.dark .missed-chip { background: #f59e0b26; color: #fbbf24; }

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

.list-enter-active, .list-leave-active { transition: transform 0.2s ease, opacity 0.2s ease; }
.list-enter-from { opacity: 0; transform: translateY(-6px); }
.list-leave-to { opacity: 0; transform: translateX(10px); }
</style>
