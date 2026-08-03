import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { anniversaryStorage } from '@/services/storage'
import type { Anniversary } from '@/types'

/**
 * 纪念日 Store
 * - Dexie 持久化（StorageAdapter）
 * - 纪念日只关心 月-日，年份仅用于排序；列表按「距离今日天数」升序
 */
export const useAnniversariesStore = defineStore('anniversaries', () => {
  const items = ref<Anniversary[]>([])
  const loaded = ref(false)

  async function load() {
    items.value = await anniversaryStorage.list()
    loaded.value = true
  }

  async function add(input: Omit<Anniversary, 'id' | 'createdAt' | 'updatedAt'>) {
    const a: Anniversary = { ...input, id: crypto.randomUUID(), createdAt: Date.now(), updatedAt: Date.now() }
    await anniversaryStorage.save(a)
    await load()
  }

  async function remove(id: string) {
    await anniversaryStorage.delete(id)
    await load()
  }

  /**
   * 距离下一次纪念日还有多少天（DST 安全：以本地 00:00 锚点做整日差）
   * - 返回 0 表示就是今天
   * - 若今年的纪念日已过，则算到明年
   */
  function daysUntil(dateStr: string): number {
    const [, m, d] = dateStr.split('-').map(Number)
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    let target = new Date(today.getFullYear(), m - 1, d)
    if (target < today) target = new Date(today.getFullYear() + 1, m - 1, d)
    return Math.round((target.getTime() - today.getTime()) / 86_400_000)
  }

  /** 列表按「距离天数」升序，最近到来的排在最前 */
  const list = computed(() =>
    [...items.value].sort((a, b) => daysUntil(a.date) - daysUntil(b.date))
  )

  return { items, loaded, load, add, remove, daysUntil, list }
})
