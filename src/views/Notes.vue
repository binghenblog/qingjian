<script lang="ts">
// 模块级草稿缓存：HMR 热更新时跨组件实例保留未保存编辑，避免开发态丢数据（审查 M-36）
let _pendingSave: { id: string; title: string; content: string } | null = null
let _saveTimer: number | undefined
if (import.meta.hot) {
  const h = import.meta.hot
  if (h.data.pendingSave) _pendingSave = h.data.pendingSave
  if (typeof h.data.saveTimer === 'number') _saveTimer = h.data.saveTimer
  h.dispose((d) => {
    d.pendingSave = _pendingSave
    d.saveTimer = _saveTimer
  })
}
</script>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { useNoteStore } from '@/stores/notes'
import { useAiStore } from '@/stores/ai'
import { useConfirm } from '@/composables/useConfirm'
import { md } from '@/services/markdown'
import { formatNotes } from '@/services/aiContext'

const store = useNoteStore()
const ai = useAiStore()
const router = useRouter()
const { t } = useI18n()
const { confirm } = useConfirm()

const mode = ref<'edit' | 'preview' | 'split'>('edit')
const search = ref('')
const tagDraft = ref('')

/** 当前文件夹筛选：'__all' 全部 / '' 未分类 / 其他 = 文件夹名 */
const activeFolder = ref<string>('__all')

/** 新建文件夹 */
const addingFolder = ref(false)
const folderDraft = ref('')
const folderInputEl = ref<HTMLInputElement>()

function startAddFolder() {
  addingFolder.value = true
  folderDraft.value = ''
  requestAnimationFrame(() => folderInputEl.value?.focus())
}
function confirmAddFolder() {
  const name = folderDraft.value.trim()
  if (name && name.length <= 8 && store.addFolder(name)) {
    activeFolder.value = name
  }
  addingFolder.value = false
  folderDraft.value = ''
}
async function delFolder(name: string) {
  const ok = await confirm({
    title: t('notes.deleteFolderTitle'),
    message: t('notes.deleteFolderMsg', { name }),
    confirmText: t('notes.deleteFolder'),
    danger: true
  })
  if (!ok) return
  await store.removeFolder(name)
  if (activeFolder.value === name) activeFolder.value = '__all'
}

/** 是否有未分类笔记（有才显示「未分类」chip） */
const hasUncategorized = computed(() => (store.folderCounts[''] ?? 0) > 0)

/** 列表：搜索时全库全文搜索（忽略文件夹）；否则按当前文件夹过滤 */
/** 搜索防抖（200ms）：避免每次按键都全库扫描 */
const debouncedSearch = ref('')
let searchTimer: number | undefined
watch(search, (v) => {
  clearTimeout(searchTimer)
  // 清空立即生效，输入才防抖
  if (!v.trim()) {
    debouncedSearch.value = ''
    return
  }
  searchTimer = window.setTimeout(() => (debouncedSearch.value = v), 200)
})

const searching = computed(() => debouncedSearch.value.trim().length > 0)

const searchResults = computed(() =>
  debouncedSearch.value.trim() ? store.searchNotes(debouncedSearch.value) : []
)

const filtered = computed(() => {
  if (searching.value) return searchResults.value.map((r) => r.note)
  if (activeFolder.value === '__all') return store.notes
  return store.notes.filter((n) => (n.folder || '') === activeFolder.value)
})

/** 搜索摘要（含高亮）：id -> html */
const snippetMap = computed(() => {
  const map: Record<string, string> = {}
  for (const r of searchResults.value) map[r.note.id] = highlight(r.snippet, debouncedSearch.value.trim())
  return map
})

function escapeHtml(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

/** 转义后对匹配词加 <mark>（大小写不敏感） */
function highlight(text: string, q: string) {
  const escaped = escapeHtml(text)
  if (!q) return escaped
  const eq = escapeHtml(q).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return escaped.replace(new RegExp(`(${eq})`, 'gi'), '<mark>$1</mark>')
}

function highlightTitle(title: string) {
  return searching.value
    ? highlight(title || t('notes.untitled'), debouncedSearch.value.trim())
    : escapeHtml(title || t('notes.untitled'))
}

const rendered = computed(() => (store.current ? md.render(store.current.content || '') : ''))

/**
 * 自动保存（防抖 500ms）。
 * 修复竞态（审查 H-1）：定时器触发时固定使用触发编辑那一刻的笔记 id 与内容快照，
 * 快速切换笔记不会把 A 的内容写进 B；切换笔记时立即冲刷未保存的修改。
 */
/**
 * 自动保存冲刷（审查 H-13 / M-35）：返回 Promise，调用方可 .catch 避免 unhandled rejection。
 * 真正的草稿状态保存在模块级 _pendingSave（见上方 <script> 块），跨 HMR 实例保留（审查 M-36）。
 */
function flushSave(): Promise<void> {
  clearTimeout(_saveTimer)
  if (!_pendingSave) return Promise.resolve()
  const { id, title, content } = _pendingSave
  _pendingSave = null
  return store.update(id, { title, content }).catch((e) => {
    console.error('[notes] 自动保存失败', e)
  })
}

let watchedId: string | null = null
/** Tauri 窗口关闭监听的取消函数（审查 M-2） */
let unlistenClose: (() => void) | undefined
watch(
  () => [store.current?.id, store.current?.title, store.current?.content] as const,
  () => {
    const c = store.current
    if (!c) {
      watchedId = null
      return
    }
    // 切换笔记：冲刷上一篇未保存的修改，但「选中」本身不算编辑，不触发保存
    if (c.id !== watchedId) {
      void flushSave()
      watchedId = c.id
      return
    }
    _pendingSave = { id: c.id, title: c.title, content: c.content }
    clearTimeout(_saveTimer)
    _saveTimer = window.setTimeout(flushSave, 500)
  }
)

/** 窗口/页面关闭前尽量冲刷未保存编辑（审查 H-13）：WebView 直接销毁时 onUnmounted 可能来不及执行 */
function beforeUnloadFlush() {
  void flushSave()
}

onUnmounted(() => {
  void flushSave()
  clearTimeout(searchTimer)
  window.removeEventListener('beforeunload', beforeUnloadFlush)
  unlistenClose?.()
})

function fmt(ts: number) {
  return new Date(ts).toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric' })
}

async function newNote() {
  // 在当前文件夹里新建（全部/搜索状态下建到未分类）
  const folder = activeFolder.value === '__all' ? '' : activeFolder.value
  await store.create(folder)
}

async function del() {
  if (
    store.current &&
    (await confirm({
      title: t('notes.deleteNoteTitle'),
      message: t('notes.deleteNoteMsg', { title: store.current.title || t('notes.untitled') }),
      confirmText: t('notes.deleteNote'),
      danger: true
    }))
  ) {
    await store.remove(store.current.id)
  }
}

function onMoveFolder(e: Event) {
  const v = (e.target as HTMLSelectElement).value
  if (store.current) store.moveToFolder(store.current.id, v)
}

/** 用 AI 讨论当前笔记：把笔记内容作为上下文发起一次 AI 对话 */
async function discussWithAI() {
  const n = store.current
  if (!n) return
  const body = formatNotes([n])
  if (!body) return
  router.push('/ai')
  await ai.askWithContext({
    instruction: t('ai.cmd.discussNoteInstr'),
    context: `${t('ai.cmd.notePreamble')}\n\n${body}`,
    sessionTitle: n.title || t('notes.untitled')
  })
}

/**
 * 标签增删统一走 store.update（审查 M-2）：不再先 mutate 响应式数组再持久化，
 * 由 update 在内存与磁盘间原子提交（失败自动回滚），避免两者不一致。
 */
function addTag() {
  const t = tagDraft.value.trim()
  if (!t || !store.current) return
  if (store.current.tags.includes(t)) {
    tagDraft.value = ''
    return
  }
  tagDraft.value = ''
  store.update(store.current.id, { tags: [...store.current.tags, t] })
}
function removeTag(t: string) {
  if (!store.current) return
  store.update(store.current.id, { tags: store.current.tags.filter((x) => x !== t) })
}

onMounted(() => {
  if (!store.loaded) store.load()
  window.addEventListener('beforeunload', beforeUnloadFlush)
  // 桌面端：窗口关闭事件由 Tauri 派发，WebView 销毁前主动冲刷（审查 H-13）
  // 保存 unlisten，避免组件重复挂载时监听器累积（审查 M-2）
  const w = window as unknown as { __TAURI__?: unknown }
  if (w.__TAURI__) {
    import('@tauri-apps/api/event')
      .then(({ listen }) =>
        listen('tauri://close-requested', () => void flushSave()).then((un) => {
          unlistenClose = un
        })
      )
      .catch(() => {})
  }
})
</script>

<template>
  <div class="notes-page h-full grid grid-cols-1 md:grid-cols-[260px_1fr] lg:grid-cols-[300px_1fr] gap-5 -m-4 md:-m-6 p-4 md:p-6">
    <!-- IndexedDB 不可用时的降级提示（审查 H-8），避免无限白屏 -->
    <div
      v-if="store.loadError"
      class="md:col-span-2 db-banner flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm"
      role="alert"
    >
      <span class="i-carbon-warning-alt text-base shrink-0" />
      <span>{{ t('notes.dbError', { err: store.loadError }) }}</span>
    </div>
    <!-- 左：笔记列表 -->
    <aside class="list-panel flex flex-col rounded-2xl overflow-hidden">
      <div class="p-3 border-b border-border space-y-2.5">
        <div class="flex items-center gap-2.5">
          <div class="search-box h-9 flex items-center gap-2 px-3 flex-1 min-w-0">
            <span class="i-carbon-search text-fg-faint text-sm shrink-0" />
            <input
              v-model="search"
              :placeholder="t('notes.searchPlaceholder')"
              class="flex-1 min-w-0 bg-transparent outline-none text-sm placeholder:text-fg-faint"
            />
            <button
              v-if="search"
              @click="search = ''"
              class="clear-btn text-fg-faint hover:text-fg text-xs shrink-0 cursor-pointer"
              :aria-label="t('notes.clearSearch')"
            >✕</button>
          </div>
          <button
            @click="newNote"
            class="new-btn w-9 h-9 flex items-center justify-center shrink-0 cursor-pointer"
            :title="t('notes.newNote')"
            :aria-label="t('notes.newNote')"
          >
            <span class="i-carbon-add text-lg leading-none" />
          </button>
        </div>

        <!-- 文件夹栏（搜索时隐藏，搜索是全库范围） -->
        <div v-if="!searching" class="flex flex-wrap gap-1.5 items-center">
          <button
            @click="activeFolder = '__all'"
            class="folder-chip"
            :class="{ 'folder-active': activeFolder === '__all' }"
          >
            <span class="i-carbon-folder text-[13px]" />
            {{ t('notes.folderAll') }}
            <span class="chip-count">{{ store.notes.length }}</span>
          </button>
          <button
            v-for="f in store.folders"
            :key="f"
            @click="activeFolder = f"
            class="folder-chip group"
            :class="{ 'folder-active': activeFolder === f }"
          >
            <span class="i-carbon-folder text-[13px]" />
            {{ f }}
            <span class="chip-count">{{ store.folderCounts[f] ?? 0 }}</span>
            <span
              @click.stop="delFolder(f)"
              @keydown.enter.stop.prevent="delFolder(f)"
              role="button"
              tabindex="0"
              class="chip-del hidden group-hover:inline text-fg-faint hover:text-red-500"
              :title="t('notes.deleteFolder')"
              :aria-label="t('notes.deleteFolder')"
            >×</span>
          </button>
          <button
            v-if="hasUncategorized"
            @click="activeFolder = ''"
            class="folder-chip"
            :class="{ 'folder-active': activeFolder === '' }"
          >
            <span class="i-carbon-folder-off text-[13px]" />
            {{ t('notes.folderUncategorized') }}
            <span class="chip-count">{{ store.folderCounts[''] ?? 0 }}</span>
          </button>
          <!-- 新建文件夹 -->
          <input
            v-if="addingFolder"
            ref="folderInputEl"
            v-model="folderDraft"
            @keyup.enter="confirmAddFolder"
            @keyup.esc="addingFolder = false"
            @blur="confirmAddFolder"
            maxlength="8"
            :placeholder="t('notes.folderNamePlaceholder')"
            class="folder-input w-20 text-xs px-2 py-1 rounded-lg outline-none"
          />
          <button v-else @click="startAddFolder" class="folder-chip folder-add" :title="t('notes.newFolder')" :aria-label="t('notes.newFolder')">
            <span class="i-carbon-add text-[13px]" />
          </button>
        </div>
        <div v-else class="text-[11px] text-fg-faint px-0.5" aria-live="polite">
          {{ t('notes.searchCount', { total: store.notes.length, matched: filtered.length }) }}
        </div>
      </div>

      <ul class="flex-1 overflow-auto p-2 m-0 list-none space-y-1">
        <li
          v-for="n in filtered"
          :key="n.id"
          @click="store.select(n.id)"
          @keydown.enter="store.select(n.id)"
          @keydown.space.prevent="store.select(n.id)"
          role="button"
          tabindex="0"
          :aria-current="n.id === store.currentId ? 'true' : undefined"
          :title="n.title + (n.content ? ' — ' + n.content.slice(0, 80) : '')"
          class="note-item px-3 py-2.5 rounded-xl cursor-pointer"
          :class="n.id === store.currentId ? 'note-active' : ''"
        >
          <div class="flex items-center justify-between gap-2">
            <span class="font-medium text-sm truncate" :title="n.title" v-html="highlightTitle(n.title)" />
            <span class="text-[10px] text-fg-faint shrink-0">{{ fmt(n.updatedAt) }}</span>
          </div>
          <!-- 搜索时显示匹配片段（高亮），否则显示内容预览 -->
          <div
            v-if="searching && snippetMap[n.id]"
            class="text-xs text-fg-faint mt-0.5 truncate snippet"
            v-html="snippetMap[n.id]"
          />
          <div v-else class="text-xs text-fg-faint mt-0.5 truncate">
            {{ n.content.replace(/[#>*`\-]/g, '').slice(0, 40) || t('notes.blankNote') }}
          </div>
          <div class="flex flex-wrap items-center gap-1 mt-1.5">
            <span v-if="searching && n.folder" class="mini-folder">
              <span class="i-carbon-folder text-[10px]" />{{ n.folder }}
            </span>
            <span v-for="tg in n.tags" :key="tg" class="mini-tag">{{ tg }}</span>
          </div>
        </li>
        <li v-if="filtered.length === 0" class="text-center text-sm text-fg-faint py-10 px-3">
          {{ search ? t('notes.emptyNoMatch') : activeFolder !== '__all' ? t('notes.emptyFolder') : t('notes.emptyNone') }}
        </li>
      </ul>
    </aside>

    <!-- 右：编辑器 -->
    <section class="editor-panel rounded-2xl flex flex-col overflow-hidden">
      <template v-if="store.current">
        <!-- 工具栏 -->
        <header class="px-5 py-3 border-b border-border flex items-center gap-3 shrink-0">
          <input
            :value="store.current.title"
            @input="store.current && (store.current.title = ($event.target as HTMLInputElement).value)"
            :placeholder="t('notes.untitled')"
            class="title-input flex-1 text-lg font-semibold bg-transparent outline-none"
          />
          <!-- 移动到文件夹 -->
          <select
            :value="store.current.folder || ''"
            @change="onMoveFolder"
            class="folder-select text-xs rounded-lg px-2 py-1.5 outline-none cursor-pointer shrink-0"
            :title="t('notes.moveToFolder')"
            :aria-label="t('notes.moveToFolder')"
          >
            <option value="">{{ t('notes.folderUncategorized') }}</option>
            <option v-for="f in store.folders" :key="f" :value="f">{{ f }}</option>
          </select>
          <div class="seg flex items-center rounded-lg p-0.5 shrink-0" role="tablist" :aria-label="t('notes.modeAria')">
            <button
              v-for="m in (['edit','split','preview'] as const)"
              :key="m"
              @click="mode = m"
              role="tab"
              :aria-selected="mode === m ? 'true' : 'false'"
              class="seg-btn px-2.5 py-1 text-xs rounded-md cursor-pointer"
              :class="mode === m ? 'seg-active' : ''"
            >
              {{ m === 'edit' ? t('notes.modeEdit') : m === 'split' ? t('notes.modeSplit') : t('notes.modePreview') }}
            </button>
          </div>
          <button
            @click="discussWithAI"
            class="ai-btn w-8 h-8 rounded-lg grid place-items-center text-fg-faint hover:text-brand cursor-pointer shrink-0"
            :title="t('ai.discussNote')"
            :aria-label="t('ai.discussNote')"
          >
            <span class="i-carbon-ai-status text-base" />
          </button>
          <button
            @click="del"
            class="del-btn w-8 h-8 rounded-lg grid place-items-center text-fg-faint hover:text-red-500 cursor-pointer shrink-0"
            :title="t('notes.deleteNote')"
            :aria-label="t('notes.deleteNote')"
          >
            <span class="i-carbon-trash-can text-base" />
          </button>
        </header>

        <!-- 标签行 -->
        <div class="px-5 py-2 flex items-center gap-1.5 flex-wrap border-b border-border shrink-0">
          <span v-for="tg in store.current.tags" :key="tg" class="tag-chip">
            {{ tg }}
            <button @click="removeTag(tg)" class="ml-0.5 text-fg-faint hover:text-red-500" :aria-label="t('notes.removeTag', { tag: tg })">×</button>
          </span>
          <input
            v-model="tagDraft"
            @keyup.enter="addTag"
            @blur="addTag"
            :placeholder="t('notes.addTagPlaceholder')"
            class="tag-input text-xs bg-transparent outline-none placeholder:text-fg-faint py-1 w-16"
          />
        </div>

        <!-- 编辑区 -->
        <div class="flex-1 overflow-hidden">
          <div v-if="mode === 'edit'" class="h-full">
            <textarea
              :value="store.current.content"
              @input="store.current && (store.current.content = ($event.target as HTMLTextAreaElement).value)"
              :placeholder="t('notes.editorPlaceholder')"
              class="editor w-full h-full resize-none outline-none p-5 text-sm leading-relaxed"
            />
          </div>
          <div v-else-if="mode === 'preview'" class="h-full overflow-auto p-5">
            <div class="markdown-body" v-html="rendered" />
          </div>
          <div v-else class="h-full grid grid-cols-2 divide-x divide-border">
            <textarea
              :value="store.current.content"
              @input="store.current && (store.current.content = ($event.target as HTMLTextAreaElement).value)"
              :placeholder="t('notes.editorPlaceholder')"
              class="editor w-full h-full resize-none outline-none p-5 text-sm leading-relaxed"
            />
            <div class="overflow-auto p-5">
              <div class="markdown-body" v-html="rendered" />
            </div>
          </div>
        </div>
      </template>

      <!-- 空状态 -->
      <div v-else class="flex-1 grid place-items-center text-center">
        <div class="max-w-sm px-6">
          <span class="chip inline-grid place-items-center w-14 h-14 rounded-2xl mb-3">
            <span class="i-carbon-document text-2xl text-white" />
          </span>
          <h3 class="font-semibold m-0 mb-1.5">{{ t('notes.emptyTitle') }}</h3>
          <p class="text-sm text-fg-faint m-0 leading-relaxed" v-html="t('notes.emptyHint')" />
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped>
.list-panel {
  background: var(--c-surface);
  border: 1px solid var(--c-border);
  box-shadow: var(--shadow-sm);
}
.editor-panel {
  background: var(--c-surface);
  border: 1px solid var(--c-border);
  box-shadow: var(--shadow-sm);
}

.search-box {
  background: var(--c-bg);
  border: 1px solid var(--c-border);
  border-radius: var(--radius);
  transition: border-color 0.15s ease;
}
.search-box:focus-within { border-color: var(--c-brand); }
.clear-btn { background: transparent; border: none; }

/* 新建按钮：与搜索框同高同圆角，无位移动效避免与边线挤压 */
.new-btn {
  background: var(--c-brand-grad);
  color: #fff;
  border: none;
  border-radius: var(--radius);
  transition: opacity 0.15s ease, box-shadow 0.15s ease;
}
.new-btn:hover { opacity: 0.9; box-shadow: 0 3px 10px var(--c-brand-soft); }
.new-btn:active { opacity: 0.8; }

/* 文件夹 chips */
.folder-chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  padding: 3px 9px;
  border-radius: 999px;
  border: 1px solid var(--c-border);
  background: var(--c-bg);
  color: var(--c-fg-soft);
  cursor: pointer;
  transition: border-color 0.15s ease, color 0.15s ease, background-color 0.15s ease;
}
.folder-chip:hover { border-color: var(--c-brand); color: var(--c-brand-strong); }
.folder-active {
  background: var(--c-brand-soft);
  border-color: var(--c-brand);
  color: var(--c-brand-strong);
  font-weight: 600;
}
.dark .folder-active { color: var(--c-brand); }
.folder-add { padding: 3px 7px; }
.chip-count {
  font-size: 10px;
  color: var(--c-fg-faint);
  font-weight: 400;
}
.folder-active .chip-count { color: inherit; opacity: 0.7; }
.chip-del { margin-left: 1px; line-height: 1; }
.folder-input {
  background: var(--c-bg);
  border: 1px solid var(--c-brand);
  color: var(--c-fg);
}

/* 搜索匹配片段 */
.snippet :deep(mark),
.note-item :deep(mark) {
  background: var(--c-brand-soft);
  color: var(--c-brand-strong);
  border-radius: 3px;
  padding: 0 1px;
  font-weight: 600;
}
.dark .snippet :deep(mark),
.dark .note-item :deep(mark) { color: var(--c-brand); }

.mini-folder {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  font-size: 10px;
  padding: 1px 6px;
  border-radius: 999px;
  background: var(--c-bg);
  border: 1px solid var(--c-border);
  color: var(--c-fg-faint);
}

.note-item { transition: background-color 0.15s ease, border-color 0.15s ease; border: 1px solid transparent; }
.note-item:hover { background: var(--c-surface-hover); }
.note-active {
  background: var(--c-brand-soft);
  border-color: var(--c-brand);
}
.dark .note-active { color: var(--c-fg); }

.mini-tag {
  font-size: 10px;
  padding: 1px 6px;
  border-radius: 999px;
  background: var(--c-brand-soft);
  color: var(--c-brand-strong);
  font-weight: 500;
}
.dark .mini-tag { color: var(--c-brand); }

.title-input { color: var(--c-fg); }

.folder-select {
  background: var(--c-bg);
  border: 1px solid var(--c-border);
  color: var(--c-fg-soft);
  transition: border-color 0.15s ease;
}
.folder-select:hover { border-color: var(--c-brand); }

.seg { background: var(--c-bg); border: 1px solid var(--c-border); }
.seg-btn { color: var(--c-fg-soft); transition: color 0.15s ease, background-color 0.15s ease, box-shadow 0.15s ease; }
.seg-active { background: var(--c-surface); color: var(--c-brand-strong); font-weight: 600; box-shadow: var(--shadow-sm); }
.dark .seg-active { color: var(--c-brand); }

.del-btn { background: transparent; border: none; transition: color 0.15s ease, background-color 0.15s ease; }
.del-btn:hover { background: #ef44441a; }

.ai-btn { background: transparent; border: none; transition: color 0.15s ease, background-color 0.15s ease; }
.ai-btn:hover { background: var(--c-brand-soft); }

.tag-chip {
  display: inline-flex;
  align-items: center;
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 999px;
  background: var(--c-brand-soft);
  color: var(--c-brand-strong);
}
.dark .tag-chip { color: var(--c-brand); }
.tag-input { color: var(--c-fg); }

.editor {
  background: transparent;
  color: var(--c-fg);
  border: none;
  font-family: "JetBrains Mono", "Fira Code", ui-monospace, SFMono-Regular, Menlo, monospace;
}

.chip {
  background: var(--c-brand-grad);
  box-shadow: 0 6px 20px var(--c-brand-soft);
}

/* 数据库降级提示（审查 H-8） */
.db-banner {
  background: #f59e0b14;
  border: 1px solid #f59e0b4d;
  color: #b45309;
}
.dark .db-banner {
  background: #f59e0b1f;
  border-color: #f59e0b40;
  color: #fbbf24;
}

/* Markdown 预览排版 */
.markdown-body {
  color: var(--c-fg);
  font-size: 14px;
  line-height: 1.7;
}
.markdown-body :deep(h1), .markdown-body :deep(h2), .markdown-body :deep(h3) {
  margin: 1.2em 0 0.5em;
  font-weight: 700;
  line-height: 1.3;
}
.markdown-body :deep(h1) { font-size: 1.5em; }
.markdown-body :deep(h2) { font-size: 1.3em; }
.markdown-body :deep(h3) { font-size: 1.15em; }
.markdown-body :deep(p) { margin: 0.6em 0; }
.markdown-body :deep(a) { color: var(--c-brand-strong); text-decoration: none; border-bottom: 1px solid var(--c-brand-soft); }
.markdown-body :deep(strong) { font-weight: 700; color: var(--c-fg); }
.markdown-body :deep(code) {
  background: var(--c-bg);
  border: 1px solid var(--c-border);
  border-radius: 5px;
  padding: 1px 5px;
  font-size: 0.88em;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
}
.markdown-body :deep(pre) {
  background: var(--c-bg);
  border: 1px solid var(--c-border);
  border-radius: var(--radius);
  padding: 12px 14px;
  overflow: auto;
}
.markdown-body :deep(pre code) { background: none; border: none; padding: 0; }
.markdown-body :deep(blockquote) {
  margin: 0.8em 0;
  padding: 4px 14px;
  border-left: 3px solid var(--c-brand);
  background: var(--c-brand-soft);
  color: var(--c-fg-soft);
  border-radius: 0 8px 8px 0;
}
.markdown-body :deep(ul), .markdown-body :deep(ol) { padding-left: 1.4em; margin: 0.6em 0; }
.markdown-body :deep(li) { margin: 0.2em 0; }
.markdown-body :deep(hr) { border: none; border-top: 1px solid var(--c-border); margin: 1.2em 0; }
.markdown-body :deep(img) { max-width: 100%; border-radius: var(--radius); }
.markdown-body :deep(table) { border-collapse: collapse; width: 100%; margin: 0.8em 0; }
.markdown-body :deep(th), .markdown-body :deep(td) { border: 1px solid var(--c-border); padding: 6px 10px; text-align: left; }
</style>
