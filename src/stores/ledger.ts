import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { transactionRepository as transactionStorage } from '@/db'
import { dateKey, dateKeyDaysAgo } from '@/stores/todos'
import type { Transaction, TxType } from '@/types'

/** 预设分类（收入 / 支出），用户也可在表单中自定义 */
export const TX_CATEGORIES: Record<TxType, string[]> = {
  income: ['工资', '奖金', '理财', '红包', '其他'],
  expense: ['餐饮', '交通', '购物', '居住', '娱乐', '医疗', '教育', '其他']
}

/** 周一为一周起点 */
function startOfWeekKey(d = new Date()): string {
  const date = new Date(d)
  const day = (date.getDay() + 6) % 7
  date.setDate(date.getDate() - day)
  return dateKey(date)
}
function startOfMonthKey(d = new Date()): string {
  return dateKey(new Date(d.getFullYear(), d.getMonth(), 1))
}

export const useLedgerStore = defineStore('ledger', () => {
  const transactions = ref<Transaction[]>([])
  const loaded = ref(false)

  async function load() {
    transactions.value = await transactionStorage.list()
    loaded.value = true
  }

  async function add(input: Omit<Transaction, 'id' | 'createdAt' | 'updatedAt'>) {
    const t: Transaction = { ...input, id: crypto.randomUUID(), createdAt: Date.now(), updatedAt: Date.now() }
    await transactionStorage.save(t)
    await load()
  }

  async function remove(id: string) {
    await transactionStorage.delete(id)
    await load()
  }

  function sum(type: TxType, from: string): number {
    return transactions.value
      .filter((x) => x.type === type && x.date >= from)
      .reduce((s, x) => s + x.amount, 0)
  }

  const today = computed(() => dateKey())
  const weekStart = computed(() => startOfWeekKey())
  const monthStart = computed(() => startOfMonthKey())
  const recentStart = computed(() => dateKeyDaysAgo(2))

  const todayIncome = computed(() => sum('income', today.value))
  const todayExpense = computed(() => sum('expense', today.value))
  const weekIncome = computed(() => sum('income', weekStart.value))
  const weekExpense = computed(() => sum('expense', weekStart.value))
  const monthIncome = computed(() => sum('income', monthStart.value))
  const monthExpense = computed(() => sum('expense', monthStart.value))

  const byDateDesc = (a: Transaction, b: Transaction) =>
    a.date < b.date ? 1 : a.date > b.date ? -1 : b.createdAt - a.createdAt

  const recent = computed(() => transactions.value.filter((x) => x.date >= recentStart.value).sort(byDateDesc))
  const all = computed(() => [...transactions.value].sort(byDateDesc))

  return {
    transactions,
    loaded,
    load,
    add,
    remove,
    todayIncome,
    todayExpense,
    weekIncome,
    weekExpense,
    monthIncome,
    monthExpense,
    recent,
    all
  }
})
