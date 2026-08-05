<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useFitnessStore } from '@/stores/fitness'
import { useConfirm } from '@/composables/useConfirm'
import { useToast } from '@/composables/useToast'
import { useFab } from '@/composables/useFab'
import { dateKey } from '@/stores/todos'
import BaseModal from '@/components/BaseModal.vue'
import EmptyState from '@/components/EmptyState.vue'

const { t } = useI18n()
const store = useFitnessStore()
const { confirm } = useConfirm()
const toast = useToast()
const workoutTypeInput = ref<HTMLInputElement>()

// 弹窗可见态 + 记录类型 + 移动端 FAB（要求一）
const { setFab, clearFab } = useFab()
const showModal = ref(false)
const recordType = ref<'workout' | 'weight'>('workout')

onMounted(() => {
  if (!store.loaded) store.load()
  if (store.height !== null) heightInput.value = String(store.height)
  setFab(() => (showModal.value = true), t('fitness.addRecord'))
})
onUnmounted(() => clearFab())

// 身高录入 / 编辑
const heightInput = ref('')
const showHeightForm = ref(false)
async function saveHeight() {
  const h = Number(heightInput.value)
  if (!Number.isFinite(h) || h <= 0 || h > 300) {
    toast.error(t('fitness.invalidNumber'))
    return
  }
  store.height = h
  toast.success(t('fitness.heightSaved'))
  heightInput.value = ''
  showHeightForm.value = false
}

// 锻炼表单
const workout = ref({ type: '', duration: '', date: dateKey(), note: '' })
async function addWorkout() {
  const d = Number(workout.value.duration)
  if (!workout.value.type) {
    toast.error(t('fitness.pickType'))
    return
  }
  if (!Number.isFinite(d) || d <= 0) {
    toast.error(t('fitness.invalidNumber'))
    return
  }
  await store.addWorkout({
    type: workout.value.type,
    duration: Math.round(d),
    date: workout.value.date,
    note: workout.value.note.trim() || undefined
  })
  toast.success(t('fitness.saved'))
  workout.value.duration = ''
  workout.value.note = ''
}

// 体重表单
const weight = ref({ value: '', date: dateKey() })
async function addWeight() {
  const w = Number(weight.value.value)
  if (!Number.isFinite(w) || w <= 0 || w > 500) {
    toast.error(t('fitness.invalidNumber'))
    return
  }
  await store.addWeight({ weight: Math.round(w * 10) / 10, date: weight.value.date })
  toast.success(t('fitness.saved'))
  weight.value.value = ''
}

/** 弹窗保存：按当前记录类型调用对应 handler；校验失败时不关闭弹窗（handler 已 toast 提示） */
async function submitRecord() {
  if (recordType.value === 'workout') {
    const d = Number(workout.value.duration)
    if (!workout.value.type || !Number.isFinite(d) || d <= 0) {
      await addWorkout()
      return
    }
    await addWorkout()
  } else {
    const w = Number(weight.value.value)
    if (!Number.isFinite(w) || w <= 0 || w > 500) {
      await addWeight()
      return
    }
    await addWeight()
  }
  showModal.value = false
}

async function delWorkout(id: string) {
  if (!(await confirm({ title: t('fitness.deleteTitle'), message: t('fitness.deleteWorkoutMsg'), danger: true }))) return
  await store.removeWorkout(id)
}
async function delWeight(id: string) {
  if (!(await confirm({ title: t('fitness.deleteTitle'), message: t('fitness.deleteWeightMsg'), danger: true }))) return
  await store.removeWeight(id)
}

// 体重趋势柱状图
const trendMax = computed(() => Math.max(...store.weightTrend.map((w) => w.weight), 1))
function barHeight(v: number): number {
  return Math.max((v / trendMax.value) * 100, 8)
}
function bmiText(bmi: number): string {
  if (bmi < 18.5) return t('fitness.bmiThin')
  if (bmi < 24) return t('fitness.bmiNormal')
  if (bmi < 28) return t('fitness.bmiOver')
  return t('fitness.bmiObese')
}
</script>

<template>
  <div class="space-y-5 max-w-2xl pb-20">
    <div class="flex items-center justify-between">
      <h2 class="text-xl font-bold m-0">{{ t('fitness.title') }}</h2>
      <!-- PC 端右上角文字新增按钮（要求一.1）；移动端由 FAB 唤起同一弹窗 -->
      <button class="btn-primary hidden lg:inline-flex items-center gap-1 px-3 py-1.5 text-sm rounded-btn" @click="showModal = true">
        <span class="i-carbon-add text-base" />{{ t('fitness.addRecord') }}
      </button>
    </div>

    <!-- 身高录入 / 编辑：首次或手动展开时显示表单，录入后收起为紧凑行 -->
    <section v-if="store.height === null || showHeightForm" class="card rounded-2xl p-5 space-y-3">
      <div class="font-semibold text-sm">{{ store.height === null ? t('fitness.needHeight') : t('fitness.editHeight') }}</div>
      <p class="text-xs text-fg-faint mt-0 mb-2">{{ t('fitness.needHeightHint') }}</p>
      <div class="flex gap-2">
        <input
          v-model="heightInput"
          type="number"
          min="1"
          max="300"
          inputmode="decimal"
          class="input-modern flex-1 px-3 py-2 text-sm"
          :placeholder="t('fitness.heightPlaceholder')"
        />
        <button class="btn-primary px-4 py-2 rounded-xl text-sm" @click="saveHeight">
          {{ t('common.confirm') }}
        </button>
      </div>
    </section>
    <div v-else class="card rounded-2xl px-5 py-3 flex items-center justify-between">
      <div class="flex items-center gap-2 text-sm">
        <span class="i-carbon-ruler text-fg-faint" />
        <span class="text-fg-soft">{{ t('fitness.height') }}</span>
        <span class="font-semibold">{{ store.height }} {{ t('fitness.cm') }}</span>
      </div>
      <button class="text-xs text-brand cursor-pointer bg-transparent border-none" @click="showHeightForm = true">
        {{ t('common.edit') }}
      </button>
    </div>

    <!-- 概览 -->
    <section class="card rounded-2xl p-5 grid grid-cols-2 sm:grid-cols-4 gap-4">
      <div>
        <div class="text-[11px] text-fg-faint">{{ t('fitness.todayMinutes') }}</div>
        <div class="text-2xl font-bold tabular-nums">{{ store.todayMinutes }}<span class="text-sm font-normal text-fg-faint ml-1">{{ t('fitness.minutes') }}</span></div>
      </div>
      <div>
        <div class="text-[11px] text-fg-faint">{{ t('fitness.monthMinutes') }}</div>
        <div class="text-2xl font-bold tabular-nums">{{ store.monthMinutes }}<span class="text-sm font-normal text-fg-faint ml-1">{{ t('fitness.minutes') }}</span></div>
      </div>
      <div>
        <div class="text-[11px] text-fg-faint">{{ t('fitness.bmi') }}</div>
        <div class="text-2xl font-bold tabular-nums">
          <span :class="store.bmi ? '' : 'stat-none'">{{ store.bmi ? store.bmi.toFixed(1) : '—' }}</span>
          <span v-if="store.bmi" class="text-xs font-normal text-fg-faint ml-1">{{ bmiText(store.bmi) }}</span>
        </div>
      </div>
      <div>
        <div class="text-[11px] text-fg-faint">{{ t('fitness.currentWeight') }}</div>
        <div class="text-2xl font-bold tabular-nums">
          <span :class="store.latestWeight ? '' : 'stat-none'">{{ store.latestWeight ? store.latestWeight.toFixed(1) : '—' }}</span>
          <span class="text-sm font-normal text-fg-faint ml-1">{{ t('fitness.weightUnit') }}</span>
        </div>
      </div>
    </section>

    <!-- 锻炼记录（列表保留；表单已移入弹窗） -->
    <section class="card rounded-2xl p-5 space-y-3">
      <div class="pt-2">
        <div class="text-sm font-medium mb-2">{{ t('fitness.workouts') }}</div>
        <EmptyState v-if="store.workoutList.length === 0" icon="i-carbon-run" :title="t('fitness.emptyWorkouts')" compact />
        <ul v-else class="space-y-2">
          <li v-for="w in store.workoutList" :key="w.id" class="flex items-center gap-3 px-3 py-2 rounded-xl bg-bg">
            <div class="flex-1 min-w-0">
              <div class="text-sm font-medium truncate">{{ w.type }}</div>
              <div class="text-xs text-fg-faint">
                {{ w.date }}<span v-if="w.note"> · {{ w.note }}</span>
              </div>
            </div>
            <div class="font-semibold">{{ w.duration }} {{ t('fitness.minutes') }}</div>
            <button class="text-fg-faint hover:text-red-500 cursor-pointer bg-transparent border-none" :aria-label="t('fitness.deleteAria')" @click="delWorkout(w.id)">
              <span class="i-carbon-trash-can text-base" />
            </button>
          </li>
        </ul>
      </div>
    </section>

    <!-- 体重记录（列表 / 趋势保留；表单已移入弹窗） -->
    <section class="card rounded-2xl p-5 space-y-3">
      <div v-if="store.weightTrend.length > 1" class="pt-2">
        <div class="text-sm font-medium mb-2">{{ t('fitness.trend') }}</div>
        <div class="flex items-end gap-1.5 h-28 px-1">
          <div v-for="w in store.weightTrend" :key="w.id" class="flex-1 flex flex-col items-center justify-end gap-1" :title="`${w.date}: ${w.weight} ${t('fitness.weightUnit')}`">
            <span class="text-[10px] text-fg-faint">{{ w.weight }}</span>
            <div class="w-full rounded-t bg-brand" :style="{ height: barHeight(w.weight) + '%' }" />
          </div>
        </div>
      </div>

      <div class="pt-2">
        <div class="text-sm font-medium mb-2">{{ t('fitness.weights') }}</div>
        <EmptyState v-if="store.sortedWeights.length === 0" icon="i-carbon-scale" :title="t('fitness.emptyWeights')" compact />
        <ul v-else class="space-y-2">
          <li v-for="w in store.sortedWeights" :key="w.id" class="flex items-center gap-3 px-3 py-2 rounded-xl bg-bg">
            <div class="flex-1 text-sm">{{ w.date }}</div>
            <div class="font-semibold">{{ w.weight.toFixed(1) }} {{ t('fitness.weightUnit') }}</div>
            <button class="text-fg-faint hover:text-red-500 cursor-pointer bg-transparent border-none" :aria-label="t('fitness.deleteAria')" @click="delWeight(w.id)">
              <span class="i-carbon-trash-can text-base" />
            </button>
          </li>
        </ul>
      </div>
    </section>

    <!-- 新增记录：全局弹窗（要求三）；PC 右上角按钮 / 移动端 FAB 唤起 -->
    <BaseModal v-model="showModal" :title="t('fitness.addRecord')" @save="submitRecord">
      <div class="space-y-4">
        <!-- 记录类型切换：锻炼 / 体重 -->
        <div class="inline-flex p-1 rounded-xl gap-1 bg-bg border border-border w-full" role="radiogroup" :aria-label="t('fitness.addRecord')">
          <button
            @click="recordType = 'workout'"
            role="radio"
            :aria-checked="recordType === 'workout' ? 'true' : 'false'"
            class="flex-1 px-4 py-2 rounded-lg text-sm cursor-pointer border-none transition-colors"
            :class="recordType === 'workout' ? 'bg-surface text-brand-strong font-semibold shadow-sm' : 'text-fg-soft'"
          >{{ t('fitness.addWorkout') }}</button>
          <button
            @click="recordType = 'weight'"
            role="radio"
            :aria-checked="recordType === 'weight' ? 'true' : 'false'"
            class="flex-1 px-4 py-2 rounded-lg text-sm cursor-pointer border-none transition-colors"
            :class="recordType === 'weight' ? 'bg-surface text-brand-strong font-semibold shadow-sm' : 'text-fg-soft'"
          >{{ t('fitness.addWeight') }}</button>
        </div>

        <!-- 锻炼表单 -->
        <div v-if="recordType === 'workout'" class="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label class="field">
            <span class="field-label">{{ t('fitness.workoutType') }}</span>
            <input ref="workoutTypeInput" v-model="workout.type" class="input-modern w-full px-3 py-2 text-sm" :placeholder="t('fitness.workoutTypePlaceholder')" />
          </label>
          <label class="field">
            <span class="field-label">{{ t('fitness.duration') }}</span>
            <input v-model="workout.duration" type="number" min="1" step="1" inputmode="numeric" class="input-modern w-full px-3 py-2 text-sm" :placeholder="t('fitness.durationPlaceholder')" />
          </label>
          <label class="field">
            <span class="field-label">{{ t('fitness.date') }}</span>
            <input v-model="workout.date" type="date" class="input-modern w-full px-3 py-2 text-sm" />
          </label>
          <label class="field">
            <span class="field-label">{{ t('fitness.note') }}</span>
            <input v-model="workout.note" class="input-modern w-full px-3 py-2 text-sm" :placeholder="t('fitness.notePlaceholder')" />
          </label>
        </div>

        <!-- 体重表单 -->
        <div v-else class="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label class="field">
            <span class="field-label">{{ t('fitness.weight') }}</span>
            <input v-model="weight.value" type="number" min="1" max="500" step="0.1" inputmode="decimal" class="input-modern w-full px-3 py-2 text-sm" :placeholder="t('fitness.weightPlaceholder')" />
          </label>
          <label class="field">
            <span class="field-label">{{ t('fitness.date') }}</span>
            <input v-model="weight.date" type="date" class="input-modern w-full px-3 py-2 text-sm" />
          </label>
        </div>
      </div>
    </BaseModal>
  </div>
</template>

<style scoped>
.field {
  display: flex;
  flex-direction: column;
  gap: 5px;
}
.field-label {
  font-size: 12px;
  color: var(--c-fg-soft);
  font-weight: 500;
}

/* 无数据占位符「—」统一弱化样式 */
.stat-none {
  color: var(--c-fg-faint);
  font-weight: 400;
}
</style>
