export type TodoPriority = 'high' | 'medium' | 'low'

/** 每日任务的固定分类名（该分类下任务每天自动重置） */
export const DAILY_CATEGORY = '每日'

export interface TodoRecord {
  id: string
  title: string
  /** 普通任务的完成态（每日任务不使用此字段，见 doneDates） */
  done: boolean
  /** 优先级标注：高 / 中 / 低 */
  priority: TodoPriority
  /** 自定义标签标注，如「阅读」「健身」 */
  tag?: string
  /** 任务分类：每日 / 生活 / 工作 / 学习 / 游戏 / 自定义 */
  category: string
  /** 每日任务的完成日期集合（YYYY-MM-DD），每天自动重置 */
  doneDates?: string[]
  /** 普通任务完成时间戳（用于按日统计） */
  completedAt?: number
  dueDate?: number
  noteId?: string
  createdAt: number
}

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
