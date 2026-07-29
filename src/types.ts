export type TodoPriority = 'high' | 'medium' | 'low'

export interface TodoRecord {
  id: string
  title: string
  done: boolean
  /** 优先级标注：高 / 中 / 低 */
  priority: TodoPriority
  /** 自定义标签标注，如「工作」「学习」 */
  tag?: string
  dueDate?: number
  noteId?: string
  createdAt: number
}

export interface ChatSession {
  id: string
  title: string
  provider: 'cloud' | 'local'
  model: string
  createdAt: number
}
