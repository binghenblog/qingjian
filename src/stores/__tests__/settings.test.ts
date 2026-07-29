import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { nextTick } from 'vue'
import { useSettingsStore } from '../settings'

const STORAGE_KEY = 'qingjian.settings'
const KEY_STORAGE = 'qingjian.ai-key'

function freshStore() {
  setActivePinia(createPinia())
  return useSettingsStore()
}

beforeEach(() => {
  localStorage.clear()
  sessionStorage.clear()
})

describe('API Key 存储（C-4）', () => {
  it('旧版明文 Key 自动迁出主设置 JSON', () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ aiProvider: 'cloud', aiApiKey: 'sk-old-plain', aiModel: 'gpt-4o-mini' })
    )
    const store = freshStore()
    expect(store.aiApiKey).toBe('sk-old-plain')
    expect(store.aiKeyRemember).toBe(true)
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY)!)
    expect(saved.aiApiKey).toBeUndefined()
    expect(localStorage.getItem(KEY_STORAGE)).toBe('sk-old-plain')
  })

  it('默认不记住：Key 只进 sessionStorage', async () => {
    const store = freshStore()
    store.aiApiKey = 'sk-session-only'
    await nextTick()
    expect(sessionStorage.getItem(KEY_STORAGE)).toBe('sk-session-only')
    expect(localStorage.getItem(KEY_STORAGE)).toBeNull()
    expect(localStorage.getItem(STORAGE_KEY) ?? '').not.toContain('sk-session-only')
  })

  it('勾选记住：Key 迁入 localStorage 并清掉 sessionStorage 副本', async () => {
    const store = freshStore()
    store.aiApiKey = 'sk-remember'
    await nextTick()
    store.aiKeyRemember = true
    await nextTick()
    expect(localStorage.getItem(KEY_STORAGE)).toBe('sk-remember')
    expect(sessionStorage.getItem(KEY_STORAGE)).toBeNull()
  })

  it('清空 Key 时两处存储都清除', async () => {
    const store = freshStore()
    store.aiApiKey = 'sk-x'
    await nextTick()
    store.aiApiKey = ''
    await nextTick()
    expect(localStorage.getItem(KEY_STORAGE)).toBeNull()
    expect(sessionStorage.getItem(KEY_STORAGE)).toBeNull()
  })
})
