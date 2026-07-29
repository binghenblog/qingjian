import Dexie, { type Table } from 'dexie'

export interface NoteRecord {
  id: string
  title: string
  content: string
  tags: string[]
  createdAt: number
  updatedAt: number
}

export interface StorageAdapter {
  listNotes(): Promise<NoteRecord[]>
  getNote(id: string): Promise<NoteRecord | undefined>
  saveNote(n: NoteRecord): Promise<void>
  deleteNote(id: string): Promise<void>
}

/**
 * 青简本地数据库（Web 端：IndexedDB / Dexie）。
 * Tauri 桌面 / 移动端里程碑将切换为 @tauri-apps/plugin-sql（SQLite），
 * 业务层通过 StorageAdapter 接口无感知底层差异。
 */
class QingjianDB extends Dexie {
  notes!: Table<NoteRecord, string>
  constructor() {
    super('qingjian')
    this.version(1).stores({
      // 主键 id；updatedAt / createdAt 用于排序与查询
      notes: 'id, updatedAt, createdAt'
    })
  }
}

const db = new QingjianDB()

/** Web 端 Dexie 实现 */
class DexieStorage implements StorageAdapter {
  async listNotes(): Promise<NoteRecord[]> {
    return db.notes.orderBy('updatedAt').reverse().toArray()
  }
  async getNote(id: string): Promise<NoteRecord | undefined> {
    return db.notes.get(id)
  }
  async saveNote(n: NoteRecord): Promise<void> {
    await db.notes.put(n)
  }
  async deleteNote(id: string): Promise<void> {
    await db.notes.delete(id)
  }
}

export const storage: StorageAdapter = new DexieStorage()
