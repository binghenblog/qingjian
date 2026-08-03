<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useLedgerStore, TX_CATEGORIES } from '@/stores/ledger'
import { useSettingsStore } from '@/stores/settings'
import { useConfirm } from '@/composables/useConfirm'
import { useToast } from '@/composables/useToast'
import { dateKey } from '@/stores/todos'
import type { Transaction, TxType } from '@/types'

const { t } = useI18n()
const store = useLedgerStore()
const settings = useSettingsStore()
const { confirm } = useConfirm()
const toast = useToast()

onMounted(() => {
  if (!store.loaded) store.load()
})

const showAll = ref(false)
const records = computed(() => (showAll.value ? store.all : store.recent))

// 记一笔表单
const form = ref({
  type: 'expense' as TxType,
  category: '',
  amount: '',
  date: dateKey(),
  note: ''
})
const categories = computed(() => TX_CATEGORIES[form.value.type])

/** 切换收支类型：分类改为由 chips 重新点选（预设分类随类型切换） */
function switchType(type: TxType) {
  form.value.type = type
  if (!TX_CATEGORIES[type].includes(form.value.category)) {
    form.value.category = ''
  }
}

async function save() {
  const amount = Number(form.value.amount)
  if (!form.value.category) {
    toast.error(t('ledger.pickCategory'))
    return
  }
  if (!Number.isFinite(amount) || amount <= 0) {
    toast.error(t('ledger.invalidAmount'))
    return
  }
  await store.add({
    type: form.value.type,
    category: form.value.category,
    amount: Math.round(amount * 100) / 100,
    date: form.value.date,
    note: form.value.note.trim() || undefined
  })
  toast.success(t('ledger.saved'))
  form.value.amount = ''
  form.value.note = ''
}

async function del(tx: Transaction) {
  if (
    !(await confirm({
      title: t('ledger.deleteTitle'),
      message: t('ledger.deleteMsg', { category: tx.category }),
      danger: true
    }))
  )
    return
  await store.remove(tx.id)
}

function fmt(n: number): string {
  return n.toFixed(2)
}
function sign(type: TxType): string {
  return type === 'income' ? '+' : '-'
}
</script>

<template>
  <div class="space-y-5 max-w-2xl pb-20">
    <h2 class="text-xl font-bold m-0">{{ t('ledger.title') }}</h2>

    <!-- 今日概览 -->
    <section class="card rounded-2xl p-5 flex gap-4">
      <div class="flex-1">
        <div class="text-xs text-fg-faint">{{ t('ledger.todayIncome') }}</div>
        <div class="text-2xl font-bold text-green-500">+¥{{ fmt(store.todayIncome) }}</div>
      </div>
      <div class="flex-1">
        <div class="text-xs text-fg-faint">{{ t('ledger.todayExpense') }}</div>
        <div class="text-2xl font-bold text-red-500">-¥{{ fmt(store.todayExpense) }}</div>
      </div>
    </section>

    <!-- 本周/本月汇总（受设置开关控制，默认隐藏） -->
    <section
      v-if="settings.ledgerShowSummary"
      class="card rounded-2xl p-5 grid grid-cols-2 sm:grid-cols-4 gap-4"
    >
      <div>
        <div class="text-xs text-fg-faint">{{ t('ledger.weekIncome') }}</div>
        <div class="text-lg font-semibold text-green-500">+¥{{ fmt(store.weekIncome) }}</div>
      </div>
      <div>
        <div class="text-xs text-fg-faint">{{ t('ledger.weekExpense') }}</div>
        <div class="text-lg font-semibold text-red-500">-¥{{ fmt(store.weekExpense) }}</div>
      </div>
      <div>
        <div class="text-xs text-fg-faint">{{ t('ledger.monthIncome') }}</div>
        <div class="text-lg font-semibold text-green-500">+¥{{ fmt(store.monthIncome) }}</div>
      </div>
      <div>
        <div class="text-xs text-fg-faint">{{ t('ledger.monthExpense') }}</div>
        <div class="text-lg font-semibold text-red-500">-¥{{ fmt(store.monthExpense) }}</div>
      </div>
    </section>

    <!-- 记一笔 -->
    <section class="card rounded-2xl p-5 space-y-3">
      <div class="font-semibold text-sm">{{ t('ledger.addTitle') }}</div>
      <div class="seg inline-flex p-1 rounded-xl gap-1" role="radiogroup" :aria-label="t('ledger.type')">
        <button
          v-for="opt in (['income', 'expense'] as TxType[])"
          :key="opt"
          @click="switchType(opt)"
          role="radio"
          :aria-checked="form.type === opt ? 'true' : 'false'"
          class="seg-item flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm cursor-pointer border-none"
          :class="form.type === opt ? 'seg-active' : ''"
        >
          {{ opt === 'income' ? t('ledger.typeIncome') : t('ledger.typeExpense') }}
        </button>
      </div>
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <label class="field">
          <span class="field-label">{{ t('ledger.category') }}</span>
          <div class="flex flex-wrap gap-1.5 pt-0.5">
            <button
              v-for="c in categories"
              :key="c"
              type="button"
              class="cat-chip px-2.5 py-1 text-xs rounded-full cursor-pointer"
              :class="form.category === c ? 'cat-chip-active' : ''"
              @click="form.category = c"
            >
              {{ c }}
            </button>
          </div>
        </label>
        <label class="field">
          <span class="field-label">{{ t('ledger.amount') }}</span>
          <input
            v-model="form.amount"
            type="number"
            min="0"
            step="0.01"
            inputmode="decimal"
            class="input-modern w-full px-3 py-2 text-sm"
            :placeholder="t('ledger.amountPlaceholder')"
          />
        </label>
        <label class="field">
          <span class="field-label">{{ t('ledger.date') }}</span>
          <input v-model="form.date" type="date" class="input-modern w-full px-3 py-2 text-sm" />
        </label>
        <label class="field">
          <span class="field-label">{{ t('ledger.note') }}</span>
          <input
            v-model="form.note"
            class="input-modern w-full px-3 py-2 text-sm"
            :placeholder="t('ledger.notePlaceholder')"
          />
        </label>
      </div>
      <button class="btn-primary px-4 py-2 rounded-xl text-sm w-full sm:w-auto" @click="save">
        {{ t('ledger.save') }}
      </button>
    </section>

    <!-- 收支记录 -->
    <section class="card rounded-2xl p-5">
      <div class="flex items-center justify-between mb-3">
        <div class="font-semibold text-sm">{{ t('ledger.records') }}</div>
        <button class="text-xs text-brand cursor-pointer" @click="showAll = !showAll">
          {{ showAll ? t('ledger.viewRecent') : t('ledger.viewAll') }}
        </button>
      </div>
      <p v-if="records.length === 0" class="text-sm text-fg-faint m-0">{{ t('ledger.empty') }}</p>
      <ul v-else class="space-y-2">
        <li
          v-for="tx in records"
          :key="tx.id"
          class="flex items-center gap-3 px-3 py-2 rounded-xl bg-bg"
        >
          <div class="flex-1 min-w-0">
            <div class="text-sm font-medium truncate">{{ tx.category }}</div>
            <div class="text-xs text-fg-faint">
              {{ tx.date }}<span v-if="tx.note"> · {{ tx.note }}</span>
            </div>
          </div>
          <div class="font-semibold" :class="tx.type === 'income' ? 'text-green-500' : 'text-red-500'">
            {{ sign(tx.type) }}¥{{ fmt(tx.amount) }}
          </div>
          <button
            class="del-btn text-fg-faint hover:text-red-500 cursor-pointer bg-transparent border-none"
            :aria-label="t('ledger.deleteAria')"
            @click="del(tx)"
          >
            <span class="i-carbon-trash-can text-base" />
          </button>
        </li>
      </ul>
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

.seg {
  background: var(--c-bg);
  border: 1px solid var(--c-border);
}
.seg-item {
  background: transparent;
  color: var(--c-fg-soft);
  transition: color 0.15s ease, background-color 0.15s ease, box-shadow 0.15s ease;
}
.seg-item:hover {
  color: var(--c-fg);
}
.seg-active {
  background: var(--c-surface);
  color: var(--c-brand-strong);
  font-weight: 600;
  box-shadow: var(--shadow-sm);
}
.dark .seg-active {
  color: var(--c-brand);
}

/* 分类 chips（预设 + 切换选中态） */
.cat-chip {
  background: var(--c-bg);
  border: 1px solid var(--c-border);
  color: var(--c-fg-soft);
  transition: border-color 0.15s ease, color 0.15s ease, background-color 0.15s ease;
}
.cat-chip:hover {
  border-color: var(--c-brand);
  color: var(--c-fg);
}
.cat-chip-active {
  background: var(--c-brand-soft);
  border-color: var(--c-brand);
  color: var(--c-brand-strong);
  font-weight: 600;
}
.dark .cat-chip-active {
  color: var(--c-brand);
}
</style>
