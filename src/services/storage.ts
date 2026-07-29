import Dexie, { type Table } from 'dexie'

export interface NoteRecord {
  id: string
  title: string
  content: string
  tags: string[]
  /** 所属文件夹名；空字符串 = 未分类 */
  folder: string
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
  async deleteNote(id: string): Promise<void> {
    await db.notes.delete(id)
  }
}

export const storage: StorageAdapter = new DexieStorage()
