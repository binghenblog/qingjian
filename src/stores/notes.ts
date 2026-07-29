import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { storage, type NoteRecord } from '@/services/storage'

/** 笔记 Store（M1：Dexie 持久化） */
export const useNoteStore = defineStore('notes', () => {
  const notes = ref<NoteRecord[]>([])
  const currentId = ref<string | null>(null)
  const loaded = ref(false)

  async function load() {
    notes.value = await storage.listNotes()
    loaded.value = true
  }

  const current = computed(() => notes.value.find((n) => n.id === currentId.value) ?? null)

  /** 全部已用过的标签（供联想） */
  const tags = computed(() => [...new Set(notes.value.flatMap((n) => n.tags))])

  async function create() {
    const now = Date.now()
    const n: NoteRecord = {
      id: crypto.randomUUID(),
      title: '无标题笔记',
      content: '',
      tags: [],
      createdAt: now,
      updatedAt: now
    }
    await storage.saveNote(n)
    notes.value.unshift(n)
    currentId.value = n.id
    return n
  }

  async function update(id: string, patch: Partial<Pick<NoteRecord, 'title' | 'content' | 'tags'>>) {
    const n = notes.value.find((x) => x.id === id)
    if (!n) return
    Object.assign(n, patch, { updatedAt: Date.now() })
    await storage.saveNote(n)
  }

  async function remove(id: string) {
    await storage.deleteNote(id)
    notes.value = notes.value.filter((n) => n.id !== id)
    if (currentId.value === id) currentId.value = notes.value[0]?.id ?? null
  }

  function select(id: string) {
    currentId.value = id
  }

  return { notes, currentId, current, tags, loaded, load, create, update, remove, select }
})
