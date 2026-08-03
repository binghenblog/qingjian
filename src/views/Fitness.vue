<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useFitnessStore } from '@/stores/fitness'
import { useConfirm } from '@/composables/useConfirm'
import { useToast } from '@/composables/useToast'
import { dateKey } from '@/stores/todos'

const { t } = useI18n()
const store = useFitnessStore()
const { confirm } = useConfirm()
const toast = useToast()

onMounted(() => {
  if (!store.loaded) store.load()
  if (store.height !== null) heightInput.value = String(store.height)
})

// 身高录入 / 编辑
const heightInput = ref('')
async function saveHeight() {
  const h = Number(heightInput.value)
  if (!Number.isFinite(h) || h <= 0 || h > 300) {
    toast.error(t('fitness.invalidNumber'))
    return
  }
  store.height = h
  toast.success(t('fitness.heightSaved'))
  heightInput.value = ''
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
    <h2 class="text-xl font-bold m-0">{{ t('fitness.title') }}</h2>

    <!-- 身高录入 / 编辑（始终可改） -->
    <section class="card rounded-2xl p-5 space-y-3">
      <div class="font-semibold text-sm">{{ t('fitness.needHeight') }}</div>
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

    <!-- 概览 -->
    <section class="card rounded-2xl p-5 grid grid-cols-2 sm:grid-cols-4 gap-4">
      <div>
        <div class="text-xs text-fg-faint">{{ t('fitness.todayMinutes') }}</div>
        <div class="text-xl font-bold">{{ store.todayMinutes }}<span class="text-sm font-normal text-fg-faint ml-1">{{ t('fitness.minutes') }}</span></div>
      </div>
      <div>
        <div class="text-xs text-fg-faint">{{ t('fitness.monthMinutes') }}</div>
        <div class="text-xl font-bold">{{ store.monthMinutes }}<span class="text-sm font-normal text-fg-faint ml-1">{{ t('fitness.minutes') }}</span></div>
      </div>
      <div>
        <div class="text-xs text-fg-faint">{{ t('fitness.bmi') }}</div>
        <div class="text-xl font-bold">
          {{ store.bmi ? store.bmi.toFixed(1) : '—' }}
          <span v-if="store.bmi" class="text-xs font-normal text-fg-faint ml-1">{{ bmiText(store.bmi) }}</span>
        </div>
      </div>
      <div>
        <div class="text-xs text-fg-faint">{{ t('fitness.currentWeight') }}</div>
        <div class="text-xl font-bold">
          {{ store.latestWeight ? store.latestWeight.toFixed(1) : '—' }}
          <span class="text-sm font-normal text-fg-faint ml-1">{{ t('fitness.weightUnit') }}</span>
        </div>
      </div>
    </section>

    <!-- 锻炼记录 -->
    <section class="card rounded-2xl p-5 space-y-3">
      <div class="font-semibold text-sm">{{ t('fitness.addWorkout') }}</div>
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <label class="field">
          <span class="field-label">{{ t('fitness.workoutType') }}</span>
          <input v-model="workout.type" class="input-modern w-full px-3 py-2 text-sm" :placeholder="t('fitness.workoutTypePlaceholder')" />
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
      <button class="btn-primary px-4 py-2 rounded-xl text-sm w-full sm:w-auto" @click="addWorkout">
        {{ t('fitness.addWorkout') }}
      </button>

      <div class="pt-2">
        <div class="text-sm font-medium mb-2">{{ t('fitness.workouts') }}</div>
        <p v-if="store.workoutList.length === 0" class="text-sm text-fg-faint m-0">{{ t('fitness.emptyWorkouts') }}</p>
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

    <!-- 体重记录 -->
    <section class="card rounded-2xl p-5 space-y-3">
      <div class="font-semibold text-sm">{{ t('fitness.addWeight') }}</div>
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <label class="field">
          <span class="field-label">{{ t('fitness.weight') }}</span>
          <input v-model="weight.value" type="number" min="1" max="500" step="0.1" inputmode="decimal" class="input-modern w-full px-3 py-2 text-sm" :placeholder="t('fitness.weightPlaceholder')" />
        </label>
        <label class="field">
          <span class="field-label">{{ t('fitness.date') }}</span>
          <input v-model="weight.date" type="date" class="input-modern w-full px-3 py-2 text-sm" />
        </label>
      </div>
      <button class="btn-primary px-4 py-2 rounded-xl text-sm w-full sm:w-auto" @click="addWeight">
        {{ t('fitness.addWeight') }}
      </button>

      <!-- 近期趋势（纯 CSS 柱状，不引图表库） -->
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
        <p v-if="store.sortedWeights.length === 0" class="text-sm text-fg-faint m-0">{{ t('fitness.emptyWeights') }}</p>
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
</style>
