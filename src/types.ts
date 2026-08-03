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
  /** 可选截止日（YYYY-MM-DD），用于「日程」视图分组（与待办合并，v0.3.0） */
  dueDate?: string
  /** 每日任务的完成日期集合（YYYY-MM-DD），每天自动重置 */
  doneDates?: string[]
  /** 普通任务完成时间戳（用于按日统计） */
  completedAt?: number
  createdAt: number
  /** 最后更新时间戳（备份 merge 取较新者，审查 M-5） */
  updatedAt: number
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

/** AI 会话：持久化于本地数据库，支持多会话切换与重启保留 */
export interface ChatSession {
  id: string
  /** 展示标题；首条用户消息自动提取，用户可重命名（空串 = 未命名） */
  title: string
  createdAt: number
  updatedAt: number
  messages: { role: 'user' | 'assistant'; content: string; id?: string }[]
  /** 注入给模型的本地数据上下文（作为 system 消息，不渲染为气泡，不持久化进可见历史） */
  context?: string
}

// ───────────────────────────────────────────────────────────
// 新增模块实体（v0.3.0）：记账 / 健身 / 纪念日 / 记好句
// ───────────────────────────────────────────────────────────

export type TxType = 'income' | 'expense'

/** 记账：一笔收支记录 */
export interface Transaction {
  id: string
  type: TxType
  /** 分类，如 餐饮 / 交通 / 工资 / 其他（可自定义） */
  category: string
  /** 金额（正数；收支方向由 type 决定） */
  amount: number
  /** 发生日期 YYYY-MM-DD */
  date: string
  note?: string
  createdAt: number
  /** 最后更新时间戳（备份 merge 取较新者，审查 M-5） */
  updatedAt: number
}

/** 健身：一次锻炼记录 */
export interface WorkoutRecord {
  id: string
  /** 锻炼类型，如 跑步 / 力量 / 瑜伽（可自定义） */
  type: string
  /** 时长（分钟） */
  duration: number
  /** 锻炼日期 YYYY-MM-DD */
  date: string
  note?: string
  createdAt: number
  /** 最后更新时间戳（备份 merge 取较新者，审查 M-5） */
  updatedAt: number
}

/** 健身：一条体重记录 */
export interface WeightRecord {
  id: string
  /** 体重（kg） */
  weight: number
  date: string
  createdAt: number
  /** 最后更新时间戳（备份 merge 取较新者，审查 M-5） */
  updatedAt: number
}

/** 纪念日 */
export interface Anniversary {
  id: string
  name: string
  note?: string
  /** 纪念日日期 YYYY-MM-DD */
  date: string
  createdAt: number
  /** 最后更新时间戳（备份 merge 取较新者，审查 M-5） */
  updatedAt: number
}

/** 记好句 */
export interface Quote {
  id: string
  text: string
  category?: string
  date: string
  createdAt: number
  /** 最后更新时间戳（备份 merge 取较新者，审查 M-5） */
  updatedAt: number
}
