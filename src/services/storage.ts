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

// M0 占位实现（内存）。
// 后续切换：
//  - Tauri 桌面/移动：@tauri-apps/plugin-sql（SQLite）
//  - Web 预览：Dexie（IndexedDB）
// 通过 StorageAdapter 统一接口，业务层无感知底层差异。
class MemoryStorage implements StorageAdapter {
  private notes = new Map<string, NoteRecord>()

  async listNotes(): Promise<NoteRecord[]> {
    return [...this.notes.values()].sort((a, b) => b.updatedAt - a.updatedAt)
  }
  async getNote(id: string): Promise<NoteRecord | undefined> {
    return this.notes.get(id)
  }
  async saveNote(n: NoteRecord): Promise<void> {
    this.notes.set(n.id, n)
  }
  async deleteNote(id: string): Promise<void> {
    this.notes.delete(id)
  }
}

export const storage: StorageAdapter = new MemoryStorage()
