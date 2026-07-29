import { describe, it, expect, beforeEach } from 'vitest'
import { validateBackup, importBackup, createBackup, type BackupFile } from '../backup'
import { storage, type NoteRecord } from '../storage'

function note(id: string, patch: Partial<NoteRecord> = {}): NoteRecord {
  return {
    id,
    title: `笔记${id}`,
    content: '',
    tags: [],
    folder: '',
    createdAt: 1,
    updatedAt: 1,
    ...patch
  }
}

function backup(patch: Partial<BackupFile> = {}): BackupFile {
  return {
    app: 'qingjian',
    version: 1,
    exportedAt: Date.now(),
    notes: [],
    todos: [],
    todoCategories: [],
    noteFolders: [],
    settings: null,
    theme: null,
    ...patch
  }
}

beforeEach(async () => {
  localStorage.clear()
  await storage.replaceAllNotes([])
})

describe('validateBackup', () => {
  it('合法备份返回 null', () => {
    expect(validateBackup(backup())).toBeNull()
  })

  it('拒绝非对象 / 缺 app 标识 / 缺版本号', () => {
    expect(validateBackup(null)).toBeTruthy()
    expect(validateBackup('x')).toBeTruthy()
    expect(validateBackup({ version: 1 })).toBeTruthy()
    expect(validateBackup({ app: 'qingjian' })).toBeTruthy()
  })

  it('拒绝高于当前支持的版本', () => {
    expect(validateBackup(backup({ version: 99 }))).toMatch(/v99/)
  })

  it('拒绝 notes/todos 缺失', () => {
    expect(validateBackup({ app: 'qingjian', version: 1 })).toBeTruthy()
  })
})

describe('importBackup - replace（H-5 原子替换）', () => {
  it('清空旧数据并整体写入', async () => {
    await storage.saveNote(note('old'))
    await importBackup(backup({ notes: [note('n1'), note('n2')] }), 'replace')
    const list = await storage.listNotes()
    expect(list.map((n) => n.id).sort()).toEqual(['n1', 'n2'])
  })

  it('导入空备份等于清空', async () => {
    await storage.saveNote(note('old'))
    await importBackup(backup(), 'replace')
    expect(await storage.listNotes()).toEqual([])
  })

  it('恢复设置时剥离旧版备份中的 aiApiKey', async () => {
    await importBackup(
      backup({ settings: { aiModel: 'gpt-4o-mini', aiApiKey: 'sk-leaked' } }),
      'replace'
    )
    const saved = JSON.parse(localStorage.getItem('qingjian.settings')!)
    expect(saved.aiModel).toBe('gpt-4o-mini')
    expect(saved.aiApiKey).toBeUndefined()
  })
})

describe('importBackup - merge', () => {
  it('同 id 保留 updatedAt 较新者', async () => {
    await storage.saveNote(note('a', { title: '本地新', updatedAt: 100 }))
    await storage.saveNote(note('b', { title: '本地旧', updatedAt: 10 }))
    await importBackup(
      backup({
        notes: [note('a', { title: '备份旧', updatedAt: 50 }), note('b', { title: '备份新', updatedAt: 99 })]
      }),
      'merge'
    )
    const map = new Map((await storage.listNotes()).map((n) => [n.id, n]))
    expect(map.get('a')!.title).toBe('本地新')
    expect(map.get('b')!.title).toBe('备份新')
  })

  it('分类与文件夹取并集去重', async () => {
    localStorage.setItem('qingjian.note-folders', JSON.stringify(['甲']))
    await importBackup(backup({ noteFolders: ['甲', '乙'] }), 'merge')
    expect(JSON.parse(localStorage.getItem('qingjian.note-folders')!)).toEqual(['甲', '乙'])
  })

  it('待办按 id 去重合并', async () => {
    localStorage.setItem(
      'qingjian.todos',
      JSON.stringify([{ id: 't1', title: '本地', done: false, priority: 'medium', category: '生活', createdAt: 1 }])
    )
    await importBackup(
      backup({
        todos: [
          { id: 't1', title: '重复', done: false, priority: 'medium', category: '生活', createdAt: 1 },
          { id: 't2', title: '新增', done: false, priority: 'low', category: '工作', createdAt: 2 }
        ] as BackupFile['todos']
      }),
      'merge'
    )
    const merged = JSON.parse(localStorage.getItem('qingjian.todos')!)
    expect(merged).toHaveLength(2)
    expect(merged.find((t: { id: string }) => t.id === 't1').title).toBe('本地')
  })
})

describe('createBackup 脱敏（C-4/I-5）', () => {
  it('导出的设置不含 aiApiKey', async () => {
    localStorage.setItem(
      'qingjian.settings',
      JSON.stringify({ aiModel: 'llama3', aiApiKey: 'sk-secret' })
    )
    const b = await createBackup()
    expect(b.settings).toBeTruthy()
    expect((b.settings as Record<string, unknown>).aiApiKey).toBeUndefined()
    expect(JSON.stringify(b)).not.toContain('sk-secret')
  })
})
