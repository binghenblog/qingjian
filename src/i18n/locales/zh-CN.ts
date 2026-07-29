// 中文（简体）语料——i18n 起步语料。
// 说明：当前仅抽出了全局导航与主要页面（仪表盘 / 设置）的核心 UI 文案，
// 作为国际化框架的奠基。笔记 / 待办 / AI 等页面的剩余硬编码中文将按此模式增量抽取。
// 新增语言只需在 messages 下追加对应 locale 并实现同名 key 即可（审查 L-38）。
export default {
  app: {
    name: '青简',
    tagline: '个人工作台',
    footer: '本地优先 · 数据在你手中',
    version: 'v0.1.0'
  },
  nav: {
    dashboard: '今日桌面',
    notes: '笔记',
    todos: '待办',
    ai: 'AI 助手',
    settings: '设置',
    search: '快速搜索',
    searchAria: '快速搜索（Ctrl/Cmd + K）'
  },
  dashboard: {
    greetingNight: '夜深了',
    greetingMorning: '早上好',
    greetingNoon: '中午好',
    greetingAfternoon: '下午好',
    greetingEvening: '晚上好',
    newWork: '新工作',
    logProgress: '记一笔进展',
    heroHint: '今天，只要记录真正重要的事',
    heroTitle: '把混乱编译成秩序。',
    heroSub: '每一次记录，都会进入你的周报、成果库与技能轨迹。',
    heroCta: '记下刚刚的进展',
    todayPush: '今天要推进',
    allTodos: '全部待办',
    doneOf: '{done} / {total} 已完成',
    yesterdayMissed: '昨日遗留 {n} 项',
    weekProgress: '本周整体进展',
    recent7: '最近 7 天',
    todayAdded: '今日新增',
    weekDone: '本周完成',
    completionRate: '完成率',
    emptyDone: '所有待办都完成了，干得漂亮 🎉',
    emptyNone: '暂无待办，从右上角添加第一项吧',
    featureNotes: '笔记',
    featureNotesDesc: '本地优先的知识库',
    featureTodos: '待办',
    featureTodosDesc: 'GTD 风格任务管理',
    featureAi: 'AI 助手',
    featureAiDesc: '云端 / 本地双通道'
  },
  about: {
    desc: 'v0.1.0 · 轻量 · 现代 · 开源 · 本地优先 · MIT License'
  },
  settings: {
    title: '设置',
    profile: '个人资料',
    profileHint: '仪表盘问候语中显示的名字，仅存本机',
    namePlaceholder: '输入你的名字，如：冰痕',
    appearance: '外观',
    appearanceHint: '选择界面主题模式',
    themeLight: '浅色',
    themeDark: '深色',
    themeSystem: '跟随系统',
    themeAria: '主题模式',
    channelLocal: '本地 Ollama',
    channelCloud: '云端兼容',
    aiTitle: 'AI 通道',
    aiHint: '选择本地或云端模型，配置保存在本地',
    dataTitle: '数据与存储',
    dataHint: '当前本机数据：{notes} 条笔记 · {todos} 条待办。备份为 JSON 文件，可跨设备恢复。',
    fieldAddress: '接口地址',
    fieldModel: '模型',
    fieldApiKey: 'API Key',
    rememberKey: '在本机记住密钥（写入 localStorage；不勾选则关闭浏览器即清除）',
    keyHint: '密钥仅保存在本机浏览器，默认只在当前会话有效。纯 Web 端直连云端可能受 CORS 限制；桌面版将经本地后端中转并加密保管，更安全。',
    exportBtn: '导出备份',
    importMerge: '导入（合并）',
    importReplace: '导入（覆盖）',
    reloadBtn: '刷新页面载入新数据',
    backupHint: '合并：按 id 去重，同一笔记保留较新版本；覆盖：清空当前数据后整体恢复（会先确认）。备份不包含 API Key。',
    shortcutTitle: '快捷键',
    shortcutHint: '随时随地快速跳转'
  }
}
