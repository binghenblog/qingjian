<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import MarkdownIt from 'markdown-it'
import { useNoteStore } from '@/stores/notes'

const store = useNoteStore()
const md = new MarkdownIt({ html: false, linkify: true, typographer: true, breaks: true })

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
  await store.removeFolder(name)
  if (activeFolder.value === name) activeFolder.value = '__all'
}

/** 是否有未分类笔记（有才显示「未分类」chip） */
const hasUncategorized = computed(() => (store.folderCounts[''] ?? 0) > 0)

/** 列表：搜索时全库全文搜索（忽略文件夹）；否则按当前文件夹过滤 */
const searching = computed(() => search.value.trim().length > 0)

const searchResults = computed(() => (searching.value ? store.searchNotes(search.value) : []))

const filtered = computed(() => {
  if (searching.value) return searchResults.value.map((r) => r.note)
  if (activeFolder.value === '__all') return store.notes
  return store.notes.filter((n) => (n.folder || '') === activeFolder.value)
})

/** 搜索摘要（含高亮）：id -> html */
const snippetMap = computed(() => {
  const map: Record<string, string> = {}
  for (const r of searchResults.value) map[r.note.id] = highlight(r.snippet, search.value.trim())
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
  return searching.value ? highlight(title || '无标题笔记', search.value.trim()) : escapeHtml(title || '无标题笔记')
}

const rendered = computed(() => (store.current ? md.render(store.current.content || '') : ''))

/** 自动保存（防抖 500ms） */
let timer: number | undefined
watch(
  () => [store.current?.title, store.current?.content],
  () => {
    if (!store.current) return
    clearTimeout(timer)
    timer = window.setTimeout(() => {
      const c = store.current
      if (c) store.update(c.id, { title: c.title, content: c.content })
    }, 500)
  }
)

function fmt(ts: number) {
  return new Date(ts).toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric' })
}

async function newNote() {
  // 在当前文件夹里新建（全部/搜索状态下建到未分类）
  const folder = activeFolder.value === '__all' ? '' : activeFolder.value
  await store.create(folder)
}

async function del() {
  if (store.current) await store.remove(store.current.id)
}

function onMoveFolder(e: Event) {
  const v = (e.target as HTMLSelectElement).value
  if (store.current) store.moveToFolder(store.current.id, v)
}

function addTag() {
  const t = tagDraft.value.trim()
  if (!t || !store.current) return
  if (!store.current.tags.includes(t)) store.current.tags.push(t)
  tagDraft.value = ''
  persistTags()
}
function removeTag(t: string) {
  if (!store.current) return
  store.current.tags = store.current.tags.filter((x) => x !== t)
  persistTags()
}
function persistTags() {
  if (store.current) store.update(store.current.id, { tags: store.current.tags })
}

onMounted(() => {
  if (!store.loaded) store.load()
})
</script>

<template>
  <div class="notes-page h-full grid grid-cols-[300px_1fr] gap-5 -m-6 p-6">
    <!-- 左：笔记列表 -->
    <aside class="list-panel flex flex-col rounded-2xl overflow-hidden">
      <div class="p-3 border-b border-border space-y-2.5">
        <div class="flex items-center gap-2.5">
          <div class="search-box h-9 flex items-center gap-2 px-3 flex-1 min-w-0">
            <span class="i-carbon-search text-fg-faint text-sm shrink-0" />
            <input
              v-model="search"
              placeholder="全文搜索标题、内容、标签…"
              class="flex-1 min-w-0 bg-transparent outline-none text-sm placeholder:text-fg-faint"
            />
            <button
              v-if="search"
              @click="search = ''"
              class="clear-btn text-fg-faint hover:text-fg text-xs shrink-0 cursor-pointer"
            >✕</button>
          </div>
          <button
            @click="newNote"
            class="new-btn w-9 h-9 flex items-center justify-center shrink-0 cursor-pointer"
            title="新建笔记"
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
            全部
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
              class="chip-del hidden group-hover:inline text-fg-faint hover:text-red-500"
              title="删除文件夹（笔记归入未分类）"
            >×</span>
          </button>
          <button
            v-if="hasUncategorized"
            @click="activeFolder = ''"
            class="folder-chip"
            :class="{ 'folder-active': activeFolder === '' }"
          >
            <span class="i-carbon-folder-off text-[13px]" />
            未分类
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
            placeholder="名称"
            class="folder-input w-20 text-xs px-2 py-1 rounded-lg outline-none"
          />
          <button v-else @click="startAddFolder" class="folder-chip folder-add" title="新建文件夹">
            <span class="i-carbon-add text-[13px]" />
          </button>
        </div>
        <div v-else class="text-[11px] text-fg-faint px-0.5">
          在全部 {{ store.notes.length }} 条笔记中搜索，共 {{ filtered.length }} 条匹配
        </div>
      </div>

      <ul class="flex-1 overflow-auto p-2 m-0 list-none space-y-1">
        <li
          v-for="n in filtered"
          :key="n.id"
          @click="store.select(n.id)"
          class="note-item px-3 py-2.5 rounded-xl cursor-pointer"
          :class="n.id === store.currentId ? 'note-active' : ''"
        >
          <div class="flex items-center justify-between gap-2">
            <span class="font-medium text-sm truncate" v-html="highlightTitle(n.title)" />
            <span class="text-[10px] text-fg-faint shrink-0">{{ fmt(n.updatedAt) }}</span>
          </div>
          <!-- 搜索时显示匹配片段（高亮），否则显示内容预览 -->
          <div
            v-if="searching && snippetMap[n.id]"
            class="text-xs text-fg-faint mt-0.5 truncate snippet"
            v-html="snippetMap[n.id]"
          />
          <div v-else class="text-xs text-fg-faint mt-0.5 truncate">
            {{ n.content.replace(/[#>*`\-]/g, '').slice(0, 40) || '空白笔记' }}
          </div>
          <div class="flex flex-wrap items-center gap-1 mt-1.5">
            <span v-if="searching && n.folder" class="mini-folder">
              <span class="i-carbon-folder text-[10px]" />{{ n.folder }}
            </span>
            <span v-for="t in n.tags" :key="t" class="mini-tag">{{ t }}</span>
          </div>
        </li>
        <li v-if="filtered.length === 0" class="text-center text-sm text-fg-faint py-10 px-3">
          {{ search ? '没有匹配的笔记' : activeFolder !== '__all' ? '这个文件夹还是空的' : '还没有笔记，点右上角 + 新建' }}
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
            placeholder="无标题笔记"
            class="title-input flex-1 text-lg font-semibold bg-transparent outline-none"
          />
          <!-- 移动到文件夹 -->
          <select
            :value="store.current.folder || ''"
            @change="onMoveFolder"
            class="folder-select text-xs rounded-lg px-2 py-1.5 outline-none cursor-pointer shrink-0"
            title="移动到文件夹"
          >
            <option value="">未分类</option>
            <option v-for="f in store.folders" :key="f" :value="f">{{ f }}</option>
          </select>
          <div class="seg flex items-center rounded-lg p-0.5 shrink-0">
            <button
              v-for="m in (['edit','split','preview'] as const)"
              :key="m"
              @click="mode = m"
              class="seg-btn px-2.5 py-1 text-xs rounded-md cursor-pointer"
              :class="mode === m ? 'seg-active' : ''"
            >
              {{ m === 'edit' ? '编辑' : m === 'split' ? '分屏' : '预览' }}
            </button>
          </div>
          <button
            @click="del"
            class="del-btn w-8 h-8 rounded-lg grid place-items-center text-fg-faint hover:text-red-500 cursor-pointer shrink-0"
            title="删除笔记"
          >
            <span class="i-carbon-trash-can text-base" />
          </button>
        </header>

        <!-- 标签行 -->
        <div class="px-5 py-2 flex items-center gap-1.5 flex-wrap border-b border-border shrink-0">
          <span v-for="t in store.current.tags" :key="t" class="tag-chip">
            {{ t }}
            <button @click="removeTag(t)" class="ml-0.5 text-fg-faint hover:text-red-500">×</button>
          </span>
          <input
            v-model="tagDraft"
            @keyup.enter="addTag"
            @blur="addTag"
            placeholder="+ 标签"
            class="tag-input text-xs bg-transparent outline-none placeholder:text-fg-faint py-1 w-16"
          />
        </div>

        <!-- 编辑区 -->
        <div class="flex-1 overflow-hidden">
          <div v-if="mode === 'edit'" class="h-full">
            <textarea
              :value="store.current.content"
              @input="store.current && (store.current.content = ($event.target as HTMLTextAreaElement).value)"
              placeholder="开始用 Markdown 书写…"
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
              placeholder="开始用 Markdown 书写…"
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
          <h3 class="font-semibold m-0 mb-1.5">笔记本地持久化已就绪</h3>
          <p class="text-sm text-fg-faint m-0 leading-relaxed">
            数据已存入本地 IndexedDB（Dexie），刷新不丢。<br />
            V1 将支持 Obsidian Vault 直连（wikilinks / 标签 / frontmatter）
          </p>
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
  transition: all 0.15s ease;
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
.seg-btn { color: var(--c-fg-soft); transition: all 0.15s ease; }
.seg-active { background: var(--c-surface); color: var(--c-brand-strong); font-weight: 600; box-shadow: var(--shadow-sm); }
.dark .seg-active { color: var(--c-brand); }

.del-btn { background: transparent; border: none; transition: color 0.15s ease, background-color 0.15s ease; }
.del-btn:hover { background: #ef44441a; }

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
