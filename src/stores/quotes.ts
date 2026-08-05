import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { quoteRepository as quoteStorage } from '@/db'
import type { Quote } from '@/types'

/** 预设分类，用户也可在表单中自定义 */
export const QUOTE_CATEGORIES = ['名言', '感悟', '摘录', '歌词', '其他']

export const useQuotesStore = defineStore('quotes', () => {
  const items = ref<Quote[]>([])
  const loaded = ref(false)

  async function load() {
    items.value = await quoteStorage.list()
    loaded.value = true
  }

  async function add(input: Omit<Quote, 'id' | 'createdAt' | 'updatedAt'>) {
    const q: Quote = { ...input, id: crypto.randomUUID(), createdAt: Date.now(), updatedAt: Date.now() }
    await quoteStorage.save(q)
    await load()
  }

  async function remove(id: string) {
    await quoteStorage.delete(id)
    await load()
  }

  const byDateDesc = (a: Quote, b: Quote) =>
    a.date < b.date ? 1 : a.date > b.date ? -1 : b.createdAt - a.createdAt

  const list = computed(() => [...items.value].sort(byDateDesc))

  return { items, loaded, load, add, remove, list }
})
