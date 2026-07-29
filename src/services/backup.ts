import { storage, type NoteRecord } from './storage'
import type { TodoRecord } from '@/types'

/**
 * 青简全量备份 / 恢复（M4）
 * - 导出：笔记（IndexedDB）+ 待办 / 分类 / 笔记文件夹 / 设置（localStorage）→ 单个 JSON 文件
 * - 导入：校验格式后合并或覆盖写回
 * - 安全：AI API Key 默认不导出（避免备份文件泄露密钥）
 */

const BACKUP_VERSION = 1

/** 参与备份的 localStorage key（不含 API Key 所在的 settings，settings 单独脱敏处理） */
const LS_KEYS = {
  todos: 'qingjian.todos',
  todoCategories: 'qingjian.todo-categories',
  noteFolders: 'qingjian.note-folders',
  settings: 'qingjian.settings',
  theme: 'qj-theme'
} as const

export interface BackupFile {
  app: 'qingjian'
  version: number
  exportedAt: number
  notes: NoteRecord[]
  todos: TodoRecord[]
  todoCategories: string[]
  noteFolders: string[]
  /** 设置（已脱敏，不含 aiApiKey） */
  settings: Record<string, unknown> | null
  theme: string | null
}

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

/** 生成备份对象 */
export async function createBackup(): Promise<BackupFile> {
  const notes = await storage.listNotes()
  const settings = readJson<Record<string, unknown> | null>(LS_KEYS.settings, null)
  // 脱敏：API Key 不随备份导出（新版设置已不含 Key，此处兜底剥离旧字段）
  const safeSettings = settings ? { ...settings, aiApiKey: undefined } : null
  if (safeSettings) delete safeSettings.aiApiKey

  return {
    app: 'qingjian',
    version: BACKUP_VERSION,
    exportedAt: Date.now(),
    notes,
    todos: readJson<TodoRecord[]>(LS_KEYS.todos, []),
    todoCategories: readJson<string[]>(LS_KEYS.todoCategories, []),
    noteFolders: readJson<string[]>(LS_KEYS.noteFolders, []),
    settings: safeSettings,
    theme: localStorage.getItem(LS_KEYS.theme)
  }
}

/** 导出为下载文件：qingjian-backup-YYYYMMDD-HHmm.json */
export async function exportToFile(): Promise<void> {
  const backup = await createBackup()
  const d = new Date(backup.exportedAt)
  const pad = (n: number) => String(n).padStart(2, '0')
  const name = `qingjian-backup-${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}.json`

  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  URL.revokeObjectURL(url)
}

/** 校验备份文件结构；返回错误信息（null = 通过） */
export function validateBackup(data: unknown): string | null {
  if (!data || typeof data !== 'object') return '文件内容不是有效的 JSON 对象'
  const b = data as Partial<BackupFile>
  if (b.app !== 'qingjian') return '不是青简的备份文件（缺少 app 标识）'
  if (typeof b.version !== 'number') return '备份文件缺少版本号'
  if (b.version > BACKUP_VERSION) return `备份版本 v${b.version} 高于当前支持的 v${BACKUP_VERSION}，请升级应用`
  if (!Array.isArray(b.notes) || !Array.isArray(b.todos)) return '备份数据不完整（notes / todos 缺失）'
  return null
}

export type ImportMode = 'merge' | 'replace'

export interface ImportResult {
  notes: number
  todos: number
}

/**
 * 导入备份。
 * - merge：笔记按 id 合并（同 id 取 updatedAt 较新者），待办按 id 去重合并，分类/文件夹取并集
 * - replace：清空后整体写入
 * 设置与主题仅在 replace 时恢复（不覆盖现有 API Key）。
 */
export async function importBackup(backup: BackupFile, mode: ImportMode): Promise<ImportResult> {
  /* ---------- 笔记（IndexedDB） ---------- */
  const incomingNotes = backup.notes.map((n) => ({
    ...n,
    folder: typeof n.folder === 'string' ? n.folder : '',
    tags: Array.isArray(n.tags) ? n.tags : []
  }))

  if (mode === 'replace') {
    // 原子替换：清空 + 写入同一事务，中途失败自动回滚，不会出现「清空了却没写进去」（审查 H-5）
    await storage.replaceAllNotes(incomingNotes)
  } else {
    const existing = new Map((await storage.listNotes()).map((n) => [n.id, n]))
    const toSave = incomingNotes.filter((n) => {
      const old = existing.get(n.id)
      return !old || n.updatedAt >= old.updatedAt
    })
    await storage.saveNotes(toSave)
  }

  /* ---------- 待办 / 分类 / 文件夹（localStorage） ---------- */
  const write = (key: string, v: unknown) => localStorage.setItem(key, JSON.stringify(v))

  if (mode === 'replace') {
    write(LS_KEYS.todos, backup.todos)
    write(LS_KEYS.todoCategories, backup.todoCategories ?? [])
    write(LS_KEYS.noteFolders, backup.noteFolders ?? [])
    if (backup.settings) {
      // 剥离旧版备份可能带的 aiApiKey 字段（新版 Key 单独存储，不受导入影响）
      const incoming = { ...backup.settings }
      delete incoming.aiApiKey
      write(LS_KEYS.settings, incoming)
    }
    if (backup.theme) localStorage.setItem(LS_KEYS.theme, backup.theme)
  } else {
    const curTodos = readJson<TodoRecord[]>(LS_KEYS.todos, [])
    const ids = new Set(curTodos.map((t) => t.id))
    const merged = [...curTodos, ...backup.todos.filter((t) => !ids.has(t.id))]
    write(LS_KEYS.todos, merged)

    const mergeList = (key: string, incoming: string[] | undefined) => {
      const cur = readJson<string[]>(key, [])
      write(key, [...new Set([...cur, ...(incoming ?? [])])])
    }
    mergeList(LS_KEYS.todoCategories, backup.todoCategories)
    mergeList(LS_KEYS.noteFolders, backup.noteFolders)
  }

  return { notes: incomingNotes.length, todos: backup.todos.length }
}

/** 从用户选择的文件读取并解析备份 */
export function readBackupFile(file: File): Promise<BackupFile> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const data = JSON.parse(String(reader.result))
        const err = validateBackup(data)
        err ? reject(new Error(err)) : resolve(data as BackupFile)
      } catch {
        reject(new Error('文件不是有效的 JSON'))
      }
    }
    reader.onerror = () => reject(new Error('文件读取失败'))
    reader.readAsText(file)
  })
}
