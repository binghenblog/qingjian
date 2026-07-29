<script setup lang="ts">
import { ref, computed } from 'vue'
import { useTodoStore, PRESET_CATEGORIES } from '@/stores/todos'
import TodoBadges from '@/components/TodoBadges.vue'
import type { TodoPriority } from '@/types'
import { DAILY_CATEGORY } from '@/types'

const store = useTodoStore()

/** 当前分类：默认「每日」 */
const activeCat = ref(DAILY_CATEGORY)

const draft = ref('')
const draftPriority = ref<TodoPriority>('medium')
const draftTag = ref('')

/** 自定义分类 */
const addingCat = ref(false)
const newCatName = ref('')
const catError = ref('')

const priorities: { value: TodoPriority; label: string; dot: string }[] = [
  { value: 'high', label: '高', dot: 'bg-red-500' },
  { value: 'medium', label: '中', dot: 'bg-amber-500' },
  { value: 'low', label: '低', dot: 'bg-slate-400' }
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
  store.add(draft.value, draftPriority.value, draftTag.value, activeCat.value)
  draft.value = ''
  draftTag.value = ''
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
    catError.value = store.categories.includes(n) ? '分类已存在' : '名称需在 1-8 个字符'
  }
}

function delCategory(cat: string) {
  if (!confirm(`删除分类「${cat}」？该分类下的任务会移入「生活」`)) return
  store.removeCategory(cat)
  if (activeCat.value === cat) activeCat.value = DAILY_CATEGORY
}

function isPreset(cat: string) {
  return PRESET_CATEGORIES.includes(cat)
}
</script>

<template>
  <div class="space-y-5 max-w-2xl">
      <div class="flex items-baseline justify-between">
      <h2 class="text-xl font-bold m-0">待办 / 任务</h2>
      <span v-if="progress.total" class="text-sm text-fg-faint" aria-live="polite">
        {{ progress.done }} / {{ progress.total }} 已完成
      </span>
    </div>

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
          title="删除分类"
          aria-label="删除分类"
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
          placeholder="分类名"
          class="input-modern w-28 px-3 py-1.5 text-sm"
        />
        <button @click="confirmAddCat" class="btn-primary px-3 py-1.5 text-xs">确定</button>
        <span v-if="catError" class="text-xs text-red-500">{{ catError }}</span>
      </div>
      <button
        v-else
        @click="addingCat = true"
        class="cat-tab cat-add flex items-center gap-1 px-3 py-2 rounded-xl text-sm cursor-pointer"
      >
        <span class="i-carbon-add text-base" />
        自定义
      </button>
    </div>

    <!-- 每日任务：昨日遗留 + 今日进度 -->
    <div v-if="isDaily" class="space-y-3">
      <div
        v-if="store.yesterdayMissed > 0"
        class="missed-banner flex items-center gap-2.5 px-4 py-3 rounded-xl text-sm"
      >
        <span class="i-carbon-warning-alt text-lg shrink-0" />
        <span>昨日有 <b class="missed-num">{{ store.yesterdayMissed }}</b> 项每日任务未完成，今天补上节奏 💪</span>
      </div>
      <div v-else-if="progress.total" class="clear-banner flex items-center gap-2.5 px-4 py-3 rounded-xl text-sm">
        <span class="i-carbon-checkmark-outline text-lg shrink-0" />
        <span>昨日全部完成，状态在线 ✨</span>
      </div>

      <!-- 今日进度条 -->
      <div v-if="progress.total" class="progress-card rounded-xl px-4 py-3">
        <div class="flex items-center justify-between text-xs mb-2">
          <span class="text-fg-soft font-medium">今日进度</span>
          <span class="text-fg-faint">{{ progress.done }}/{{ progress.total }} · {{ progress.rate }}%</span>
        </div>
        <div class="track h-2 rounded-full overflow-hidden">
          <div
            class="fill h-full rounded-full transition-all duration-500"
            :class="progress.rate === 100 ? 'fill-complete' : ''"
            :style="{ width: progress.rate + '%' }"
          />
        </div>
      </div>
    </div>

    <!-- 非每日分类：简洁进度条 -->
    <div v-else-if="progress.total" class="progress-card rounded-xl px-4 py-3">
      <div class="flex items-center justify-between text-xs mb-2">
        <span class="text-fg-soft font-medium">「{{ activeCat }}」完成进度</span>
        <span class="text-fg-faint">{{ progress.done }}/{{ progress.total }} · {{ progress.rate }}%</span>
      </div>
      <div class="track h-2 rounded-full overflow-hidden">
        <div
          class="fill h-full rounded-full transition-all duration-500"
          :class="progress.rate === 100 ? 'fill-complete' : ''"
          :style="{ width: progress.rate + '%' }"
        />
      </div>
    </div>

    <!-- 输入区 -->
    <div class="composer rounded-2xl p-3 space-y-3">
      <div class="flex gap-2.5">
        <input
          v-model="draft"
          @keyup.enter="add"
          :placeholder="isDaily ? '添加每日任务（每天自动重置），回车确认…' : `添加到「${activeCat}」，回车确认…`"
          class="input-modern flex-1 px-4 py-2.5 text-sm"
        />
        <button @click="add" class="btn-primary px-5 py-2.5 text-sm flex items-center gap-1.5">
          <span class="i-carbon-add text-base" />
          添加
        </button>
      </div>
      <div class="flex items-center gap-4 flex-wrap">
        <div class="flex items-center gap-1.5" role="radiogroup" aria-label="优先级">
          <span class="text-xs text-fg-faint">优先级</span>
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
            {{ p.label }}
          </button>
        </div>
        <div class="flex items-center gap-1.5 flex-1 min-w-40">
          <span class="i-carbon-tag text-fg-faint text-sm shrink-0" />
          <input
            v-model="draftTag"
            @keyup.enter="add"
            list="used-tags"
            placeholder="标签（可选），如：阅读 / 健身"
            class="flex-1 text-xs bg-transparent border-none outline-none text-fg placeholder:text-fg-faint py-1"
          />
          <datalist id="used-tags">
            <option v-for="t in store.usedTags" :key="t" :value="t" />
          </datalist>
        </div>
      </div>
    </div>

    <!-- 列表 -->
    <TransitionGroup name="list" tag="ul" class="space-y-2 p-0 m-0 list-none">
      <li
        v-for="t in list"
        :key="t.id"
        class="todo-item group flex items-center gap-3 px-4 py-3 rounded-xl"
      >
        <button
          @click="store.toggle(t.id)"
          role="checkbox"
          :aria-checked="store.isDone(t) ? 'true' : 'false'"
          :aria-label="`完成任务 ${t.title}`"
          class="check w-5 h-5 rounded-full flex items-center justify-center shrink-0 cursor-pointer"
          :class="store.isDone(t) ? 'check-done' : ''"
        >
          <span v-if="store.isDone(t)" class="i-carbon-checkmark text-[13px] leading-none text-white" />
        </button>
        <span class="flex-1 text-sm transition-all" :class="store.isDone(t) ? 'line-through text-fg-faint' : ''">
          {{ t.title }}
        </span>
        <!-- 每日任务连续打卡 -->
        <span v-if="isDaily && (store.streaks[t.id] ?? 0) > 1" class="streak flex items-center gap-0.5 text-[11px] shrink-0">
          <span class="i-carbon-fire text-xs" />
          {{ store.streaks[t.id] }}天
        </span>
        <TodoBadges :priority="t.priority" :tag="t.tag" />
        <button
          @click="store.remove(t.id)"
          class="del opacity-0 group-hover:opacity-100 text-fg-faint hover:text-red-500 cursor-pointer bg-transparent border-none p-1"
          aria-label="删除任务"
        >
          <span class="i-carbon-trash-can text-base" />
        </button>
      </li>
    </TransitionGroup>

    <!-- 空状态 -->
    <div v-if="list.length === 0" class="empty grid place-items-center py-14 rounded-2xl text-center">
      <div>
        <span :class="catIcon(activeCat)" class="text-4xl text-fg-faint" />
        <p class="text-sm text-fg-faint mt-2 mb-0">
          {{ isDaily ? '还没有每日任务，添加打卡习惯吧（如：晨读 30 分钟）' : `「${activeCat}」还没有任务，从上面添加第一项` }}
        </p>
      </div>
    </div>

    <p v-if="isDaily" class="text-xs text-fg-faint">
      <span class="i-carbon-information align-text-bottom" />
      每日任务每天 0 点自动重置，完成记录会保留用于打卡统计
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
  transition: all 0.15s ease;
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
  background: #10b98112;
  border: 1px solid #10b98140;
  color: #047857;
}
.dark .clear-banner {
  background: #10b9811f;
  border-color: #10b98138;
  color: #34d399;
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
  background: var(--c-bg);
  border: 1px solid var(--c-border);
  color: var(--c-fg-soft);
  transition: all 0.15s ease;
}
.pri-btn:hover { color: var(--c-fg); }
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

.check {
  border: 2px solid var(--c-border);
  background: transparent;
  transition: all 0.15s ease;
}
.check:hover { border-color: var(--c-brand); }
.check-done {
  border-color: var(--c-brand);
  background: var(--c-brand-grad);
}

.del { transition: opacity 0.15s ease, color 0.15s ease; }

.empty { border: 1.5px dashed var(--c-border); }

.list-enter-active, .list-leave-active { transition: all 0.2s ease; }
.list-enter-from { opacity: 0; transform: translateY(-8px); }
.list-leave-to { opacity: 0; transform: translateX(12px); }
</style>
