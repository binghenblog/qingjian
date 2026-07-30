import Dexie, { type Table } from 'dexie'
import type { NoteRecord, ChatSession } from '@/types'

// 类型集中在 src/types.ts（审查 M-12）；此处转发导出保持旧引用兼容
export type { NoteRecord }

export interface StorageAdapter {
  listNotes(): Promise<NoteRecord[]>
  getNote(id: string): Promise<NoteRecord | undefined>
  saveNote(n: NoteRecord): Promise<void>
  /** 批量保存（单事务） */
  saveNotes(list: NoteRecord[]): Promise<void>
  deleteNote(id: string): Promise<void>
  /** 原子化整体替换：清空 + 写入在同一事务内完成，失败自动回滚（备份导入用） */
  replaceAllNotes(list: NoteRecord[]): Promise<void>
}

/**
 * 青简本地数据库（Web 端：IndexedDB / Dexie）。
 * Tauri 桌面 / 移动端里程碑将切换为 @tauri-apps/plugin-sql（SQLite），
 * 业务层通过 StorageAdapter 接口无感知底层差异。
 */
class QingjianDB extends Dexie {
  notes!: Table<NoteRecord, string>
  chats!: Table<ChatSession, string>
  constructor() {
    super('qingjian')
    this.version(1).stores({
      // 主键 id；updatedAt / createdAt 用于排序与查询
      notes: 'id, updatedAt, createdAt'
    })
    // v2：新增 folder 索引；旧数据 folder 补空串（未分类）
    this.version(2)
      .stores({
        notes: 'id, updatedAt, createdAt, folder'
      })
      .upgrade((tx) =>
        tx
          .table('notes')
          .toCollection()
          .modify((n) => {
            if (typeof n.folder !== 'string') n.folder = ''
          })
      )
    // v3：新增 AI 会话表（多会话 + 持久化），按 updatedAt 排序
    this.version(3).stores({
      chats: 'id, updatedAt'
    })
  }
}

const db = new QingjianDB()

/** Web 端 Dexie 实现 */
class DexieStorage implements StorageAdapter {
  async listNotes(): Promise<NoteRecord[]> {
    const list = await db.notes.orderBy('updatedAt').reverse().toArray()
    // 容错：极端情况下（升级钩子未跑）确保 folder 存在
    return list.map((n) => ({ ...n, folder: typeof n.folder === 'string' ? n.folder : '' }))
  }
  async getNote(id: string): Promise<NoteRecord | undefined> {
    return db.notes.get(id)
  }
  async saveNote(n: NoteRecord): Promise<void> {
    await db.notes.put(n)
  }
  async saveNotes(list: NoteRecord[]): Promise<void> {
    if (list.length === 0) return
    await db.notes.bulkPut(list)
  }
  async deleteNote(id: string): Promise<void> {
    await db.notes.delete(id)
  }
  async replaceAllNotes(list: NoteRecord[]): Promise<void> {
    // Dexie 事务：clear + bulkPut 原子执行，任一步失败整体回滚（审查 H-5）
    await db.transaction('rw', db.notes, async () => {
      await db.notes.clear()
      if (list.length > 0) await db.notes.bulkPut(list)
    })
  }
}

export const storage: StorageAdapter = new DexieStorage()

/**
 * AI 会话持久化（与笔记共用同一 Dexie 库）。
 * 会话列表存本地、随应用保留，刷新/重启不丢，并纳入备份。
 */
export interface ChatStorage {
  listChats(): Promise<ChatSession[]>
  saveChat(s: ChatSession): Promise<void>
  deleteChat(id: string): Promise<void>
  /** 原子整体替换（备份覆盖导入用） */
  replaceAllChats(list: ChatSession[]): Promise<void>
}

class DexieChatStorage implements ChatStorage {
  async listChats(): Promise<ChatSession[]> {
    return db.chats.orderBy('updatedAt').reverse().toArray()
  }
  async saveChat(s: ChatSession): Promise<void> {
    await db.chats.put(s)
  }
  async deleteChat(id: string): Promise<void> {
    await db.chats.delete(id)
  }
  async replaceAllChats(list: ChatSession[]): Promise<void> {
    await db.transaction('rw', db.chats, async () => {
      await db.chats.clear()
      if (list.length > 0) await db.chats.bulkPut(list)
    })
  }
}

export const chatStorage: ChatStorage = new DexieChatStorage()

/**
 * IndexedDB 可用性探测（审查 H-8）：隐私模式 / 存储配额满 / 老旧浏览器下可能不可用。
 * 用于在加载前给出明确降级提示，而不是无限白屏。
 */
export function isStorageAvailable(): boolean {
  try {
    return typeof indexedDB !== 'undefined' && indexedDB !== null
  } catch {
    return false
  }
}
