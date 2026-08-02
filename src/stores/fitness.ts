import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'
import { workoutStorage, weightStorage } from '@/services/storage'
import { dateKey } from '@/stores/todos'
import type { WorkoutRecord, WeightRecord } from '@/types'

/** 身高：首次录入后记住，持久化到 localStorage（不进 Dexie，单一标量值） */
const HEIGHT_KEY = 'qingjian.fitness.height'

export const useFitnessStore = defineStore('fitness', () => {
  const height = ref<number | null>(null)
  const workouts = ref<WorkoutRecord[]>([])
  const weights = ref<WeightRecord[]>([])
  const loaded = ref(false)

  try {
    const h = localStorage.getItem(HEIGHT_KEY)
    if (h) {
      const n = Number(h)
      if (Number.isFinite(n) && n > 0) height.value = n
    }
  } catch {
    /* ignore */
  }
  watch(height, (v) => {
    try {
      if (v && v > 0) localStorage.setItem(HEIGHT_KEY, String(v))
      else localStorage.removeItem(HEIGHT_KEY)
    } catch {
      /* ignore */
    }
  })

  async function load() {
    const [ws, wt] = await Promise.all([workoutStorage.list(), weightStorage.list()])
    workouts.value = ws
    weights.value = wt
    loaded.value = true
  }

  async function addWorkout(input: Omit<WorkoutRecord, 'id' | 'createdAt'>) {
    const w: WorkoutRecord = { ...input, id: crypto.randomUUID(), createdAt: Date.now() }
    await workoutStorage.save(w)
    await load()
  }
  async function removeWorkout(id: string) {
    await workoutStorage.delete(id)
    await load()
  }
  async function addWeight(input: Omit<WeightRecord, 'id' | 'createdAt'>) {
    const w: WeightRecord = { ...input, id: crypto.randomUUID(), createdAt: Date.now() }
    await weightStorage.save(w)
    await load()
  }
  async function removeWeight(id: string) {
    await weightStorage.delete(id)
    await load()
  }

  const today = computed(() => dateKey())
  const monthStart = computed(() => dateKey(new Date(new Date().getFullYear(), new Date().getMonth(), 1)))

  const todayMinutes = computed(() =>
    workouts.value.filter((w) => w.date === today.value).reduce((s, w) => s + w.duration, 0)
  )
  const monthMinutes = computed(() =>
    workouts.value.filter((w) => w.date >= monthStart.value).reduce((s, w) => s + w.duration, 0)
  )

  const workoutList = computed(() =>
    [...workouts.value].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : b.createdAt - a.createdAt))
  )
  const sortedWeights = computed(() =>
    [...weights.value].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : b.createdAt - a.createdAt))
  )
  const latestWeight = computed(() => sortedWeights.value[0]?.weight ?? null)
  const bmi = computed(() => {
    if (!height.value || !latestWeight.value) return null
    const m = height.value / 100
    return latestWeight.value / (m * m)
  })

  /** 近期体重趋势（按日期升序，最多 10 条，用于迷你柱状图） */
  const weightTrend = computed(() =>
    [...weights.value]
      .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.createdAt - b.createdAt))
      .slice(-10)
  )

  return {
    height,
    workouts,
    weights,
    loaded,
    load,
    addWorkout,
    removeWorkout,
    addWeight,
    removeWeight,
    todayMinutes,
    monthMinutes,
    latestWeight,
    bmi,
    weightTrend,
    workoutList,
    sortedWeights
  }
})
