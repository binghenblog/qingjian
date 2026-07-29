export interface TodoRecord {
  id: string
  title: string
  done: boolean
  priority: number
  dueDate?: number
  noteId?: string
}

export interface ChatSession {
  id: string
  title: string
  provider: 'cloud' | 'local'
  model: string
  createdAt: number
}
