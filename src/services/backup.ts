import {
  noteRepository,
  chatRepository,
  transactionRepository,
  workoutRepository,
  weightRepository,
  anniversaryRepository,
  quoteRepository,
  todoRepository,
  todoCategoryRepository,
  type NoteRecord
} from '@/db'
import type {
  TodoRecord,
  ChatSession,
  Transaction,
  WorkoutRecord,
  WeightRecord,
  Anniversary,
  Quote
} from '@/types'
import { le } from '@/i18n/errors'
import { useTodoStore, PRESET_CATEGORIES } from '@/stores/todos'
import { useSettingsStore } from '@/stores/settings'
import { useAiStore } from '@/stores/ai'

/**
 * 青简全量备份 / 恢复（M4）
 * - 导出：笔记 / AI 会话 / 待办 / 分类 / 记账 / 健身 / 纪念日 / 记好句
 *   均经数据访问层（IndexedDB / Dexie）→ 单个 JSON 文件；
 *   文件夹 / 设置 / 主题仍存 localStorage，一并打包
 * - 导入：校验格式后合并或覆盖写回
 * - 安全：AI API Key 默认不导出（避免备份文件泄露密钥）
 */

const BACKUP_VERSION = 2

/** 参与备份的 localStorage key（不含 API Key 所在的 settings，settings 单独脱敏处理）。
 * 待办与分类已迁入数据访问层（Dexie），不再经 localStorage，故此处不再列出。 */
const LS_KEYS = {
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
  /** AI 会话（多会话，持久化于本地库）；旧版备份可能不含此字段 */
  chats?: ChatSession[]
  /** 设置（已脱敏，不含 aiApiKey） */
  settings: Record<string, unknown> | null
  theme: string | null
  /** v0.3.0 新增模块数据；旧版备份（version<2）不含这些字段 */
  transactions?: Transaction[]
  workouts?: WorkoutRecord[]
  weights?: WeightRecord[]
  anniversaries?: Anniversary[]
  quotes?: Quote[]
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
  // 导出前先 flush 设置内存态，避免读到尚未落盘的旧数据
  try {
    useSettingsStore().flush()
  } catch {
    /* ignore */
  }

  const notes = await noteRepository.list()
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
    todos: await todoRepository.list(),
    todoCategories: await todoCategoryRepository.list(),
    noteFolders: readJson<string[]>(LS_KEYS.noteFolders, []),
    chats: await chatRepository.listChats(),
    settings: safeSettings,
    theme: localStorage.getItem(LS_KEYS.theme),
    transactions: await transactionRepository.list(),
    workouts: await workoutRepository.list(),
    weights: await weightRepository.list(),
    anniversaries: await anniversaryRepository.list(),
    quotes: await quoteRepository.list()
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
  // chats 为可选项（旧版备份可能不含），存在则必须合法
  if (b.chats !== undefined && !Array.isArray(b.chats)) return le('errors.backupIncomplete')
  // v0.3.0 新增实体为可选项（旧版备份 version<2 不含），存在则必须为数组
  for (const k of ['transactions', 'workouts', 'weights', 'anniversaries', 'quotes'] as const) {
    if (b[k] !== undefined && !Array.isArray(b[k])) return le('errors.backupIncomplete')
  }
  // 逐元素结构校验（审查 M-19）：缺少 id 会导致 IndexedDB 写入异常
  for (const n of b.notes as unknown[]) {
    if (!n || typeof n !== 'object' || typeof (n as Record<string, unknown>).id !== 'string') {
      return le('errors.backupNoteCorrupt')
    }
  }
  // v0.3.0 新增实体逐元素校验：同样要求 id 为字符串，避免 IndexedDB 主键缺失写入异常（审查 M-5 补全）
  for (const k of ['transactions', 'workouts', 'weights', 'anniversaries', 'quotes'] as const) {
    if (!b[k]) continue
    for (const item of b[k] as unknown[]) {
      if (!item || typeof item !== 'object' || typeof (item as Record<string, unknown>).id !== 'string') {
        return le('errors.backupNoteCorrupt')
      }
    }
  }
  return null
}

export type ImportMode = 'merge' | 'replace'

export interface ImportResult {
  notes: number
  todos: number
  transactions: number
  workouts: number
  weights: number
  anniversaries: number
  quotes: number
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
    // 缺 id 生成 uuid，避免 `id:"undefined"` 重复键（审查 M-4）
    id: typeof t.id === 'string' && t.id.trim() ? t.id : crypto.randomUUID(),
    category: typeof t.category === 'string' && t.category ? t.category : '生活',
    priority: PRIORITIES.includes(t.priority as (typeof PRIORITIES)[number]) ? t.priority : 'medium',
    doneDates: Array.isArray(t.doneDates) ? t.doneDates.filter((d) => typeof d === 'string') : undefined,
    completedAt: typeof t.completedAt === 'number' && Number.isFinite(t.completedAt) ? t.completedAt : undefined,
    createdAt: numTs(t.createdAt)
  })

  if (mode === 'replace') {
    // 原子替换：清空 + 写入同一事务，中途失败自动回滚，不会出现「清空了却没写进去」（审查 H-5）
    await noteRepository.replaceAll(incomingNotes)
  } else {
    const existing = new Map((await noteRepository.list()).map((n) => [n.id, n]))
    const toSave = incomingNotes.filter((n) => {
      const old = existing.get(n.id)
      return !old || n.updatedAt >= (old.updatedAt ?? 0)
    })
    await noteRepository.saveMany(toSave)
  }

  /* ---------- AI 会话（本地库，独立表） ---------- */
  const normalizeChat = (c: ChatSession): ChatSession => ({
    id: String(c.id),
    title: typeof c.title === 'string' ? c.title : '',
    createdAt: numTs(c.createdAt),
    updatedAt: numTs(c.updatedAt),
    messages: Array.isArray(c.messages)
      ? c.messages
          .filter(
            (m) =>
              m &&
              (m.role === 'user' || m.role === 'assistant') &&
              typeof m.content === 'string'
          )
          .map((m) => ({ role: m.role, content: m.content }))
      : []
  })
  const incomingChats = (backup.chats ?? []).map(normalizeChat)
  if (mode === 'replace') {
    await chatRepository.replaceAllChats(incomingChats)
  } else {
    const existingChats = new Map((await chatRepository.listChats()).map((c) => [c.id, c]))
    const toSaveChats = incomingChats.filter(
      (c) => !existingChats.has(c.id) || c.updatedAt >= (existingChats.get(c.id)!.updatedAt ?? 0)
    )
    for (const c of toSaveChats) await chatRepository.saveChat(c)
  }

  /* ---------- 待办 / 分类（经数据访问层） ---------- */
  // 仅持久化「自定义分类」部分，预设分类在读取时由 DAL 补充在前（审查 M-4）
  const customOnly = (cats: string[]): string[] => cats.filter((c) => !PRESET_CATEGORIES.includes(c))

  if (mode === 'replace') {
    await todoRepository.replaceAll(backup.todos.map(sanitizeTodo))
    await todoCategoryRepository.save(customOnly(backup.todoCategories ?? []))
  } else {
    // merge：按 id 合并，取时间戳较新者（与笔记 merge 对齐，审查 M-3）
    const curTodos = await todoRepository.list()
    const byId = new Map<string, TodoRecord>(curTodos.map((t) => [t.id, t]))
    // 时间戳：取创建/完成/打卡（doneDates 最大日期）三者较新者（审查 M-6：打卡记录不再被丢弃）
    const ts = (t: TodoRecord) => {
      const base = Math.max(
        numTs(t.createdAt),
        typeof t.completedAt === 'number' && Number.isFinite(t.completedAt) ? t.completedAt : 0
      )
      const done = Array.isArray(t.doneDates)
        ? t.doneDates.reduce((m, d) => Math.max(m, Date.parse(d) || 0), 0)
        : 0
      return Math.max(base, done)
    }
    for (const inc of backup.todos.map(sanitizeTodo)) {
      const old = byId.get(inc.id)
      if (!old || ts(inc) >= ts(old)) byId.set(inc.id, inc)
    }
    await todoRepository.saveMany([...byId.values()])

    const curCats = await todoCategoryRepository.list()
    const mergedCats = [...new Set([...curCats, ...customOnly(backup.todoCategories ?? [])])]
    await todoCategoryRepository.save(mergedCats)
  }

  /* ---------- 文件夹 / 设置 / 主题（仍存 localStorage） ---------- */
  const write = (key: string, v: unknown) => localStorage.setItem(key, JSON.stringify(v))
  if (mode === 'replace') {
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
    const mergeList = (key: string, incoming: string[] | undefined) => {
      const cur = readJson<string[]>(key, [])
      write(key, [...new Set([...cur, ...(incoming ?? [])])])
    }
    mergeList(LS_KEYS.noteFolders, backup.noteFolders)
  }

  /* ---------- v0.3.0 新增模块数据（Dexie 本地库） ---------- */
  /** 通用 Dexie 表导入：merge 按 id 去重，replace 整体替换 */
  async function importTable<T extends { id: string }>(
    list: T[] | undefined,
    svc: { list: () => Promise<T[]>; save: (i: T) => Promise<void>; replaceAll: (l: T[]) => Promise<void> }
  ): Promise<number> {
    const items = (list ?? []).map((x) => ({ ...x, id: String(x.id) }))
    if (mode === 'replace') {
      await svc.replaceAll(items)
    } else {
      // merge：按 id 比较更新时间，本地较新则保留本地，避免旧备份覆盖本地更新
      // （审查 M-5 / H-2 反向回归：新模块实体已加 updatedAt，与 notes/todos 对齐）
      const existing = new Map((await svc.list()).map((x) => [x.id, x]))
      const tsGet = (x: T) => (x as unknown as { updatedAt?: number }).updatedAt ?? 0
      const toSave = items.filter((it) => {
        const old = existing.get(it.id)
        return !old || tsGet(it) >= tsGet(old)
      })
      for (const it of toSave) await svc.save(it)
    }
    return items.length
  }

  const cntTransactions = await importTable(backup.transactions, transactionRepository)
  const cntWorkouts = await importTable(backup.workouts, workoutRepository)
  const cntWeights = await importTable(backup.weights, weightRepository)
  const cntAnniversaries = await importTable(backup.anniversaries, anniversaryRepository)
  const cntQuotes = await importTable(backup.quotes, quoteRepository)

  // 备份导入后刷新 AI 会话（审查 M-4）：ai.load() 有「已加载则早返回」且无 reload，
  // 导入的 chats 在重启前 UI 不可见；此处强制重新加载
  try {
    await useAiStore().reload()
  } catch {
    /* ignore */
  }

  // 待办已写入数据访问层，刷新内存态使 UI 立即反映导入结果（与笔记/AI 一致）
  try {
    await useTodoStore().reload()
  } catch {
    /* ignore */
  }

  return {
    notes: incomingNotes.length,
    todos: backup.todos.length,
    transactions: cntTransactions,
    workouts: cntWorkouts,
    weights: cntWeights,
    anniversaries: cntAnniversaries,
    quotes: cntQuotes
  }
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
