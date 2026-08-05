<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useLedgerStore, TX_CATEGORIES } from '@/stores/ledger'
import { useSettingsStore } from '@/stores/settings'
import { useConfirm } from '@/composables/useConfirm'
import { useToast } from '@/composables/useToast'
import { useFab } from '@/composables/useFab'
import { dateKey } from '@/stores/todos'
import BaseModal from '@/components/BaseModal.vue'
import EmptyState from '@/components/EmptyState.vue'
import type { Transaction, TxType } from '@/types'

const { t } = useI18n()
const store = useLedgerStore()
const settings = useSettingsStore()
const { confirm } = useConfirm()
const toast = useToast()
const amountInput = ref<HTMLInputElement>()

// 弹窗可见态 + 移动端 FAB（要求一）
const { setFab, clearFab } = useFab()
const showModal = ref(false)

onMounted(() => {
  if (!store.loaded) store.load()
  setFab(() => (showModal.value = true), t('ledger.addTitle'))
})
onUnmounted(() => clearFab())

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
    <div class="flex items-center justify-between">
      <h2 class="text-xl font-bold m-0">{{ t('ledger.title') }}</h2>
      <!-- PC 端右上角文字新增按钮（要求一.1）；移动端由 FAB 唤起同一弹窗 -->
      <button class="btn-primary hidden lg:inline-flex items-center gap-1 px-3 py-1.5 text-sm rounded-btn" @click="showModal = true">
        <span class="i-carbon-add text-base" />{{ t('ledger.addTitle') }}
      </button>
    </div>

    <!-- 今日概览 -->
    <section class="card rounded-2xl p-5 flex gap-4">
      <div class="flex-1">
        <div class="text-xs text-fg-faint">{{ t('ledger.todayIncome') }}</div>
        <div class="text-2xl font-bold tx-income">+¥{{ fmt(store.todayIncome) }}</div>
      </div>
      <div class="flex-1">
        <div class="text-xs text-fg-faint">{{ t('ledger.todayExpense') }}</div>
        <div class="text-2xl font-bold tx-expense">-¥{{ fmt(store.todayExpense) }}</div>
      </div>
    </section>

    <!-- 本周/本月汇总（受设置开关控制，默认隐藏） -->
    <section
      v-if="settings.ledgerShowSummary"
      class="card rounded-2xl p-5 grid grid-cols-2 sm:grid-cols-4 gap-4"
    >
      <div>
        <div class="text-xs text-fg-faint">{{ t('ledger.weekIncome') }}</div>
        <div class="text-lg font-semibold tx-income">+¥{{ fmt(store.weekIncome) }}</div>
      </div>
      <div>
        <div class="text-xs text-fg-faint">{{ t('ledger.weekExpense') }}</div>
        <div class="text-lg font-semibold tx-expense">-¥{{ fmt(store.weekExpense) }}</div>
      </div>
      <div>
        <div class="text-xs text-fg-faint">{{ t('ledger.monthIncome') }}</div>
        <div class="text-lg font-semibold tx-income">+¥{{ fmt(store.monthIncome) }}</div>
      </div>
      <div>
        <div class="text-xs text-fg-faint">{{ t('ledger.monthExpense') }}</div>
        <div class="text-lg font-semibold tx-expense">-¥{{ fmt(store.monthExpense) }}</div>
      </div>
    </section>

    <!-- 记一笔：移入全局弹窗（要求三）；PC 右上角按钮 / 移动端 FAB 唤起 -->
    <BaseModal v-model="showModal" :title="t('ledger.addTitle')" @save="save">
      <div class="space-y-4">
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <!-- 左：收支切换 / 分类 / 金额 -->
          <div class="space-y-3">
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
              ref="amountInput"
              v-model="form.amount"
              type="number"
              min="0"
              step="0.01"
              inputmode="decimal"
              class="input-modern w-full px-3 py-2 text-sm"
              :placeholder="t('ledger.amountPlaceholder')"
            />
            </label>
          </div>
          <!-- 右：日期 / 备注 -->
          <div class="space-y-3">
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
        </div>
      </div>
    </BaseModal>

    <!-- 收支记录 -->
    <section class="card rounded-2xl p-5">
      <div class="flex items-center justify-between mb-3">
        <div class="font-semibold text-sm">{{ t('ledger.records') }}</div>
        <button class="btn-secondary px-3 py-1.5 text-xs rounded-btn" @click="showAll = !showAll">
          {{ showAll ? t('ledger.viewRecent') : t('ledger.viewAll') }}
        </button>
      </div>
      <EmptyState v-if="records.length === 0" icon="i-carbon-calculator" :title="t('ledger.empty')" />
      <ul v-else class="space-y-2">
        <li
          v-for="tx in records"
          :key="tx.id"
          class="flex items-center gap-3 px-3 py-2 min-h-[52px] rounded-xl bg-bg"
        >
          <div class="flex-1 min-w-0">
            <div class="text-sm font-medium truncate">{{ tx.category }}</div>
            <div class="text-xs text-fg-faint">
              {{ tx.date }}<span v-if="tx.note"> · {{ tx.note }}</span>
            </div>
          </div>
          <div class="font-semibold" :class="tx.type === 'income' ? 'tx-income' : 'tx-expense'">
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

/* 金额色彩：柔和深绿(收入) / 柔和砖红(支出)，避免刺眼大红大绿 */
.tx-income { color: #23856D; }
.tx-expense { color: #C75D4F; }
.dark .tx-income { color: #4caf8e; }
.dark .tx-expense { color: #e08a7d; }

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
  background: var(--c-brand-soft);
  color: var(--c-brand-strong);
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
