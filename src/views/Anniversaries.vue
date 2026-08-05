<script setup lang="ts">
import { onMounted, onUnmounted, ref, nextTick, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAnniversariesStore } from '@/stores/anniversaries'
import { useToast } from '@/composables/useToast'
import { useConfirm } from '@/composables/useConfirm'
import { useFab } from '@/composables/useFab'
import BaseModal from '@/components/BaseModal.vue'
import EmptyState from '@/components/EmptyState.vue'
import { dateKey } from '@/stores/todos'

const { t } = useI18n()
const store = useAnniversariesStore()
const toast = useToast()
const { confirm } = useConfirm()
// 注册全局悬浮新建按钮：本页「新建纪念日」= 打开表单
const { setFab, clearFab } = useFab()

const showForm = ref(false)
const nameInput = ref<HTMLInputElement>()
const draftName = ref('')
const draftNote = ref('')
const draftDate = ref(dateKey())

onMounted(() => {
  if (!store.loaded) store.load()
  setFab(() => { showForm.value = true }, t('anniversary.add'))
})

// 表单打开时聚焦名称输入（审查 L-10）
watch(showForm, async (v) => {
  if (v) {
    await nextTick()
    nameInput.value?.focus()
  }
})

/** Esc 全局关闭表单：焦点不在表单内（如刚点 FAB）时同样生效，与 ConfirmDialog 一致（审查 L-11） */
function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape' && showForm.value) {
    e.preventDefault()
    showForm.value = false
  }
}
watch(showForm, (v) => {
  if (v) window.addEventListener('keydown', onKeydown)
  else window.removeEventListener('keydown', onKeydown)
})
onUnmounted(() => {
  window.removeEventListener('keydown', onKeydown)
  clearFab()
})

function mdLabel(dateStr: string): string {
  const [, m, d] = dateStr.split('-')
  return `${m}-${d}`
}

function countdownLabel(dateStr: string): string {
  const n = store.daysUntil(dateStr)
  if (n === 0) return t('anniversary.today')
  if (n === 1) return t('anniversary.tomorrow')
  return t('anniversary.daysLeft', { n })
}

async function submit() {
  const name = draftName.value.trim()
  if (!name) {
    toast.error(t('anniversary.nameRequired'))
    return
  }
  if (!draftDate.value) {
    toast.error(t('anniversary.dateRequired'))
    return
  }
  await store.add({ name, note: draftNote.value.trim() || undefined, date: draftDate.value })
  draftName.value = ''
  draftNote.value = ''
  draftDate.value = dateKey()
  showForm.value = false
  toast.success(t('anniversary.added'))
}

async function removeItem(id: string, name: string) {
  const ok = await confirm({
    title: t('anniversary.confirmDeleteTitle'),
    message: t('anniversary.confirmDelete', { name }),
    confirmText: t('common.delete'),
    danger: true
  })
  if (ok) await store.remove(id)
}
</script>

<template>
  <div class="space-y-5 max-w-2xl">
    <div class="flex items-baseline justify-between gap-3">
      <h2 class="text-xl font-bold m-0">{{ t('anniversary.title') }}</h2>
      <div class="flex items-center gap-3 shrink-0">
        <span class="text-sm text-fg-faint">{{ store.list.length }} {{ t('anniversary.count') }}</span>
        <!-- PC 端右上角文字新增按钮（要求一.1）；移动端由 FAB 唤起同一弹窗 -->
        <button class="btn-primary hidden lg:inline-flex items-center gap-1 px-3 py-1.5 text-sm rounded-btn" @click="showForm = true">
          <span class="i-carbon-add text-base" />{{ t('anniversary.add') }}
        </button>
      </div>
    </div>

    <!-- 添加表单：移入全局弹窗（要求三），PC 右上角按钮 / 移动端 FAB 均唤起本弹窗 -->
    <BaseModal v-model="showForm" :title="t('anniversary.add')" @save="submit">
      <div class="space-y-4">
        <label class="block">
          <span class="text-xs text-fg-soft">{{ t('anniversary.name') }}</span>
          <input
            v-model="draftName"
            ref="nameInput"
            type="text"
            :placeholder="t('anniversary.namePlaceholder')"
            class="input mt-1 w-full"
            @keyup.enter="submit"
          />
        </label>
        <label class="block">
          <span class="text-xs text-fg-soft">{{ t('anniversary.note') }}</span>
          <input
            v-model="draftNote"
            type="text"
            :placeholder="t('anniversary.notePlaceholder')"
            class="input mt-1 w-full"
          />
        </label>
        <label class="block">
          <span class="text-xs text-fg-soft">{{ t('anniversary.date') }}</span>
          <input v-model="draftDate" type="date" class="input mt-1 w-full" />
        </label>
      </div>
    </BaseModal>

    <!-- 纪念日列表 -->
    <div v-if="store.list.length" class="space-y-3">
      <div
        v-for="a in store.list"
        :key="a.id"
        class="anniversary-card group rounded-2xl p-4 flex items-center gap-4"
      >
        <div class="date-chip w-14 h-14 rounded-xl grid place-items-center text-center shrink-0">
          <div class="leading-none">
            <div class="text-[10px] text-fg-faint">{{ t('anniversary.month') }}</div>
            <div class="text-lg font-bold">{{ mdLabel(a.date).replace('-', '/') }}</div>
          </div>
        </div>
        <div class="flex-1 min-w-0">
          <div class="font-semibold truncate">{{ a.name }}</div>
          <div v-if="a.note" class="text-xs text-fg-soft truncate mt-0.5">{{ a.note }}</div>
        </div>
        <div class="text-right shrink-0">
          <div
            class="text-sm font-medium"
            :class="store.daysUntil(a.date) === 0 ? 'text-brand-strong' : 'text-fg-soft'"
          >
            {{ countdownLabel(a.date) }}
          </div>
          <button
            class="text-[11px] text-fg-faint hover:text-red-500 mt-1 bg-transparent border-none cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity"
            @click="removeItem(a.id, a.name)"
          >
            {{ t('common.delete') }}
          </button>
        </div>
      </div>
    </div>
    <EmptyState v-else icon="i-carbon-calendar" :title="t('anniversary.empty')" />
  </div>
</template>

<style scoped>
.anniversary-card {
  background: var(--c-surface);
  border: 1px solid var(--c-border);
}
.date-chip {
  background: var(--c-brand-soft);
  color: var(--c-brand-strong);
}
</style>
