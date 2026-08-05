<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useTodoStore, PRESET_CATEGORIES, dateKey } from '@/stores/todos'
import { useConfirm } from '@/composables/useConfirm'
import { useFab } from '@/composables/useFab'
import TodoBadges from '@/components/TodoBadges.vue'
import BaseModal from '@/components/BaseModal.vue'
import EmptyState from '@/components/EmptyState.vue'
import type { TodoPriority, TodoRecord } from '@/types'
import { DAILY_CATEGORY } from '@/types'

const store = useTodoStore()
const { t } = useI18n()
const { confirm } = useConfirm()
// 全局悬浮新建按钮（移动端 FAB）/ 弹窗可见态（要求一）
const { setFab, clearFab } = useFab()
const showModal = ref(false)
const draftInput = ref<HTMLInputElement>()

/** 当前分类：默认「每日」 */
const activeCat = ref(DAILY_CATEGORY)

const draft = ref('')
const draftPriority = ref<TodoPriority>('medium')
const draftTag = ref('')
const draftDue = ref('')

/** 自定义分类 */
const addingCat = ref(false)
const newCatName = ref('')
const catError = ref('')

const priorities: { value: TodoPriority; label: string; dot: string }[] = [
  { value: 'high', label: 'todos.priorityHigh', dot: 'bg-red-500' },
  { value: 'medium', label: 'todos.priorityMedium', dot: 'bg-amber-500' },
  { value: 'low', label: 'todos.priorityLow', dot: 'bg-slate-400' }
]

const catIcons: Record<string, string> = {
  每日: 'i-carbon-renew',
  生活: 'i-carbon-home',
  工作: 'i-carbon-portfolio',
  学习: 'i-carbon-book',
  游戏: 'i-carbon-game-console'
}
function catIcon(cat: string) {
  return catIcons[cat] ?? 'i-carbon-folder'
}

const list = computed(() => store.byCategory(activeCat.value))
const progress = computed(() => store.categoryProgress(activeCat.value))
const isDaily = computed(() => activeCat.value === DAILY_CATEGORY)

function add() {
  if (!draft.value.trim()) return
  store.add(draft.value, draftPriority.value, draftTag.value, activeCat.value, draftDue.value || undefined)
  draft.value = ''
  draftTag.value = ''
  draftDue.value = ''
  showModal.value = false
}

/** 截止日短标签 MM-DD（空值兜底，避免非空断言在异常数据下崩溃，审查 L-3） */
function dueLabel(d?: string): string {
  return d ? d.slice(5) : ''
}
/** 是否逾期（未完成、非每日、截止日早于今天） */
function isOverdue(t: TodoRecord): boolean {
  return !!t.dueDate && t.dueDate < dateKey() && !store.isDone(t) && t.category !== DAILY_CATEGORY
}

function confirmAddCat() {
  const n = newCatName.value.trim()
  if (!n) {
    addingCat.value = false
    return
  }
  if (store.addCategory(n)) {
    activeCat.value = n
    newCatName.value = ''
    addingCat.value = false
    catError.value = ''
  } else {
    catError.value = store.categories.includes(n) ? t('todos.catExists') : t('todos.catNameHint')
  }
}

async function delCategory(cat: string) {
  const ok = await confirm({
    title: t('todos.deleteCategoryTitle'),
    message: t('todos.deleteCategoryMsg', { cat }),
    confirmText: t('todos.deleteCategory'),
    danger: true
  })
  if (!ok) return
  store.removeCategory(cat)
  if (activeCat.value === cat) activeCat.value = DAILY_CATEGORY
}

function isPreset(cat: string) {
  return PRESET_CATEGORIES.includes(cat)
}

// 移动端 FAB 唤起与 PC 一致的弹窗（要求一.2）
onMounted(() => {
  setFab(() => (showModal.value = true), t('todos.addSchedule'))
})
onUnmounted(() => clearFab())
</script>

<template>
  <div class="space-y-5 max-w-2xl">
      <div class="flex items-baseline justify-between gap-3">
      <h2 class="text-xl font-bold m-0">{{ t('todos.title') }}</h2>
      <div class="flex items-center gap-3 shrink-0">
        <span v-if="progress.total" class="text-sm text-fg-faint" aria-live="polite">
          {{ t('todos.doneOf', { done: progress.done, total: progress.total }) }}
        </span>
        <!-- PC 端右上角文字新增按钮（要求一.1）；移动端由 FAB 唤起同一弹窗 -->
        <button class="btn-primary hidden lg:inline-flex items-center gap-1 px-3 py-1.5 text-sm rounded-btn" @click="showModal = true">
          <span class="i-carbon-add text-base" />{{ t('todos.addSchedule') }}
        </button>
      </div>
    </div>

    <!-- 日程安排（与待办合并，v0.3.0） -->
    <section class="agenda-card rounded-2xl p-5 space-y-4">
      <div class="font-semibold text-sm">{{ t('schedule.agenda') }}</div>
      <template v-if="store.agenda.overdue.length || store.agenda.today.length || store.agenda.upcoming.length">
        <div
          v-for="grp in ([
            { key: 'overdue', items: store.agenda.overdue, label: t('schedule.overdue'), cls: 'text-red-500' },
            { key: 'today', items: store.agenda.today, label: t('schedule.today'), cls: 'text-amber-500' },
            { key: 'upcoming', items: store.agenda.upcoming, label: t('schedule.upcoming'), cls: 'text-fg-soft' }
          ] as const)"
          :key="grp.key"
        >
          <div v-if="grp.items.length" class="space-y-2">
            <div class="text-xs font-medium" :class="grp.cls">{{ grp.label }} · {{ grp.items.length }}</div>
            <ul class="space-y-1.5">
              <li v-for="todo in grp.items" :key="todo.id" class="flex items-center gap-3 px-3 py-2 rounded-xl bg-bg">
                <button
                  @click="store.toggle(todo.id)"
                  role="checkbox"
                  :aria-checked="store.isDone(todo) ? 'true' : 'false'"
                  :aria-label="t('todos.completeTask', { title: todo.title })"
                  class="check w-5 h-5 rounded-full flex items-center justify-center shrink-0 cursor-pointer"
                  :class="store.isDone(todo) ? 'check-done' : ''"
                >
                  <span v-if="store.isDone(todo)" class="i-carbon-checkmark text-[13px] leading-none text-white" />
                </button>
                <span class="flex-1 text-sm truncate" :class="store.isDone(todo) ? 'line-through text-fg-faint' : ''">{{ todo.title }}</span>
                <span class="text-[11px] text-fg-faint shrink-0">{{ dueLabel(todo.dueDate) }}</span>
                <span class="cat-chip text-[11px] px-1.5 py-0.5 rounded-full shrink-0">{{ todo.category }}</span>
              </li>
            </ul>
          </div>
        </div>
      </template>
      <p v-else class="text-sm text-fg-faint m-0">{{ t('schedule.empty') }}</p>
    </section>

    <!-- 分类 Tab -->
    <div class="flex items-center gap-2 flex-wrap">
      <button
        v-for="cat in store.categories"
        :key="cat"
        @click="activeCat = cat"
        class="cat-tab group/tab flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm cursor-pointer"
        :class="activeCat === cat ? 'cat-active' : ''"
      >
        <span :class="catIcon(cat)" class="text-base" />
        {{ cat }}
        <span class="cat-count text-[11px] px-1.5 py-0.5 rounded-full leading-none">
          {{ store.categoryProgress(cat).total - store.categoryProgress(cat).done }}
        </span>
        <!-- 自定义分类可删除 -->
        <span
          v-if="!isPreset(cat)"
          @click.stop="delCategory(cat)"
          @keydown.enter.stop.prevent="delCategory(cat)"
          role="button"
          tabindex="0"
          class="i-carbon-close text-xs opacity-0 group-hover/tab:opacity-60 hover:!opacity-100"
          :title="t('todos.deleteCategory')"
          :aria-label="t('todos.deleteCategory')"
        />
      </button>

      <!-- 自定义分类按钮 -->
      <div v-if="addingCat" class="flex items-center gap-1.5">
        <input
          v-model="newCatName"
          @keyup.enter="confirmAddCat"
          @keyup.esc="addingCat = false; catError = ''"
          v-focus
          maxlength="8"
          :placeholder="t('todos.catNamePlaceholder')"
          class="input-modern w-28 px-3 py-1.5 text-sm"
        />
        <button @click="confirmAddCat" class="btn-primary px-3 py-1.5 text-xs">{{ t('todos.confirm') }}</button>
        <span v-if="catError" class="text-xs text-red-500">{{ catError }}</span>
      </div>
      <button
        v-else
        @click="addingCat = true"
        class="cat-tab cat-add flex items-center gap-1 px-3.5 py-2 rounded-xl text-sm cursor-pointer"
      >
        <span class="i-carbon-add text-base" />
        {{ t('todos.custom') }}
      </button>
    </div>

    <!-- 每日任务：昨日遗留 + 今日进度 -->
    <div v-if="isDaily" class="space-y-3">
      <div
        v-if="store.yesterdayMissed > 0"
        class="missed-banner flex items-center gap-2.5 px-4 py-3 rounded-xl text-sm"
      >
        <span class="i-carbon-warning-alt text-lg shrink-0" />
        <span>{{ t('todos.missedBanner', { n: store.yesterdayMissed }) }}</span>
      </div>
      <div v-else-if="progress.total" class="clear-banner flex items-center gap-2.5 px-4 py-3 rounded-xl text-sm">
        <span class="i-carbon-checkmark-outline text-lg shrink-0" />
        <span>{{ t('todos.clearBanner') }}</span>
      </div>

      <!-- 今日进度条 -->
      <div v-if="progress.total" class="progress-card rounded-xl px-4 py-3">
        <div class="flex items-center justify-between text-xs mb-2">
          <span class="text-fg-soft font-medium">{{ t('todos.todayProgress') }}</span>
          <span class="text-fg-faint">{{ progress.done }}/{{ progress.total }} · {{ progress.rate }}%</span>
        </div>
        <div class="track h-2.5 rounded-full overflow-hidden">
          <div
            class="fill h-full rounded-full transition-width duration-500"
            :class="progress.rate === 100 ? 'fill-complete' : ''"
            :style="{ width: progress.rate + '%' }"
          />
        </div>
      </div>
    </div>

    <!-- 非每日分类：简洁进度条 -->
    <div v-else-if="progress.total" class="progress-card rounded-xl px-4 py-3">
      <div class="flex items-center justify-between text-xs mb-2">
        <span class="text-fg-soft font-medium">{{ t('todos.catProgress', { cat: activeCat }) }}</span>
        <span class="text-fg-faint">{{ progress.done }}/{{ progress.total }} · {{ progress.rate }}%</span>
      </div>
      <div class="track h-2.5 rounded-full overflow-hidden">
        <div
          class="fill h-full rounded-full transition-width duration-500"
          :class="progress.rate === 100 ? 'fill-complete' : ''"
          :style="{ width: progress.rate + '%' }"
        />
      </div>
    </div>

    <!-- 新建表单：移入全局弹窗（要求三）；PC 右上角按钮 / 移动端 FAB 唤起 -->
    <BaseModal v-model="showModal" :title="t('todos.addSchedule')" @save="add">
      <div class="space-y-4">
        <input
          ref="draftInput"
          v-model="draft"
          @keyup.enter="add"
          :placeholder="isDaily ? t('todos.addDailyPlaceholder') : t('todos.addCatPlaceholder', { cat: activeCat })"
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
              @keyup.enter="add"
              list="used-tags"
              :placeholder="t('todos.tagPlaceholder')"
              class="flex-1 text-xs bg-transparent border-none outline-none text-fg placeholder:text-fg-faint py-1"
            />
            <datalist id="used-tags">
              <option v-for="t in store.usedTags" :key="t" :value="t" />
            </datalist>
          </div>
          <label class="flex items-center gap-1.5 shrink-0">
            <span class="i-carbon-event text-fg-faint text-sm shrink-0" />
            <input
              v-model="draftDue"
              type="date"
              :placeholder="t('schedule.dueDate')"
              class="text-xs bg-transparent border border-border rounded-lg px-2 py-1 outline-none text-fg"
            />
          </label>
        </div>
      </div>
    </BaseModal>

    <!-- 回车新建提示 -->
    <p class="text-[11px] text-fg-faint px-1 -mt-1">{{ t('todos.enterHint') }}</p>

    <!-- 列表 -->
    <TransitionGroup name="list" tag="ul" class="space-y-2 p-0 m-0 list-none">
      <li
        v-for="todo in list"
        :key="todo.id"
        class="todo-item group flex items-center gap-3 px-4 py-3 rounded-xl"
      >
        <button
          @click="store.toggle(todo.id)"
          role="checkbox"
          :aria-checked="store.isDone(todo) ? 'true' : 'false'"
          :aria-label="t('todos.completeTask', { title: todo.title })"
          class="check w-5 h-5 rounded-full flex items-center justify-center shrink-0 cursor-pointer"
          :class="store.isDone(todo) ? 'check-done' : ''"
        >
          <span v-if="store.isDone(todo)" class="i-carbon-checkmark text-[13px] leading-none text-white" />
        </button>
        <span class="flex-1 text-sm transition-colors"           :class="store.isDone(todo) ? 'line-through text-fg-faint' : ''">
          {{ todo.title }}
        </span>
        <!-- 每日任务连续打卡 -->
        <span v-if="isDaily && (store.streaks[todo.id] ?? 0) > 1" class="streak flex items-center gap-0.5 text-[11px] shrink-0">
          <span class="i-carbon-fire text-[11px]" />
          {{ t('todos.streakDays', { n: store.streaks[todo.id] }) }}
        </span>
        <TodoBadges :priority="todo.priority" :tag="todo.tag" />
        <span
          v-if="todo.dueDate"
          class="text-[11px] px-1.5 py-0.5 rounded-full shrink-0 flex items-center gap-0.5"
          :class="isOverdue(todo) ? 'due-overdue' : 'due-normal'"
        >
          <span class="i-carbon-event text-[11px]" />
          {{ dueLabel(todo.dueDate) }}
        </span>
        <button
          @click="store.remove(todo.id)"
          class="del opacity-0 group-hover:opacity-100 text-fg-faint hover:text-red-500 cursor-pointer bg-transparent border-none p-1"
          :aria-label="t('todos.deleteTask')"
        >
          <span class="i-carbon-trash-can text-base" />
        </button>
      </li>
    </TransitionGroup>

    <!-- 空状态 -->
    <EmptyState
      v-if="list.length === 0"
      :icon="catIcon(activeCat)"
      :title="isDaily ? t('todos.emptyDaily') : t('todos.emptyCat', { cat: activeCat })"
    />

    <p v-if="isDaily" class="text-[11px] text-fg-faint">
      <span class="i-carbon-information align-text-bottom" />
      {{ t('todos.dailyHint') }}
    </p>
  </div>
</template>

<script lang="ts">
/** 自动聚焦指令 */
export default {
  directives: {
    focus: {
      mounted: (el: HTMLElement) => el.focus()
    }
  }
}
</script>

<style scoped>
/* 分类 Tab */
.cat-tab {
  background: var(--c-surface);
  border: 1px solid var(--c-border);
  color: var(--c-fg-soft);
  font-weight: 500;
  transition: border-color 0.15s ease, color 0.15s ease, background-color 0.15s ease;
}
.cat-tab:hover {
  border-color: var(--c-brand);
  color: var(--c-fg);
}
.cat-active {
  border-color: var(--c-brand);
  background: var(--c-brand-soft);
  color: var(--c-brand-strong);
  font-weight: 600;
  box-shadow: inset 0 0 0 1px var(--c-brand);
}
.dark .cat-active { color: var(--c-brand); }
.cat-count {
  background: var(--c-bg);
  color: var(--c-fg-faint);
}
.cat-active .cat-count {
  background: var(--c-brand);
  color: #fff;
}
.cat-add { border-style: dashed; }

/* 昨日遗留横幅（琥珀色突出） */
.missed-banner {
  background: #f59e0b14;
  border: 1px solid #f59e0b4d;
  color: #b45309;
}
.dark .missed-banner {
  background: #f59e0b1f;
  border-color: #f59e0b40;
  color: #fbbf24;
}
.missed-num {
  font-size: 16px;
  color: #d97706;
}
.dark .missed-num { color: #fbbf24; }

.clear-banner {
  background: rgba(16, 185, 129, 0.05);
  border: 1px solid rgba(16, 185, 129, 0.20);
  color: #4a9e7c;
}
.dark .clear-banner {
  background: rgba(16, 185, 129, 0.10);
  border-color: rgba(16, 185, 129, 0.26);
  color: #6bd1a8;
}

/* 进度条 */
.progress-card {
  background: var(--c-surface);
  border: 1px solid var(--c-border);
}
.track { background: var(--c-bg); }
.fill { background: var(--c-brand-grad); }
.fill-complete { background: linear-gradient(90deg, #10b981, #34d399); }

/* 打卡徽章 */
.streak {
  color: #f97316;
  background: #f973161a;
  padding: 3px 7px;
  border-radius: 999px;
  font-weight: 600;
}
.dark .streak { color: #fb923c; background: #fb923c1f; }

.composer {
  background: var(--c-surface);
  border: 1px solid var(--c-border);
}

.pri-btn {
  background: var(--c-surface);
  border: 1px solid var(--c-border);
  color: var(--c-fg-soft);
  cursor: pointer;
  transition: color 0.15s ease, border-color 0.15s ease, background-color 0.15s ease;
}
.pri-btn:hover {
  color: var(--c-fg);
  border-color: var(--c-brand);
}
.pri-active {
  border-color: var(--c-brand);
  background: var(--c-brand-soft);
  color: var(--c-brand-strong);
  font-weight: 600;
}
.dark .pri-active { color: var(--c-brand); }

.todo-item {
  background: var(--c-surface);
  border: 1px solid var(--c-border);
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
}
.todo-item:hover {
  border-color: var(--c-brand);
  box-shadow: var(--shadow-sm);
}

/* .check / .check-done 已抽取到全局 theme.css（审查 M-23） */

.del { transition: opacity 0.15s ease, color 0.15s ease; }

/* 日程区（v0.3.0） */
.agenda-card {
  background: var(--c-surface);
  border: 1px solid var(--c-border);
}
.cat-chip {
  background: var(--c-bg);
  color: var(--c-fg-faint);
  border: 1px solid var(--c-border);
  font-weight: 500;
}
.due-overdue {
  background: #fca5a51a;
  color: #dc2626;
}
.dark .due-overdue { color: #f87171; }
.due-normal {
  background: var(--c-bg);
  color: var(--c-fg-faint);
  border: 1px solid var(--c-border);
}

.list-enter-active, .list-leave-active { transition: transform 0.2s ease, opacity 0.2s ease; }
.list-enter-from { opacity: 0; transform: translateY(-8px); }
.list-leave-to { opacity: 0; transform: translateX(12px); }
</style>
