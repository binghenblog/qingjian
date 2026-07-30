import type { NoteRecord, TodoRecord } from '@/types'

/** 上下文单次注入的笔记/待办数量与字符上限，避免超长上下文撑爆请求 */
const MAX_NOTES = 20
const MAX_TODOS = 40
const MAX_CHARS = 8000

/**
 * 把笔记列表拼成模型可读的上下文文本。
 * 纯函数，不依赖 i18n / store，便于单测与复用。
 */
export function formatNotes(notes: NoteRecord[]): string {
  const list = notes.slice(0, MAX_NOTES)
  if (list.length === 0) return ''
  const body = list
    .map((n, i) => {
      const head = `## 笔记 ${i + 1}：${n.title || '(无标题)'}${n.tags.length ? ` [标签: ${n.tags.join(', ')}]` : ''}`
      return `${head}\n${n.content}`
    })
    .join('\n\n---\n\n')
  return truncate(body, MAX_CHARS)
}

/** 把待办列表拼成模型可读的上下文文本（标注完成态 / 优先级 / 周期次数） */
export function formatTodos(todos: TodoRecord[]): string {
  const list = todos.slice(0, MAX_TODOS)
  if (list.length === 0) return ''
  return list
    .map((t, i) => {
      const state = t.done
        ? '✅已完成'
        : t.doneDates && t.doneDates.length > 0
          ? `🔁周期(${t.doneDates.length}次)`
          : '⬜待办'
      const pri = t.priority === 'high' ? ' [高优]' : t.priority === 'low' ? ' [低优]' : ''
      const tag = t.tag ? ` #${t.tag}` : ''
      const cat = t.category ? ` (${t.category})` : ''
      return `${i + 1}. [${state}] ${t.title}${pri}${tag}${cat}`
    })
    .join('\n')
}

function truncate(s: string, n: number): string {
  return s.length > n ? s.slice(0, n) + '\n…(内容已截断)' : s
}
