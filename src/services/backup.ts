import { storage, type NoteRecord } from './storage'
import type { TodoRecord } from '@/types'
import { le } from '@/i18n/errors'

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
  const safeSettings: Record<string, unknown> | null = settings
    ? { ...settings, aiApiKey: undefined }
    : null
  if (safeSettings) {
    delete safeSettings.aiApiKey
    // 导出时剥离 aiBaseUrl 的 query string（审查 M-24）：部分服务会把 API Key 拼在 URL 上
    if (typeof safeSettings.aiBaseUrl === 'string') {
      try {
        const u = new URL(safeSettings.aiBaseUrl)
        safeSettings.aiBaseUrl = u.origin + u.pathname
      } catch {
        /* 非法 URL 保持原样，导入端会校验 */
      }
    }
  }

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
  if (!data || typeof data !== 'object') return le('errors.backupNotJson')
  const b = data as Partial<BackupFile>
  if (b.app !== 'qingjian') return le('errors.backupNotQingjian')
  if (typeof b.version !== 'number') return le('errors.backupNoVersion')
  if (b.version > BACKUP_VERSION)
    return le('errors.backupVersionTooNew', { version: b.version, current: BACKUP_VERSION })
  if (!Array.isArray(b.notes) || !Array.isArray(b.todos)) return le('errors.backupIncomplete')
  // 逐元素结构校验（审查 M-19）：缺少 id 会导致 IndexedDB 写入异常
  for (const n of b.notes as unknown[]) {
    if (!n || typeof n !== 'object' || typeof (n as Record<string, unknown>).id !== 'string') {
      return le('errors.backupNoteCorrupt')
    }
  }
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
  // 时间戳兜底（审查 M-20）：非法值（"not-a-date" / null / NaN）回退为 Date.now()，
  // 否则 merge 比较 `NaN >= number` 恒为 false，笔记永远不被合并
  const numTs = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : Date.now())
  const incomingNotes = backup.notes.map((n) => ({
    ...n,
    id: String(n.id),
    folder: typeof n.folder === 'string' ? n.folder : '',
    tags: Array.isArray(n.tags) ? n.tags.filter((t) => typeof t === 'string') : [],
    createdAt: numTs(n.createdAt),
    updatedAt: numTs(n.updatedAt)
  }))

  /** 待办字段兜底（审查 L-31）：非法时间戳 / 损坏字段在写入前归一化，避免污染 UI 或比较永远失败 */
  const PRIORITIES = ['high', 'medium', 'low'] as const
  const sanitizeTodo = (t: TodoRecord): TodoRecord => ({
    ...t,
    id: String(t.id),
    category: typeof t.category === 'string' && t.category ? t.category : '生活',
    priority: PRIORITIES.includes(t.priority as (typeof PRIORITIES)[number]) ? t.priority : 'medium',
    doneDates: Array.isArray(t.doneDates) ? t.doneDates.filter((d) => typeof d === 'string') : undefined,
    completedAt: typeof t.completedAt === 'number' && Number.isFinite(t.completedAt) ? t.completedAt : undefined,
    createdAt: numTs(t.createdAt)
  })

  if (mode === 'replace') {
    // 原子替换：清空 + 写入同一事务，中途失败自动回滚，不会出现「清空了却没写进去」（审查 H-5）
    await storage.replaceAllNotes(incomingNotes)
  } else {
    const existing = new Map((await storage.listNotes()).map((n) => [n.id, n]))
    const toSave = incomingNotes.filter((n) => {
      const old = existing.get(n.id)
      return !old || n.updatedAt >= (old.updatedAt ?? 0)
    })
    await storage.saveNotes(toSave)
  }

  /* ---------- 待办 / 分类 / 文件夹（localStorage） ---------- */
  const write = (key: string, v: unknown) => localStorage.setItem(key, JSON.stringify(v))

  if (mode === 'replace') {
    write(LS_KEYS.todos, backup.todos.map(sanitizeTodo))
    write(LS_KEYS.todoCategories, backup.todoCategories ?? [])
    write(LS_KEYS.noteFolders, backup.noteFolders ?? [])
    if (backup.settings) {
      const cur = readJson<Record<string, unknown> | null>(LS_KEYS.settings, null)
      const incoming = { ...backup.settings }
      delete incoming.aiApiKey
      // 不覆盖用户当前的接口地址，防止恶意备份诱导重定向到攻击者服务器（审查 M-25）
      if (cur?.aiBaseUrl) incoming.aiBaseUrl = cur.aiBaseUrl
      write(LS_KEYS.settings, incoming)
    }
    if (backup.theme) localStorage.setItem(LS_KEYS.theme, backup.theme)
  } else {
    const curTodos = readJson<TodoRecord[]>(LS_KEYS.todos, [])
    const ids = new Set(curTodos.map((t) => t.id))
    const merged = [...curTodos, ...backup.todos.filter((t) => !ids.has(t.id)).map(sanitizeTodo)]
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
    // 超大文件（>50MB）一次性读入内存有溢出风险，先拒绝（审查 M-21）
    if (file.size > 50 * 1024 * 1024) {
      reject(new Error(le('errors.backupTooLarge')))
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const data = JSON.parse(String(reader.result))
        const err = validateBackup(data)
        err ? reject(new Error(err)) : resolve(data as BackupFile)
      } catch {
        reject(new Error(le('errors.backupParse')))
      }
    }
    reader.onerror = () => reject(new Error(le('errors.backupRead')))
    reader.readAsText(file)
  })
}
