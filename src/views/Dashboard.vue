<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useTodoStore, dateKey } from '@/stores/todos'
import { useSettingsStore } from '@/stores/settings'
import { useFab } from '@/composables/useFab'
import TodoBadges from '@/components/TodoBadges.vue'
import KbdTip from '@/components/KbdTip.vue'
import BaseModal from '@/components/BaseModal.vue'
import type { TodoPriority } from '@/types'
import { DAILY_CATEGORY } from '@/types'

const router = useRouter()
const store = useTodoStore()
const settings = useSettingsStore()
const { t } = useI18n()

/** 新建任务：PC 右上角文字按钮 / 移动端 FAB → 同一个全局弹窗（要求一、三） */
const { setFab, clearFab } = useFab()
const showTaskModal = ref(false)
const draft = ref('')
const draftPriority = ref<TodoPriority>('medium')
const draftTag = ref('')
const draftDue = ref('')
const priorities: { value: TodoPriority; label: string; dot: string }[] = [
  { value: 'high', label: 'todos.priorityHigh', dot: 'bg-red-500' },
  { value: 'medium', label: 'todos.priorityMedium', dot: 'bg-amber-500' },
  { value: 'low', label: 'todos.priorityLow', dot: 'bg-slate-400' }
]

/** 复用待办 store 的新增逻辑，数据链路不变（要求四） */
function createTask() {
  if (!draft.value.trim()) return
  store.add(draft.value, draftPriority.value, draftTag.value, DAILY_CATEGORY, draftDue.value || undefined)
  draft.value = ''
  draftTag.value = ''
  draftDue.value = ''
  showTaskModal.value = false
}

onMounted(() => setFab(() => (showTaskModal.value = true), t('dashboard.newTask')))
onUnmounted(() => clearFab())
/** 显示名：设置里可自定义，默认「朋友」 */
const displayName = computed(() => settings.userName.trim() || '朋友')

/** 响应式时间戳：每分钟刷新一次，跨午夜后日期/问候语自动更新（审查 M-37） */
const now = ref(new Date())
let clockTimer: number | undefined
onMounted(() => {
  clockTimer = window.setInterval(() => (now.value = new Date()), 60_000)
})
onUnmounted(() => clearInterval(clockTimer))

/** 顶栏实时时钟（秒级），与统计用的 now（分钟级）分离，避免每秒重算柱状图 */
const clock = ref(new Date())
let secTimer: number | undefined
const clockTime = computed(() =>
  clock.value.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
)
onMounted(() => {
  secTimer = window.setInterval(() => (clock.value = new Date()), 1_000)
})
onUnmounted(() => clearInterval(secTimer))

const today = computed(() =>
  now.value.toLocaleDateString('zh-CN', { month: 'long', day: 'numeric', weekday: 'long' })
)

/** 问候语按时段切换：06-12 上午好 / 12-18 下午好 / 18-23 晚上好 / 23-06 夜深了 */
const greeting = computed(() => {
  const h = now.value.getHours()
  if (h >= 6 && h < 12) return 'dashboard.greetingMorning'
  if (h >= 12 && h < 18) return 'dashboard.greetingAfternoon'
  if (h >= 18 && h < 23) return 'dashboard.greetingEvening'
  return 'dashboard.greetingNight'
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

/** 本周每日完成 / 逾期数（周一到周日，按实际完成日期统计，符合中国习惯，审查 L-30）
 *  逾期：当天截止、截至「昨天」仍未完成的非每日任务；今日与未来不计逾期 */
const weekBars = computed(() => {
  const base = new Date(now.value.getFullYear(), now.value.getMonth(), now.value.getDate())
  // 距本周一的天数：getDay() 0=周日…6=周六 → (dow + 6) % 7
  const diffToMonday = (base.getDay() + 6) % 7
  const startOfWeek = base.getTime() - diffToMonday * 24 * 60 * 60 * 1000
  const todayK = dateKey(now.value)
  const raw: { done: number; overdue: number }[] = []
  for (let i = 0; i < 7; i++) {
    const d = new Date(startOfWeek + i * 24 * 60 * 60 * 1000)
    const k = dateKey(d)
    const done = store.completedCountOn(k)
    const overdue =
      k < todayK
        ? store.todos.filter((t) => t.category !== DAILY_CATEGORY && !t.done && t.dueDate === k).length
        : 0
    raw.push({ done, overdue })
  }
  const max = Math.max(1, ...raw.map((b) => b.done + b.overdue))
  return raw.map((b) => ({
    done: b.done,
    overdue: b.overdue,
    donePct: Math.round((b.done / max) * 100),
    overduePct: Math.round((b.overdue / max) * 100)
  }))
})

/** 本周完成总数（仅已完成，不含逾期） */
const weekDone = computed(() => weekBars.value.reduce((s, b) => s + b.done, 0))

const weekLabels = ['一', '二', '三', '四', '五', '六', '日']

/** 底部快捷入口：AI 助手弱化置右，可在设置中隐藏 */
const quickCards = computed(() => {
  const base = [
    { title: 'dashboard.featureNotes', desc: 'dashboard.featureNotesDesc', to: '/notes', icon: 'i-carbon-document', hue: 'card-teal' },
    { title: 'dashboard.featureTodos', desc: 'dashboard.featureTodosDesc', to: '/todos', icon: 'i-carbon-task', hue: 'card-teal-soft' }
  ]
  if (settings.showAiEntry) {
    base.push({ title: 'dashboard.featureAi', desc: 'dashboard.featureAiDesc', to: '/ai', icon: 'i-carbon-ai-status', hue: 'card-teal-dim' })
  }
  return base
})

function addProgress() {
  // 未来可打开"记一笔进展"弹窗；现在跳到待办页
  router.push('/todos')
}

/** 横幅卡片可关闭（部分用户希望仪表盘更简洁）；状态持久化到设置 store，刷新不复位 */
const heroHidden = computed(() => settings.dashboardHeroHidden)
function dismissHero() {
  settings.dashboardHeroHidden = true
}
</script>

<template>
  <div class="dashboard space-y-6 max-w-5xl">
    <!-- 顶部标题栏 -->
    <div class="flex items-end justify-between">
      <div>
        <div class="flex items-center gap-2 text-xs font-medium text-fg-faint tracking-wide mb-1">
          <span class="i-carbon-time" />
          <span>{{ today }}</span>
          <span class="clock-time tabular-nums">{{ clockTime }}</span>
        </div>
        <h1 class="text-2xl font-bold m-0 tracking-tight">
          {{ t(greeting) }}，<span class="grad-text">{{ displayName }}</span>
        </h1>
      </div>
      <!-- PC 端右上角操作区（要求一.1）；移动端隐藏，改由右下角 FAB 唤起同一弹窗 -->
      <div class="hidden lg:flex items-center gap-2.5">
        <KbdTip :keys="'Ctrl N'" :label="t('kbd.newTask')">
          <button @click="showTaskModal = true" class="btn-primary flex items-center gap-1.5 px-4 py-2 text-sm rounded-btn">
            <span class="i-carbon-add text-base" />
            {{ t('dashboard.newTask') }}
          </button>
        </KbdTip>
        <button @click="addProgress" class="action-btn flex items-center gap-1.5 px-4 py-2 text-sm rounded-btn">
          <span class="i-carbon-edit text-base" />
          {{ t('dashboard.logProgress') }}
        </button>
      </div>
    </div>

    <!-- Hero 主视觉卡片（可关闭，状态持久化到 localStorage） -->
    <section v-if="!heroHidden" class="hero-card relative p-7 min-h-[180px] flex flex-col justify-between">
      <button
        @click="dismissHero"
        :aria-label="t('dashboard.heroDismiss')"
        :title="t('dashboard.heroDismiss')"
        class="hero-close absolute top-3 right-3 z-20 grid place-items-center w-7 h-7 rounded-full text-white/50 hover:text-white cursor-pointer"
      >
        <span class="i-carbon-close text-sm" />
      </button>
      <div class="relative z-10 max-w-lg">
        <div class="text-[11px] font-medium text-white/70 mb-2">{{ t('dashboard.heroHint') }}</div>
        <h2 class="text-2xl sm:text-3xl font-bold m-0 leading-snug">
          {{ t('dashboard.heroTitle') }}
        </h2>
        <p class="text-sm text-white/85 mt-2 mb-0 leading-relaxed">
          {{ t('dashboard.heroSub') }}
        </p>
      </div>
      <div class="relative z-10 mt-5">
        <button @click="addProgress" class="hero-cta flex items-center gap-1.5 px-5 py-2.5 text-sm rounded-btn">
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
          <!-- 新建入口统一收敛到页面右上角（PC）/ 右下角 FAB（移动端），此处只保留跳转链接（要求一.1） -->
          <div class="flex items-center gap-2.5">
            <button
              @click="router.push('/todos')"
              class="text-xs text-fg-soft hover:text-brand cursor-pointer bg-transparent border-none flex items-center gap-1"
            >
              {{ t('dashboard.allTodos') }}
              <span class="i-carbon-arrow-right" />
            </button>
          </div>
        </div>

        <TransitionGroup v-if="topPending.length" name="list" tag="ul" class="space-y-2 p-0 m-0 list-none">
          <li
            v-for="todo in topPending"
            :key="todo.id"
            class="todo-row group flex items-center gap-3 px-3 py-3 rounded-btn"
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
              class="cat-chip text-[10px] px-1.5 py-0.5 rounded-full shrink-0"
              :class="todo.category === DAILY_CATEGORY ? 'cat-daily' : ''"
            >
              {{ todo.category }}
            </span>
            <TodoBadges :priority="todo.priority" :tag="todo.tag" />
          </li>
        </TransitionGroup>

        <div v-else class="empty grid place-items-center py-12 rounded-btn text-center">
          <div class="flex flex-col items-center max-w-md">
            <span class="i-carbon-checkmark-outline text-3xl text-fg-faint opacity-50" />
            <template v-if="total">
              <p class="text-base font-semibold text-fg mt-3 mb-0">{{ t('dashboard.emptyDoneTitle') }}</p>
              <p class="text-sm text-fg-soft mt-1.5 mb-0 px-4 leading-relaxed">{{ t('dashboard.emptyDoneHint') }}</p>
              <div class="flex items-center gap-2.5 mt-4">
                <button
                  @click="router.push('/notes')"
                  class="action-btn flex items-center gap-1.5 px-3.5 py-2 text-sm rounded-btn"
                >
                  <span class="i-carbon-bookmark text-base" />
                  {{ t('dashboard.recTodayGain') }}
                </button>
                <button
                  @click="router.push('/todos')"
                  class="btn-primary flex items-center gap-1.5 px-3.5 py-2 text-sm rounded-btn"
                >
                  <span class="i-carbon-task text-base" />
                  {{ t('dashboard.planTomorrow') }}
                </button>
              </div>
            </template>
            <template v-else>
              <p class="text-sm text-fg-faint mt-2 mb-0">{{ t('dashboard.emptyNone') }}</p>
              <!-- 空状态文案保留不动，仅把入口改为唤起同一弹窗（要求四） -->
              <button
                @click="showTaskModal = true"
                class="btn-primary flex items-center gap-1.5 px-4 py-2 text-sm mt-4 rounded-btn"
              >
                <span class="i-carbon-add text-base" />
                {{ t('dashboard.newTask') }}
              </button>
            </template>
          </div>
        </div>
        </section>
        <!-- 今日日程（v0.3.0 与待办合并） -->
        <section class="panel rounded-2xl p-5">
          <div class="flex items-center justify-between mb-4">
            <span class="font-semibold">{{ t('schedule.today') }}</span>
            <button
              @click="router.push('/todos')"
              class="text-xs text-fg-soft hover:text-brand cursor-pointer bg-transparent border-none flex items-center gap-1"
            >
              {{ t('dashboard.allTodos') }}
              <span class="i-carbon-arrow-right" />
            </button>
          </div>
          <TransitionGroup v-if="store.agenda.today.length" name="list" tag="ul" class="space-y-2 p-0 m-0 list-none">
            <li
              v-for="todo in store.agenda.today"
              :key="todo.id"
              class="todo-row group flex items-center gap-3 px-3 py-3 rounded-btn"
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
              <span class="cat-chip text-[10px] px-1.5 py-0.5 rounded-full shrink-0">{{ todo.category }}</span>
            </li>
          </TransitionGroup>
          <div v-else class="empty grid place-items-center py-8 rounded-btn text-center">
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
          <div class="stat-cell rounded-btn p-3 text-center flex flex-col items-center justify-center min-h-[88px]">
            <div class="text-3xl font-bold text-fg leading-none">{{ todayAdded }}</div>
            <div class="text-[10px] text-fg-faint mt-2">{{ t('dashboard.todayAdded') }}</div>
          </div>
          <div class="stat-cell rounded-btn p-3 text-center flex flex-col items-center justify-center min-h-[88px]">
            <div class="text-3xl font-bold text-fg leading-none">{{ weekDone }}</div>
            <div class="text-[10px] text-fg-faint mt-2">{{ t('dashboard.weekDone') }}</div>
          </div>
          <div class="stat-cell rounded-btn p-3 text-center flex flex-col items-center justify-center min-h-[88px]">
            <div class="text-3xl font-bold text-brand-strong leading-none">{{ completionRate }}%</div>
            <div class="text-[10px] text-fg-faint mt-2">{{ t('dashboard.completionRate') }}</div>
          </div>
        </div>

        <div class="flex-1 flex items-end justify-between gap-1 px-1 pt-2">
          <div
            v-for="(bar, idx) in weekBars"
            :key="idx"
            class="bar-col flex flex-col items-center gap-1.5 flex-1"
            :title="weekLabels[idx] + '：' + bar.done + ' 项完成'"
          >
            <div class="bar-track w-full rounded-t-md relative" style="height: 84px;">
              <!-- 逾期（浅橙，垫底） -->
              <div
                v-if="bar.overdue > 0"
                class="bar-fill-overdue absolute bottom-0 left-0 right-0 rounded-t-sm transition-[height] duration-500"
                :style="{ height: bar.overduePct + '%' }"
              />
              <!-- 已完成（青绿，叠在其上） -->
              <div
                v-if="bar.done > 0"
                class="bar-fill absolute left-0 right-0 rounded-t-sm transition-[height,bottom] duration-500"
                :style="{ bottom: bar.overduePct + '%', height: bar.donePct + '%' }"
              />
              <!-- 空日期：极浅灰占位柱 -->
              <div
                v-if="bar.done === 0 && bar.overdue === 0"
                class="bar-empty-fill absolute bottom-0 left-0 right-0 rounded-t-sm"
              />
            </div>
            <span class="text-[9px] text-fg-faint mt-1">{{ weekLabels[idx] }}</span>
          </div>
        </div>
      </section>
    </div>

    <!-- 快捷入口（图标底色统一品牌青不同透明度；AI 弱化置右，可设置隐藏） -->
    <div class="grid grid-cols-1 gap-4" :class="quickCards.length === 2 ? 'sm:grid-cols-2' : 'sm:grid-cols-3'">
      <button
        v-for="c in quickCards"
        :key="c.to"
        @click="router.push(c.to)"
        class="feature-card text-left p-4 rounded-2xl cursor-pointer"
      >
        <span class="icon-chip grid place-items-center w-9 h-9 rounded-btn mb-3" :class="c.hue">
          <span :class="c.icon" class="text-lg" />
        </span>
        <div class="font-semibold text-sm">{{ t(c.title) }}</div>
        <div class="text-xs text-fg-soft mt-0.5">{{ t(c.desc) }}</div>
      </button>
    </div>

    <!-- 新建任务弹窗（要求三）：PC 右上角按钮 / 移动端 FAB 共用 -->
    <BaseModal v-model="showTaskModal" :title="t('dashboard.newTask')" @save="createTask">
      <div class="space-y-4">
        <input
          v-model="draft"
          @keyup.enter="createTask"
          :placeholder="t('todos.addDailyPlaceholder')"
          class="input-modern w-full px-4 py-2.5 text-sm"
        />
        <div class="flex items-center gap-4 flex-wrap">
          <div class="flex items-center gap-1.5" role="radiogroup" :aria-label="t('todos.priorityAria')">
            <span class="text-xs text-fg-faint">{{ t('todos.priorityLabel') }}</span>
            <button
              v-for="p in priorities"
              :key="p.value"
              @click="draftPriority = p.value"
              role="radio"
              :aria-checked="draftPriority === p.value ? 'true' : 'false'"
              class="pri-btn flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs cursor-pointer"
              :class="draftPriority === p.value ? 'pri-active' : ''"
            >
              <span class="w-1.5 h-1.5 rounded-full inline-block" :class="p.dot" />
              {{ t(p.label) }}
            </button>
          </div>
          <div class="flex items-center gap-1.5 flex-1 min-w-40">
            <span class="i-carbon-tag text-fg-faint text-sm shrink-0" />
            <input
              v-model="draftTag"
              @keyup.enter="createTask"
              list="dash-used-tags"
              :placeholder="t('todos.tagPlaceholder')"
              class="flex-1 text-xs bg-transparent border-none outline-none text-fg placeholder:text-fg-faint py-1"
            />
            <datalist id="dash-used-tags">
              <option v-for="tag in store.usedTags" :key="tag" :value="tag" />
            </datalist>
          </div>
          <label class="flex items-center gap-1.5 shrink-0">
            <span class="i-carbon-event text-fg-faint text-sm shrink-0" />
            <input
              v-model="draftDue"
              type="date"
              class="text-xs bg-transparent border border-border rounded-lg px-2 py-1 outline-none text-fg"
            />
          </label>
        </div>
      </div>
    </BaseModal>
  </div>
</template>

<style scoped>
.grad-text {
  background: var(--c-brand-grad);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
}

/* 横幅关闭按钮：扁平无阴影，hover 淡白圆底 + 加深图标（与全局扁平按钮风格一致） */
.hero-close {
  background: transparent;
  border: none;
  transition: background-color 0.15s ease, color 0.15s ease;
}
.hero-close:hover {
  background: rgba(255, 255, 255, 0.16);
  color: #fff;
}
.hero-close:active {
  background: rgba(255, 255, 255, 0.24);
}

/* 横幅主 CTA：白色实底 + 深青文字，深色横幅上醒目（原 .btn-secondary 描边字太淡） */
.hero-cta {
  background: #fff;
  color: var(--c-brand-strong);
  border: none;
  font-weight: 600;
  cursor: pointer;
  box-shadow: none;
  transition: opacity 0.15s ease, transform 0.15s ease;
}
.hero-cta:hover {
  opacity: 0.92;
  transform: translateY(-1px);
}
.hero-cta:active {
  opacity: 0.85;
  transform: translateY(0);
}

/* 顶栏实时时钟：弱化透明度，不与问候语抢视觉 */
.clock-time {
  color: var(--c-fg-faint);
  opacity: 0.7;
  font-weight: 500;
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
.action-btn:active {
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

/* 空白态：浅灰实线 + 轻阴影 + hover 轻微上浮（规范：不用的虚线边框） */
.empty {
  border: 1px solid var(--c-border);
  background: var(--c-surface);
  box-shadow: var(--shadow-sm);
  transition: box-shadow 0.15s ease, transform 0.15s ease, border-color 0.15s ease;
}
.empty:hover {
  box-shadow: var(--shadow-md);
  transform: translateY(-2px);
  border-color: var(--c-brand);
}

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

/* 昨日遗留提示芯片（浅橙底、降饱和柔和不刺眼，规范：警告=橙黄） */
.missed-chip {
  background: rgba(245, 158, 11, 0.10);
  color: #b45309;
  font-weight: 600;
}
.dark .missed-chip { background: rgba(245, 158, 11, 0.16); color: #fbbf24; }

.stat-cell {
  background: var(--c-bg);
  border: 1px solid var(--c-border);
}

/* 新建任务弹窗内的优先级选择（与待办页同款扁平样式，全部走主题变量） */
.pri-btn {
  background: var(--c-bg);
  border: 1px solid var(--c-border);
  color: var(--c-fg-soft);
  transition: color 0.15s ease, border-color 0.15s ease, background-color 0.15s ease;
}
.pri-btn:hover { color: var(--c-fg); }
.pri-active {
  border-color: var(--c-brand);
  background: var(--c-brand-soft);
  color: var(--c-brand-strong);
  font-weight: 600;
}
.dark .pri-active { color: var(--c-brand); }

.bar-track { background: var(--c-bg); }
.bar-fill { background: var(--c-brand-grad); }
.bar-fill-overdue { background: var(--c-warning); }
/* 空日期：极浅灰占位柱 */
.bar-empty-fill { height: 6px; background: rgba(120, 120, 120, 0.18); }
.dark .bar-empty-fill { background: rgba(255, 255, 255, 0.10); }

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

/* 快捷入口图标底色：统一品牌青不同透明度（禁用蓝 / 紫） */
.icon-chip { border-radius: var(--radius); }
.card-teal { background: var(--c-brand-grad); color: #fff; }
.card-teal-soft { background: rgba(38, 166, 154, 0.28); color: var(--c-brand-strong); }
.card-teal-dim { background: rgba(38, 166, 154, 0.12); color: var(--c-fg-faint); }
.dark .card-teal-soft { color: #7fd8ce; }

.list-enter-active, .list-leave-active { transition: transform 0.2s ease, opacity 0.2s ease; }
.list-enter-from { opacity: 0; transform: translateY(-6px); }
.list-leave-to { opacity: 0; transform: translateX(10px); }
</style>
