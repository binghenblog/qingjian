import Dexie, { type Table } from 'dexie'
import type {
  NoteRecord,
  ChatSession,
  TodoRecord,
  Transaction,
  WorkoutRecord,
  WeightRecord,
  Anniversary,
  Quote
} from '@/types'

// ───────────────────────────────────────────────────────────
// 统一数据访问层（Data Access Layer / DAL）
//
// 这是青简 **唯一** 的持久化边界：所有业务模块（笔记 / AI 会话 /
// 待办 / 记账 / 健身 / 纪念日 / 记好句）的读写都经由本层导出的
// repository 完成，stores 不直接接触 IndexedDB / Dexie / localStorage。
//
// 设计要点：
// - 存储无关：Web 端底层为 Dexie(IndexedDB)；Tauri 桌面 / 移动端里程碑
//   将切换到 @tauri-apps/plugin-sql（SQLite）——届时只需替换本文件内的
//   实现，上层 repository 接口与全部业务代码保持不变。
// - 统一契约：每个模块暴露 `Repository<T>`（list / get / save / saveMany /
//   delete / replaceAll），备份导入的「原子整体替换」由 replaceAll 保证。
// - 待办（v5）与其分类原存于裸 localStorage，已统一迁入本层，消除数据
//   碎片化（审查 M-4）。
// ───────────────────────────────────────────────────────────

/** 所有 repository 的通用契约（存储无关，便于未来替换为 SQLite 实现） */
export interface Repository<T extends { id: string }> {
  /** 列出全部记录（按各模块默认排序，通常为最近优先） */
  list(): Promise<T[]>
  /** 按主键取单条 */
  get(id: string): Promise<T | undefined>
  /** 写入或更新单条 */
  save(item: T): Promise<void>
  /** 批量写入（单事务） */
  saveMany(items: T[]): Promise<void>
  /** 按主键删除 */
  delete(id: string): Promise<void>
  /** 原子整体替换：清空 + 写入同一事务，失败回滚（备份导入用） */
  replaceAll(items: T[]): Promise<void>
}

class QingjianDB extends Dexie {
  notes!: Table<NoteRecord, string>
  chats!: Table<ChatSession, string>
  todos!: Table<TodoRecord, string>
  todoCategories!: Table<{ id: string; items: string[] }, string>
  transactions!: Table<Transaction, string>
  workouts!: Table<WorkoutRecord, string>
  weights!: Table<WeightRecord, string>
  anniversaries!: Table<Anniversary, string>
  quotes!: Table<Quote, string>

  constructor() {
    super('qingjian')
    // v1：笔记（主键 id，按 updatedAt / createdAt 排序与查询）
    this.version(1).stores({
      notes: 'id, updatedAt, createdAt'
    })
    // v2：笔记新增 folder 索引；旧数据 folder 补空串（未分类）
    this.version(2)
      .stores({ notes: 'id, updatedAt, createdAt, folder' })
      .upgrade((tx) =>
        tx
          .table('notes')
          .toCollection()
          .modify((n: NoteRecord) => {
            if (typeof n.folder !== 'string') n.folder = ''
          })
      )
    // v3：AI 会话表（多会话 + 持久化），按 updatedAt 排序
    this.version(3).stores({
      chats: 'id, updatedAt'
    })
    // v4：记账 / 健身 / 纪念日 / 记好句（v0.3.0）
    this.version(4).stores({
      transactions: 'id, date, type, createdAt',
      workouts: 'id, date, createdAt',
      weights: 'id, date, createdAt',
      anniversaries: 'id, date, createdAt',
      quotes: 'id, date, createdAt'
    })
    // v5（数据访问层统一）：待办与其分类从裸 localStorage 迁入 Dexie
    this.version(5).stores({
      todos: 'id, category, updatedAt',
      todoCategories: 'id'
    })
  }
}

const db = new QingjianDB()

/** 通用 CRUD 工厂：列表 / 取单条 / 保存 / 批量保存 / 删除 / 整体替换 */
function createRepository<T extends { id: string }>(table: Table<T, string>, orderBy: string): Repository<T> {
  return {
    list: () => table.orderBy(orderBy).reverse().toArray() as Promise<T[]>,
    // 显式 await 后以 Promise<void> 返回，避免把 Promise<Key> 错误断言为 Promise<void>
    get: (id: string) => table.get(id),
    save: async (item: T) => {
      await table.put(item)
    },
    saveMany: async (items: T[]) => {
      if (items.length === 0) return
      await table.bulkPut(items)
    },
    delete: async (id: string) => {
      await table.delete(id)
    },
    replaceAll: async (items: T[]) => {
      // Dexie 事务：clear + bulkPut 原子执行，任一步失败整体回滚
      await db.transaction('rw', table, async () => {
        await table.clear()
        if (items.length) await table.bulkPut(items)
      })
    }
  }
}

// 笔记：list 兜底 folder 字段（极端升级场景，确保旧数据 folder 存在）
export const noteRepository: Repository<NoteRecord> = (() => {
  const base = createRepository<NoteRecord>(db.notes, 'updatedAt')
  return {
    ...base,
    list: async () =>
      (await base.list()).map((n) => ({ ...n, folder: typeof n.folder === 'string' ? n.folder : '' }))
  }
})()

// AI 会话：沿用既有语义方法名（与笔记/待办的分层保持一致，但接口更贴近会话语义）
export const chatRepository = {
  listChats: () => db.chats.orderBy('updatedAt').reverse().toArray() as Promise<ChatSession[]>,
  get: (id: string) => db.chats.get(id),
  saveChat: async (s: ChatSession) => {
    await db.chats.put(s)
  },
  deleteChat: async (id: string) => {
    await db.chats.delete(id)
  },
  replaceAllChats: async (list: ChatSession[]) => {
    await db.transaction('rw', db.chats, async () => {
      await db.chats.clear()
      if (list.length) await db.chats.bulkPut(list)
    })
  }
}

// 待办（v5 起统一在本层）；分类以单条记录（id='categories'）持久化，预设分类始终在前
export const todoRepository = createRepository<TodoRecord>(db.todos, 'updatedAt')
export const todoCategoryRepository = {
  /** 取分类列表（预设在前，自定义在后）；无记录时返回空数组（调用方补预设） */
  list: async (): Promise<string[]> => {
    const rec = await db.todoCategories.get('categories')
    return rec?.items ?? []
  },
  /** 写入分类列表（仅存自定义部分，预设分类由调用方在读取时补充） */
  save: async (items: string[]): Promise<void> => {
    await db.todoCategories.put({ id: 'categories', items })
  },
  clear: async (): Promise<void> => {
    await db.todoCategories.clear()
  }
}

export const transactionRepository = createRepository<Transaction>(db.transactions, 'date')
export const workoutRepository = createRepository<WorkoutRecord>(db.workouts, 'date')
export const weightRepository = createRepository<WeightRecord>(db.weights, 'date')
export const anniversaryRepository = createRepository<Anniversary>(db.anniversaries, 'date')
export const quoteRepository = createRepository<Quote>(db.quotes, 'date')

/**
 * IndexedDB 可用性探测（隐私模式 / 存储配额满 / 老旧浏览器下可能不可用）。
 * 用于在加载前给出明确降级提示，而不是无限白屏。
 */
export function isStorageAvailable(): boolean {
  try {
    return typeof indexedDB !== 'undefined' && indexedDB !== null
  } catch {
    return false
  }
}

// 领域类型集中定义于 src/types.ts；此处转发导出保持既有引用兼容（原 services/storage 亦如此）
export type { NoteRecord }
