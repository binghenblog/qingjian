import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { storage, isStorageAvailable, type NoteRecord } from '@/services/storage'
import { le } from '@/i18n/errors'
import { useToast } from '@/composables/useToast'

/** 入库前转纯对象：剥离 Vue 响应式 Proxy，避免 IndexedDB 结构化克隆失败 */
function toPlain(n: NoteRecord): NoteRecord {
  return { ...n, tags: [...n.tags] }
}

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
  /** 加载失败信息（IndexedDB 不可用等），供 UI 降级提示而非白屏（审查 H-8） */
  const loadError = ref<string | null>(null)
  /** 全局通知：让原本「静默无反馈」的写盘失败对用户可见（审查 M-46） */
  const { error: toastError } = useToast()

  /** 用户创建的文件夹（有序） */
  const folders = ref<string[]>(loadFolders())

  function persistFolders() {
    localStorage.setItem(FOLDERS_KEY, JSON.stringify(folders.value))
  }

  async function load() {
    if (loaded.value || loadError.value) return
    if (!isStorageAvailable()) {
      loadError.value = le('errors.idbDisabled')
      return
    }
    try {
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
    } catch (e) {
      // 写盘/读取失败：暴露错误，UI 显示降级提示（审查 H-8），不再卡在加载态
      loadError.value = e instanceof Error ? e.message : le('errors.idbReadFailed')
    }
  }

  /** 重新从 IndexedDB 载入（审查 H-16）：备份导入/外部变更后刷新内存态，避免 UI 显示旧数据 */
  async function reload() {
    loaded.value = false
    loadError.value = null
    folders.value = loadFolders()
    await load()
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

  /** 删除文件夹：其下笔记归为未分类（批量写盘，失败回滚，审查 M-7/H-4） */
  async function removeFolder(name: string) {
    const affected = notes.value.filter((n) => n.folder === name)
    const prevFolders = [...folders.value]
    folders.value = folders.value.filter((f) => f !== name)
    persistFolders()
    affected.forEach((n) => (n.folder = ''))
    try {
      await storage.saveNotes(affected.map(toPlain))
      lastError.value = null
    } catch (e) {
      affected.forEach((n) => (n.folder = name))
      folders.value = prevFolders
      persistFolders()
      const msg = le('errors.removeFolderFailed', { msg: (e as Error).message })
      lastError.value = msg
      toastError(msg)
      throw e
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
    try {
      await storage.saveNote(toPlain(n))
      notes.value.unshift(n)
      currentId.value = n.id
      return n
    } catch (e) {
      // 写盘失败：不污染内存态，回滚（审查 L-39）
      const msg = le('errors.createNoteFailed', { msg: (e as Error).message })
      lastError.value = msg
      toastError(msg)
      throw e
    }
  }

  /** 最近一次持久化失败信息（供 UI 提示） */
  const lastError = ref<string | null>(null)

  async function update(
    id: string,
    patch: Partial<Pick<NoteRecord, 'title' | 'content' | 'tags' | 'folder'>>
  ) {
    const n = notes.value.find((x) => x.id === id)
    if (!n) return
    // 先留快照，写盘失败时回滚内存态，保证内存与磁盘一致（审查 H-4）
    const snapshot = { ...n, tags: [...n.tags] }
    Object.assign(n, patch, { updatedAt: Date.now() })
    try {
      await storage.saveNote(toPlain(n))
      lastError.value = null
    } catch (e) {
      Object.assign(n, snapshot)
      const msg = le('errors.saveFailed', { msg: (e as Error).message })
      lastError.value = msg
      toastError(msg)
      throw e
    }
  }

  async function remove(id: string) {
    const idx = notes.value.findIndex((n) => n.id === id)
    if (idx === -1) return
    try {
      // 先删磁盘，成功后再改内存；磁盘失败则保留内存态并提示，避免「已删」复活（审查 M-1）
      await storage.deleteNote(id)
      notes.value.splice(idx, 1)
      if (currentId.value === id) currentId.value = notes.value[0]?.id ?? null
      lastError.value = null
    } catch (e) {
      const msg = le('errors.deleteNoteFailed', { msg: (e as Error).message })
      lastError.value = msg
      toastError(msg)
      throw e
    }
  }

  /**
   * 撤销删除：把删除前抓取的笔记快照重新插入列表并落盘。
   * 落盘失败时回滚内存态并提示，与 create/update 的失败处理一致。
   */
  async function restore(note: NoteRecord) {
    notes.value = [note, ...notes.value]
    try {
      await storage.saveNote(toPlain(note))
      lastError.value = null
    } catch (e) {
      // 写盘失败：回滚，避免内存里出现「没存上的幽灵笔记」
      notes.value = notes.value.filter((n) => n.id !== note.id)
      const msg = le('errors.saveFailed', { msg: (e as Error).message })
      lastError.value = msg
      toastError(msg)
      throw e
    }
    select(note.id)
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
    loadError,
    lastError,
    folders,
    folderCounts,
    load,
    reload,
    create,
    update,
    remove,
    restore,
    select,
    addFolder,
    removeFolder,
    moveToFolder,
    searchNotes
  }
})
