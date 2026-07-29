import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { storage, type NoteRecord } from '@/services/storage'

const FOLDERS_KEY = 'qingjian.note-folders'

function loadFolders(): string[] {
  try {
    const raw = localStorage.getItem(FOLDERS_KEY)
    if (raw) {
      const arr = JSON.parse(raw)
      if (Array.isArray(arr)) return arr.filter((x) => typeof x === 'string')
    }
  } catch {
    /* ignore */
  }
  return []
}

/** 笔记 Store（M1：Dexie 持久化；M2：文件夹 + 全文搜索） */
export const useNoteStore = defineStore('notes', () => {
  const notes = ref<NoteRecord[]>([])
  const currentId = ref<string | null>(null)
  const loaded = ref(false)

  /** 用户创建的文件夹（有序） */
  const folders = ref<string[]>(loadFolders())

  function persistFolders() {
    localStorage.setItem(FOLDERS_KEY, JSON.stringify(folders.value))
  }

  async function load() {
    notes.value = await storage.listNotes()
    // 兜底：笔记里出现但列表里没有的文件夹（如导入数据），自动补录
    const known = new Set(folders.value)
    let dirty = false
    notes.value.forEach((n) => {
      if (n.folder && !known.has(n.folder)) {
        folders.value.push(n.folder)
        known.add(n.folder)
        dirty = true
      }
    })
    if (dirty) persistFolders()
    loaded.value = true
  }

  const current = computed(() => notes.value.find((n) => n.id === currentId.value) ?? null)

  /** 全部已用过的标签（供联想） */
  const tags = computed(() => [...new Set(notes.value.flatMap((n) => n.tags))])

  /** 各文件夹笔记数（'' = 未分类） */
  const folderCounts = computed(() => {
    const map: Record<string, number> = {}
    notes.value.forEach((n) => {
      const key = n.folder || ''
      map[key] = (map[key] ?? 0) + 1
    })
    return map
  })

  function addFolder(name: string): boolean {
    const n = name.trim()
    if (!n || folders.value.includes(n)) return false
    folders.value.push(n)
    persistFolders()
    return true
  }

  /** 删除文件夹：其下笔记归为未分类 */
  async function removeFolder(name: string) {
    folders.value = folders.value.filter((f) => f !== name)
    persistFolders()
    const affected = notes.value.filter((n) => n.folder === name)
    for (const n of affected) {
      n.folder = ''
      await storage.saveNote({ ...n })
    }
  }

  /** 移动笔记到文件夹（'' = 未分类） */
  async function moveToFolder(id: string, folder: string) {
    await update(id, { folder })
  }

  async function create(folder = '') {
    const now = Date.now()
    const n: NoteRecord = {
      id: crypto.randomUUID(),
      title: '无标题笔记',
      content: '',
      tags: [],
      folder,
      createdAt: now,
      updatedAt: now
    }
    await storage.saveNote(n)
    notes.value.unshift(n)
    currentId.value = n.id
    return n
  }

  async function update(
    id: string,
    patch: Partial<Pick<NoteRecord, 'title' | 'content' | 'tags' | 'folder'>>
  ) {
    const n = notes.value.find((x) => x.id === id)
    if (!n) return
    Object.assign(n, patch, { updatedAt: Date.now() })
    await storage.saveNote({ ...n })
  }

  async function remove(id: string) {
    await storage.deleteNote(id)
    notes.value = notes.value.filter((n) => n.id !== id)
    if (currentId.value === id) currentId.value = notes.value[0]?.id ?? null
  }

  function select(id: string) {
    currentId.value = id
  }

  /**
   * 全文搜索：标题 / 内容 / 标签，返回带匹配片段的结果。
   * 供笔记页与全局命令面板共用。
   */
  function searchNotes(query: string, limit = 50) {
    const q = query.trim().toLowerCase()
    if (!q) return []
    const results: { note: NoteRecord; snippet: string; field: 'title' | 'content' | 'tag' }[] = []
    for (const n of notes.value) {
      if (results.length >= limit) break
      const titleIdx = n.title.toLowerCase().indexOf(q)
      if (titleIdx >= 0) {
        results.push({ note: n, snippet: n.title, field: 'title' })
        continue
      }
      const contentIdx = n.content.toLowerCase().indexOf(q)
      if (contentIdx >= 0) {
        // 截取匹配前后各 24 字符作为摘要片段
        const start = Math.max(0, contentIdx - 24)
        const end = Math.min(n.content.length, contentIdx + q.length + 24)
        const snippet =
          (start > 0 ? '…' : '') +
          n.content.slice(start, end).replace(/\n+/g, ' ') +
          (end < n.content.length ? '…' : '')
        results.push({ note: n, snippet, field: 'content' })
        continue
      }
      const tag = n.tags.find((t) => t.toLowerCase().includes(q))
      if (tag) results.push({ note: n, snippet: `#${tag}`, field: 'tag' })
    }
    return results
  }

  return {
    notes,
    currentId,
    current,
    tags,
    loaded,
    folders,
    folderCounts,
    load,
    create,
    update,
    remove,
    select,
    addFolder,
    removeFolder,
    moveToFolder,
    searchNotes
  }
})
