<script setup lang="ts">
import { onMounted, onUnmounted, ref, nextTick, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useQuotesStore, QUOTE_CATEGORIES } from '@/stores/quotes'
import { useToast } from '@/composables/useToast'
import { useConfirm } from '@/composables/useConfirm'
import FloatingActionButton from '@/components/FloatingActionButton.vue'
import { dateKey } from '@/stores/todos'

const { t } = useI18n()
const store = useQuotesStore()
const toast = useToast()
const { confirm } = useConfirm()

const showForm = ref(false)
const draftText = ref('')
const draftCategory = ref('')
const draftDate = ref(dateKey())
const textInput = ref<HTMLTextAreaElement | null>(null)
// 表单展开后聚焦首个输入框（审查 L-10）
watch(showForm, (v) => { if (v) nextTick(() => textInput.value?.focus()) })

onMounted(() => {
  if (!store.loaded) store.load()
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
onUnmounted(() => window.removeEventListener('keydown', onKeydown))

async function submit() {
  const text = draftText.value.trim()
  if (!text) {
    toast.error(t('quote.textRequired'))
    return
  }
  await store.add({
    text,
    category: draftCategory.value.trim() || undefined,
    date: draftDate.value
  })
  draftText.value = ''
  draftCategory.value = ''
  draftDate.value = dateKey()
  showForm.value = false
  toast.success(t('quote.added'))
}

async function removeItem(id: string) {
  const ok = await confirm({
    title: t('quote.confirmDeleteTitle'),
    message: t('quote.confirmDelete'),
    confirmText: t('common.delete'),
    danger: true
  })
  if (ok) await store.remove(id)
}
</script>

<template>
  <div class="space-y-5 max-w-2xl">
    <div class="flex items-baseline justify-between">
      <h2 class="text-xl font-bold m-0">{{ t('quote.title') }}</h2>
      <span class="text-sm text-fg-faint">{{ store.list.length }} {{ t('quote.count') }}</span>
    </div>

    <!-- 添加表单（FAB 唤起） -->
    <section v-if="showForm" class="rounded-2xl p-5 space-y-4 bg-bg border border-brand/20">
      <div class="font-semibold text-sm">{{ t('quote.add') }}</div>
      <div class="space-y-3">
        <label class="block">
          <span class="text-xs text-fg-soft">{{ t('quote.text') }}</span>
          <textarea
            ref="textInput"
            v-model="draftText"
            rows="3"
            :placeholder="t('quote.textPlaceholder')"
            class="input mt-1 w-full resize-none"
          />
        </label>
        <div class="flex items-end gap-3">
          <label class="block flex-1">
            <span class="text-xs text-fg-soft">{{ t('quote.category') }}</span>
            <input
              v-model="draftCategory"
              type="text"
              list="quote-cats"
              :placeholder="t('quote.categoryPlaceholder')"
              class="input mt-1 w-full"
            />
            <datalist id="quote-cats">
              <option v-for="c in QUOTE_CATEGORIES" :key="c" :value="c" />
            </datalist>
          </label>
          <label class="block">
            <span class="text-xs text-fg-soft">{{ t('quote.date') }}</span>
            <input v-model="draftDate" type="date" class="input mt-1" />
          </label>
        </div>
      </div>
      <div class="flex items-center gap-2 justify-end">
        <button class="btn-ghost px-4 py-2 text-sm" @click="showForm = false">
          {{ t('quote.cancel') }}
        </button>
        <button class="btn-primary px-4 py-2 text-sm" @click="submit">
          {{ t('quote.save') }}
        </button>
      </div>
    </section>

    <!-- 好句列表 -->
    <div v-if="store.list.length" class="space-y-4">
      <div
        v-for="q in store.list"
        :key="q.id"
        class="quote-card rounded-2xl p-5"
      >
        <div class="flex items-start justify-between gap-3">
          <div class="text-[11px] text-fg-faint tracking-wide">
            <span v-if="q.category">{{ q.category }} · </span>{{ q.date }}
          </div>
          <button
            class="text-[11px] text-fg-faint hover:text-red-500 bg-transparent border-none cursor-pointer shrink-0"
            @click="removeItem(q.id)"
          >
            {{ t('common.delete') }}
          </button>
        </div>
        <p class="quote-text mt-2 mb-0 leading-relaxed">{{ q.text }}</p>
      </div>
    </div>
    <p v-else class="text-sm text-fg-faint m-0">{{ t('quote.empty') }}</p>

    <FloatingActionButton :aria-label="t('quote.add')" @click="showForm = true" />
  </div>
</template>

<style scoped>
.quote-card {
  background: var(--c-surface);
  border: 1px solid var(--c-border);
  border-left: 3px solid var(--c-brand);
}
.quote-text {
  font-size: 1rem;
  color: var(--c-fg);
}
</style>
