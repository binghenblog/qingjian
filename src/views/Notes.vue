<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import MarkdownIt from 'markdown-it'
import { useNoteStore } from '@/stores/notes'

const store = useNoteStore()
const md = new MarkdownIt({ html: false, linkify: true, typographer: true, breaks: true })

const mode = ref<'edit' | 'preview' | 'split'>('edit')
const search = ref('')
const tagDraft = ref('')

const filtered = computed(() => {
  const q = search.value.trim().toLowerCase()
  if (!q) return store.notes
  return store.notes.filter(
    (n) => n.title.toLowerCase().includes(q) || n.content.toLowerCase().includes(q)
  )
})

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
  await store.create()
}

async function del() {
  if (store.current) await store.remove(store.current.id)
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
  <div class="notes-page h-full grid grid-cols-[280px_1fr] gap-5 -m-6 p-6">
    <!-- 左：笔记列表 -->
    <aside class="list-panel flex flex-col rounded-2xl overflow-hidden">
      <div class="p-3 border-b border-border space-y-2.5">
        <div class="flex items-center gap-2">
          <div class="search-box flex items-center gap-2 px-3 flex-1">
            <span class="i-carbon-search text-fg-faint text-sm" />
            <input
              v-model="search"
              placeholder="搜索笔记…"
              class="flex-1 py-1.5 bg-transparent outline-none text-sm placeholder:text-fg-faint"
            />
          </div>
          <button
            @click="newNote"
            class="btn-primary w-9 h-9 rounded-xl grid place-items-center shrink-0"
            title="新建笔记"
          >
            <span class="i-carbon-add text-lg" />
          </button>
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
            <span class="font-medium text-sm truncate">{{ n.title || '无标题笔记' }}</span>
            <span class="text-[10px] text-fg-faint shrink-0">{{ fmt(n.updatedAt) }}</span>
          </div>
          <div class="text-xs text-fg-faint mt-0.5 truncate">
            {{ n.content.replace(/[#>*`\-]/g, '').slice(0, 40) || '空白笔记' }}
          </div>
          <div v-if="n.tags.length" class="flex flex-wrap gap-1 mt-1.5">
            <span v-for="t in n.tags" :key="t" class="mini-tag">{{ t }}</span>
          </div>
        </li>
        <li v-if="filtered.length === 0" class="text-center text-sm text-fg-faint py-10 px-3">
          {{ search ? '没有匹配的笔记' : '还没有笔记，点右上角 + 新建' }}
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
