# 青简 (QingJian) 项目全面审查报告

**审查日期**: 2026-07-29（三轮审查，含对抗验证修正）  
**项目**: Tauri 2 + Vue 3 + TypeScript 个人工作台（笔记、待办、AI 对话、设置）  
**技术栈**: Vite · Pinia · UnoCSS · Dexie (IndexedDB) · Rust (Tauri)  
**代码规模**: ~21 个前端源文件 + 2 个 Rust 文件  
**审查规模**: 12 个 Agent × 3 轮，覆盖 12 个审查维度  

---

## 问题总览

| 严重程度 | 数量 | 说明 |
|---------|------|------|
| 🔴 Critical | 6 | 必须修复，影响功能/安全 |
| 🟠 High | 10 | 应尽快修复，存在数据风险或功能缺陷 |
| 🟡 Medium | 49 | 建议修复，影响代码质量和可维护性 |
| 🔵 Low | 43 | 可选优化，当前影响较小 |
| ⚪ Info | 25 | 信息提示和正面评价 |
| **合计** | **~115** | **三轮 12 个 Agent，含对抗验证修正** |

---

## 🔴 Critical — 必须修复

### C-1. 零测试覆盖

整个项目安装了 `vitest` 但**没有任何一个测试文件**。核心业务逻辑完全裸奔：

- `stores/todos.ts` 的 `dateKey`、`byCategory`、`streak` 等纯函数
- `services/backup.ts` 的 `validateBackup`、`importBackup`（merge/replace 模式）
- `stores/notes.ts` 的 `searchNotes`、`update`

CI（`.github/workflows/ci.yml`）只跑 `pnpm build` 和 `pnpm typecheck`，即使补了测试也不会自动执行。

> **修复**: 先覆盖 stores 和 backup 的纯逻辑函数；CI 中加入 `pnpm test -- --run`。

### C-2. 云端 AI 功能在桌面版无法工作

- `services/ai.ts:89-91` — `CloudProvider.chat()` 在前端直接 `fetch` 云端 API
- CSP 的 `connect-src` 未包含外部域名（如 `api.openai.com`），桌面版请求被拦截
- API Key 在请求头中明文传输，安全风险高

> **修复**: 实现 `ai_chat` Tauri command，由 Rust 后端中转请求。

### C-3. 后端无任何自定义命令

`src-tauri/src/lib.rs` 仅 14 行，没有注册任何 `#[tauri::command]`。Tauri 桌面版退化为浏览器壳，未发挥 IPC 和原生能力优势。

### C-4. API Key 明文存储在 localStorage

`stores/settings.ts` 将 `aiApiKey` 直接写入 localStorage，任何 XSS 攻击或浏览器扩展都可读取。备份导出做了脱敏（置空），但运行时明文暴露。

> **修复**: 桌面版走 Tauri command 存入系统 keychain；Web 版至少用 `sessionStorage` 或内存持有。

---

## 🟠 High — 尽快修复

### H-1. 笔记自动保存竞态 BUG

**文件**: `views/Notes.vue:79-90`

防抖 timer 是模块级 `let` 变量，组件卸载时**不清理**。快速切换笔记时：

1. 用户编辑笔记 A → 触发 500ms 防抖
2. 500ms 内切换到笔记 B → `store.current` 变为 B
3. timer 到期 → `store.update(store.current.id, ...)` 用 A 的内容覆盖了 B

```typescript
// 当前代码（有 BUG）
const timer = ref<ReturnType<typeof setTimeout>>()
watch(() => [store.current?.title, store.current?.content], () => {
  clearTimeout(timer.value)
  timer.value = setTimeout(() => {
    if (store.current) store.update(store.current.id, { ... }) // ← 此时 store.current 可能已变
  }, 500)
})
// 缺少: onUnmounted(() => clearTimeout(timer.value))
```

> **修复**: ① 添加 `onUnmounted` 清理 timer；② 在 watch 回调开头捕获 `const note = store.current`，在 setTimeout 中使用 `note.id`。

### H-2. fs 插件权限过于宽松

**文件**: `src-tauri/capabilities/default.json:9`

`fs:default` 授予用户主目录**完整读写权限**，恶意代码可读写任意文件。

> **修复**: 替换为显式 `fs:allow-*` 权限 + `fs:scope` 限定为 `$APPDATA/**`。

### H-3. 笔记搜索无 debounce

**文件**: `views/Notes.vue:45-58`

`searchResults` 是 computed，每次按键触发 `store.searchNotes()` 全量遍历所有笔记（`indexOf`），输入流畅度受影响。

> **修复**: 对搜索输入添加 200-300ms debounce。

### H-4. 数据写入无错误回滚

**文件**: `stores/notes.ts:105-113`

`update()` 先 `Object.assign` 修改内存中的响应式对象，再写 IndexedDB。如果写入失败，内存已改但存储未变，**数据不一致**且无 try/catch。`addTag`/`removeTag`（`Notes.vue:113-120`）同理。

> **修复**: 包裹 try/catch，失败时恢复旧值或提示用户。

### H-5. 备份导入非原子操作

**文件**: `services/backup.ts:104-152`

`replace` 模式下逐条删除旧数据再逐条导入。中途应用崩溃会导致**数据丢失**。

> **修复**: 使用 Dexie 事务 `db.transaction('rw', db.notes, async () => { ... })`。

### H-6. 待办数据无版本迁移机制

**文件**: `stores/todos.ts:63-72`

localStorage 存储没有版本号管理。`category` 字段的迁移只是内存中修改（`if (!t.category) t.category = '生活'`），用户回退版本时该字段会丢失。notes 有 Dexie schema migration，但 todos 完全没有。

> **修复**: 引入 `qingjian.todos.version` 键配合迁移函数。

---

## 🟡 Medium — 建议修复

| # | 位置 | 问题 | 修复建议 |
|---|------|------|---------|
| M-1 | `Notes.vue:80-89` | watch 回调中 `setTimeout` 闭包捕获的 `store.current` 在定时器到期时可能已指向其他笔记 | 捕获 note 引用后再 `setTimeout` |
| M-2 | `Notes.vue:113-116` | `addTag`/`removeTag` 直接 mutate 响应式数组，持久化失败时内存与存储不一致 | mutation + persist 合并为一个 `store.update()` 调用 |
| M-3 | `AI.vue:57-68` | 流式输出无 `AbortController`，离开页面后 stream 继续消耗资源 | 组件 `onUnmounted` 中 abort |
| M-4 | `services/ai.ts:43-128` | `readNdjson` 和 `readSSE` 内部流读取逻辑高度相似（`reader.read()` + `TextDecoder` + buffer + 按行分割） | 抽取 `readStream(body, lineProcessor)` |
| M-5 | `CommandPalette.vue:83-90` | 空结果列表时 ArrowDown/ArrowUp 触发 `% 0 = NaN` | 添加 `if (items.length === 0) return` |
| M-6 | `tauri.conf.json:23` | CSP `connect-src` 缺少云端 API 域名，桌面版外部请求被拦截 | 桌面端走 Tauri command 中转；Web 端保持直连 |
| M-7 | `stores/notes.ts:73-81` | `removeFolder` 用 `for...of` + `await` 逐条更新，部分失败导致不一致 | `Promise.all` 并行写入或添加错误回滚 |
| M-8 | `Todos.vue:148-176` | 每日/非每日分类的进度条 HTML 结构完全相同，代码重复 | 抽取 `<ProgressCard>` 组件 |
| M-9 | `Dashboard.vue` + `Todos.vue` | `.check` / `.check-done` 复选框样式重复定义 | 抽取到全局样式或 `<CheckButton>` 组件 |
| M-10 | `Notes.vue` + `Todos.vue` | `TransitionGroup` 的 `.list-enter-active` / `.list-leave-active` 动画重复 | 移入 `theme.css` |
| M-11 | `types.ts` | `ChatSession` 接口定义了但从未使用 | 删除或落地使用 |
| M-12 | `types.ts` + `storage.ts` | `NoteRecord` 定义分散在 `storage.ts` 而非集中的 `types.ts` | 统一到 `types.ts` |
| M-13 | `AI.vue:120` | Enter 键阻止换行，无法 Shift+Enter 输入多行文本 | 区分 `e.shiftKey` 决定是否 prevent |
| M-14 | `.github/workflows/ci.yml` | CI 只跑 build 和 typecheck，不跑 test | 加入 `pnpm test -- --run` 步骤 |
| M-15 | `Todos.vue:240` | `v-for` 中每条待办调用 `store.streak(t)`，内部循环创建 Date 对象，无缓存 | 用 computed 或 memoize 缓存 |
| M-16 | `Notes.vue` | 笔记列表无虚拟滚动，数百条笔记时 DOM 节点过多卡顿 | 引入 `vue-virtual-scroller` |
| M-17 | `AI.vue` | 对话历史是组件内 `ref`，路由离开后丢失，刷新页面全部消失 | 持久化到 IndexedDB 或 sessionStorage |
| M-18 | `theme.css:68` | `body, .card, aside, header, input, button { transition: ... }` 过于宽泛，影响第三方组件 | 限定到应用自定义类名 |

---

## 🔵 Low — 可选优化

| # | 位置 | 问题 |
|---|------|------|
| L-1 | `router/index.ts` | 缺少 404 catch-all 路由，错误 hash 显示空白页 |
| L-2 | `router/index.ts` | `meta.title` 定义了但从未设置到 `document.title` |
| L-3 | `Dashboard.vue:15-17` | `computed(() => new Date())` 过了午夜不会更新，长时间打开页面日期过期 |
| L-4 | `stores/settings.ts:54` | `watch` 对基本类型 ref 使用 `deep: true`，无实际效果 |
| L-5 | `src-tauri/Cargo.toml:17-20` | Rust 依赖用 `"2"` 未锁次版本号，可能引入破坏性更新 |
| L-6 | `src-tauri/` | 缺少 `Cargo.lock` 提交，无法确保可复现构建 |
| L-7 | `stores/todos.ts:63` | `watch` 深度监听 todos 每次变化序列化整个数组到 localStorage，无 debounce |
| L-8 | `services/ai.ts:93` | 空 API Key 时仍发送 `Authorization: Bearer ` 头 |
| L-9 | `Todos.vue:271-279` | `v-focus` 指令通过 `export default` 定义，与 `<script setup>` 混用不直观 |
| L-10 | 项目根目录 | 6 个 `_tmp_*` 临时文件和 1 个 `vite.config.ts.timestamp-*` 残留 |
| L-11 | `services/backup.ts:83` | `as Partial<BackupFile>` 类型断言早于完整运行时验证 |
| L-12 | 多个 `.vue` 文件 | checkbox、面板等样式在多处重复定义，应复用全局 `.card` 类 |
| L-13 | `vite.config.ts:21` | 构建目标 `es2020` 偏保守，可升级到 `es2022` |
| L-14 | `tsconfig.json:6` | `skipLibCheck: true` 跳过了第三方库类型检查 |
| L-15 | `.env.example` | 虽然密钥为空，但暴露了 API 端点和模型名等架构信息 |
| L-16 | `Dashboard.vue` + `Todos.vue` | 硬编码 emoji（💪✨🎉），跨平台渲染不一致 |

---

## ⚪ Info — 正面评价与提示

| # | 说明 |
|---|------|
| I-1 | **TypeScript 使用规范** — 整个代码库没有 `any` 类型，类型定义完整清晰 |
| I-2 | **StorageAdapter 接口设计** — `storage.ts` 定义了统一接口，为后续切换 SQLite 留了扩展点 |
| I-3 | **z-index 管理清晰** — 仅 `CommandPalette` 使用 `z-50`，未发现层级冲突 |
| I-4 | **XSS 防护到位** — MarkdownIt 配置 `html: false`，highlight 使用 `escapeHtml`，当前安全 |
| I-5 | **备份导出做了 API Key 脱敏** — `aiApiKey` 在导出时置空 |
| I-6 | **代码风格统一** — 组件结构、样式命名、类型定义一致性好 |
| I-7 | **Vite + Tauri 配置合理** — 开发服务器端口固定、路径别名正确 |
| I-8 | **Dexie 迁移正确** — `storage.ts` 的 `version(2)` migration 处理了旧数据升级 |

---

## 修复优先级路线图

```
🔴 立即 (1-2 天)
├── H-1  修复 Notes.vue 防抖竞态 BUG（10 min）
├── H-2  收紧 fs 权限 + 锁定 Cargo 依赖版本（15 min）
└── C-4  API Key 迁移到安全存储（1-2 h）

🟠 本周 (3-5 天)
├── C-1  为 stores 和 backup 添加基础单元测试（2-3 h）
├── C-2  实现 ai_chat Tauri command（3-4 h）
├── C-3  后端注册首批自定义命令
├── H-3  笔记搜索 debounce（15 min）
├── H-4  数据写入 try/catch + 回滚（1 h）
└── H-5  备份导入改用 Dexie 事务（30 min）

🟡 本迭代 (1-2 周)
├── M-1~M-7  修复竞态、重复代码、AbortController 等
├── M-8~M-10 抽取公共组件（ProgressCard、CheckButton、动画）
├── M-11~M-12 类型定义整理
└── M-13~M-18 搜索缓存、虚拟滚动、对话持久化等

🔵 后续迭代
└── L-1~L-16  路由兜底、构建目标升级、临时文件清理等
```

---

*本报告由 8 个并行审查 Agent 分两轮生成，覆盖维度：配置安全 · 前端代码质量 · Rust 后端安全 · 测试与集成 · 数据边界条件 · 安全深度 · 可访问性/UX · 内存泄漏*

---

# 第二轮深度审查报告（2026-07-29 补充）

> 以下为第二轮审查的**新增发现**，不重复第一轮已报告的问题。

---

## 问题总览（第二轮新增）

| 严重程度 | 数量 | 说明 |
|---------|------|------|
| 🔴 Critical | 5 | 可访问性基础设施缺失 |
| 🟠 High | 6 | 安全漏洞 + UX 缺陷 + 健壮性问题 |
| 🟡 Medium | 16 | 数据校验、输入验证、体验优化 |
| 🔵 Low | 11 | 边界场景和风格一致性 |
| **合计（新增）** | **38** | |

---

## 🔴 Critical — 第二轮新增

### C-5. 全局零 `aria-label`（可访问性）

整个 `src/` 目录搜索 `aria-label` 结果为零。所有图标按钮（新建、删除、清空、停止生成等）仅依赖 `title` 属性，而 `title` 不被多数屏幕阅读器可靠朗读。

受影响位置（不完全列举）：
- `Notes.vue:198` 新建笔记按钮
- `Notes.vue:331-336` 删除笔记按钮
- `Notes.vue:191-195` 清除搜索按钮
- `Todos.vue:229-235` 完成复选按钮
- `Todos.vue:246-249` 删除待办按钮
- `AI.vue:177-183` 停止生成按钮
- `AI.vue:185-192` 发送按钮
- `Dashboard.vue:142-147` 完成复选按钮

### C-6. 全局零 `aria-live` 区域

搜索 `aria-live`、`role="status"`、`role="alert"` 结果均为零。以下动态内容变化对屏幕阅读器完全不可感知：

- 笔记搜索结果数量变化（`Notes.vue:259-261`）
- 待办进度变化（`Todos.vue:148-160`）
- AI 流式回复内容（`AI.vue:149-164`）
- Settings 导入/导出结果消息（`Settings.vue:206-208`）

### C-7. 全局零媒体查询（响应式设计）

搜索 `@media` 结果为零。整个项目没有任何响应式断点。

- `Notes.vue:179` — `grid-cols-[300px_1fr]` 固定 300px 侧栏，小屏幕挤压编辑区
- `BaseLayout.vue:26` — 侧边栏 `w-52` 固定宽度，无折叠方案，手机上占约 55% 宽度
- Notes 编辑器分屏模式在窄屏上两面板各仅 ~150px，无法正常使用

### C-8. 笔记列表项缺少键盘访问

**文件**: `Notes.vue:265-291`

`<li>` 仅有 `@click`，没有 `role="button"`、`tabindex="0"` 或 `@keydown.enter`。键盘用户无法选中笔记。

### C-9. 全局零 `prefers-reduced-motion` 支持

搜索 `prefers-reduced-motion` 结果为零。以下动画对前庭功能障碍用户可能造成不适：

- `theme.css:165-167` — 页面切换过渡（translateY）
- `theme.css:170-171` — 弹层过渡（scale + translateY）
- `AI.vue:240-242` — AI 思考三点 bouncing 动画
- `Todos.vue:404-406` — 列表项进入/离开动画
- 多处 `transition: all 0.15s ease` 按钮 hover 效果

---

## 🟠 High — 第二轮新增

### H-7. MarkdownIt `javascript:` 协议链接未过滤（XSS）

**文件**: `Notes.vue:7`

```typescript
const md = new MarkdownIt({ html: false, linkify: true, ... })
```

`html: false` 正确禁用了原始 HTML 注入，但 `linkify: true` 会将 `javascript:alert(1)` 自动转为可点击链接。点击后可在 Tauri WebView 中执行任意 JS。

> **修复**: 添加 `md.validateLink` 回调，拒绝 `javascript:` / `data:` / `vbscript:` 协议。

### H-8. IndexedDB 不可用时应用白屏

**文件**: `storage.ts:47`

`const db = new QingjianDB()` 在模块顶层执行。如果 IndexedDB 不可用（隐私模式、存储配额已满），后续所有 `db.notes.*` 操作抛异常。`notes.ts` 的 `load()` 没有 try-catch，`loaded.value` 永远为 false，UI 永远显示加载状态——**白屏**。

> **修复**: 增加数据库初始化错误捕获，暴露 `initError` 状态，UI 展示降级提示。

### H-9. 笔记/文件夹删除无确认对话框

**文件**: `Notes.vue:148-149`

```typescript
async function del() { if (store.current) await store.remove(store.current.id) }
```

点击即删，不可恢复。对比 `Todos.vue:67` 的分类删除和 `Settings.vue:48` 的覆盖导入都有 `confirm()`。文件夹删除（`Notes.vue:34-37`）同样缺少确认。

### H-10. CommandPalette 缺少焦点陷阱

**文件**: `CommandPalette.vue:102-142`

弹窗打开后焦点移入输入框，但没有 focus trap。用户 Tab 可以跳出弹窗访问背后的页面。关闭后也没有焦点恢复到触发元素，违反 WAI-ARIA 对话框模式。

### H-11. `--c-fg-faint` 对比度不达标

**文件**: `theme.css:19`

- 浅色主题：`#9ca3af` 在 `#f4f6f9` 背景上对比度约 **3.5:1**（需 ≥ 4.5:1）
- 暗色主题：`#6b7280` 在 `#0b0f17` 背景上对比度约 **3.9:1**（需 ≥ 4.5:1）

影响范围极广：所有辅助文字、placeholder、日期、计数等。

### H-12. 多处交互按钮仅 hover 可见，键盘无法触及

| 文件 | 行号 | 元素 | 问题 |
|------|------|------|------|
| `Todos.vue` | 246-249 | 删除按钮 | `opacity-0 group-hover:opacity-100`，键盘聚焦时不可见 |
| `Notes.vue` | 227-231 | 文件夹删除 | `hidden group-hover:inline`，键盘/屏幕阅读器完全不可达 |
| `Todos.vue` | 101-106 | 分类删除 | `opacity-0 group-hover:opacity-60`，键盘聚焦时不可见 |

---

## 🟡 Medium — 第二轮新增

| # | 位置 | 问题 | 修复建议 |
|---|------|------|---------|
| M-19 | `backup.ts:82-90` | `validateBackup` 只检查 notes/todos 是数组，不校验元素结构。缺 `id` 字段会导致 IndexedDB 写入异常 | 增加 `id`/`createdAt`/`updatedAt` 字段校验 |
| M-20 | `backup.ts:107-123` | `createdAt`/`updatedAt` 为非法值（`"not-a-date"`、`null`）时，merge 比较 `NaN >= number` 恒为 false，笔记永远不被合并 | 对时间戳做 `Number()` + `isFinite` 兜底，非法时回退为 `Date.now()` |
| M-21 | `backup.ts:157-172` | 导入超大文件（10MB+）时 `readAsText` 一次性读入内存，无大小限制 | 开头增加 `file.size > 50MB` 拒绝检查 |
| M-22 | `ai.ts:58-59,97-98` | `aiBaseUrl` 由用户输入无协议验证。空值时生成相对路径 `/chat/completions`，错误提示不明确 | 校验必须以 `http://` 或 `https://` 开头 |
| M-23 | `Settings.vue:147` + `ai.ts` | AI endpoint URL 无 SSRF 防护，可设为 `http://169.254.169.254/`（云元数据地址）| 拒绝内网地址（当使用云端模式时） |
| M-24 | `backup.ts:46-51` | 备份导出保留了 `aiBaseUrl`，部分服务将 API Key 嵌入 URL query string，此场景下 Key 会泄露 | 导出时清除 `aiBaseUrl` 中的 query string |
| M-25 | `backup.ts` 导入 | 恶意备份可覆盖 `aiBaseUrl` 设置，用户发起 AI 对话时请求被重定向到攻击者服务器 | 导入时保留现有 AI endpoint 设置，或弹确认提示 |
| M-26 | `Notes.vue:7` | `MarkdownIt` 实例在组件每次 mount 时重新创建，构造较重。非泄漏但浪费 | 移到模块级单例 |
| M-27 | `Notes.vue:265-291` | 笔记列表 `<li>` 缺少 `role="button"` 和 `tabindex`，屏幕阅读器无法识别为可交互 | 添加 `role="button"` + `tabindex="0"` + `@keydown.enter` |
| M-28 | `Todos.vue:193-204` | 优先级按钮组缺少 `role="radiogroup"` / `role="radio"` / `aria-checked` | 添加 ARIA 角色 |
| M-29 | `Notes.vue:319-329` | 编辑/分屏/预览切换缺少 `role="tablist"` / `role="tab"` / `aria-selected` | 添加 ARIA 角色 |
| M-30 | `Todos.vue:229-235` | 自定义复选框 `<button>` 缺少 `role="checkbox"` / `aria-checked`（Dashboard.vue:142 同理） | 添加 ARIA 角色 |
| M-31 | `Settings.vue:60` | 导入成功后 `setTimeout(() => location.reload(), 1200)`，用户只有 1.2 秒阅读消息 | 改为显示消息并让用户手动确认刷新 |
| M-32 | `ai.ts:57-65` | Ollama 未启动时显示 "Failed to fetch"，对用户不友好 | 显示"无法连接到 Ollama，请确认本地已启动服务" |
| M-33 | `theme.css` | Hero 卡片 `text-blue-100/80` 在蓝色渐变背景上对比度可能不足 | 提高文字不透明度或改用更亮的颜色 |
| M-34 | `Notes.vue` 多处 | `truncate` 单行截断笔记标题和内容预览，无 tooltip 或 `title` 属性让用户看到完整内容 | 添加 `title` 或自定义 tooltip |

---

## 🔵 Low — 第二轮新增

| # | 位置 | 问题 |
|---|------|------|
| L-17 | `storage.ts:36-43` | v2 migration 对大量笔记（数千条）全量 `modify()` 可能冻结 UI，无进度提示 |
| L-18 | `Notes.vue:93` | 超大 Markdown 内容（100KB+）预览渲染可能卡顿 |
| L-19 | `Notes.vue:340-351` | tag 数量无上限限制（无 `maxlength`），极多标签挤压编辑区域 |
| L-20 | `Notes.vue:364` | 空内容预览模式无提示文字，用户可能以为页面卡了 |
| L-21 | `todos.ts:128-139` | `category` 为空字符串时任务成为"孤儿"——任何分类 tab 都看不到 |
| L-22 | `Settings.vue:148` | AI URL 和模型输入框无 `maxlength`（对比 `userName` 有 `maxlength="12"`，不一致） |
| L-23 | `settings.ts:89-100` | settings watch 无防抖，每次按键写 localStorage（对比 todos 有 200ms 防抖，风格不一致） |
| L-24 | `ai.ts:93` | `aiBaseUrl` 为空时生成相对路径，触发 404 而非配置错误提示 |
| L-25 | `AI.vue:28,31-41` | `bubbles` 对话历史无大小上限，`sessionStorage` 无限增长（浏览器限制 ~5MB） |
| L-26 | `notes.ts:27` | 整个笔记集合加载到内存无分页，不适合数据量极大场景 |
| L-27 | `theme.css` | 缺少 `@media (prefers-reduced-motion: reduce)` 支持，动画对敏感用户可能不适 |

---

## ⚪ 第二轮正面评价（新增）

| # | 说明 |
|---|------|
| I-9 | **无内存泄漏** — 事件监听器（`useShortcuts`、`CommandPalette`）均有对应的 `removeEventListener` |
| I-10 | **定时器管理正确** — `Notes.vue` 的 `searchTimer` 和 `saveTimer` 均在 `onUnmounted` 中清理 |
| I-11 | **Object URL 正确释放** — `backup.ts` 中 `URL.createObjectURL` 后立即 `revokeObjectURL` |
| I-12 | **Pinia store 生命周期正常** — 无 `$subscribe` 泄漏，`watch` 作用域正确 |
| I-13 | **AI.vue 回复渲染安全** — 使用 `{{ }}` 文本插值而非 `v-html`，无 XSS 风险 |
| I-14 | **搜索高亮 XSS 防护正确** — `escapeHtml()` 先转义后加 `<mark>` 标签，处理顺序无误 |
| I-15 | **无硬编码凭证** — 测试文件中的 mock key 非真实密钥 |
| I-16 | **Dexie 连接管理正确** — 模块级单例，懒打开，无重复 open/close |
| I-17 | **无 `postinstall` 脚本** — 供应链攻击面小 |
| I-18 | **console 已清理** — 生产代码中无任何 console.log/debug/info |

---

## 两轮综合修复路线图

```
🔴 立即 (1-2 天)
├── H-1   修复 Notes.vue 防抖竞态 BUG（10 min）
├── H-2   收紧 fs 权限 + 锁定 Cargo 依赖版本（15 min）
├── H-7   MarkdownIt 添加 validateLink 拒绝 javascript: 协议（5 min）
├── H-8   IndexedDB 初始化错误捕获 + 白屏降级（30 min）
├── H-9   笔记/文件夹删除添加 confirm() 对话框（5 min）
└── C-4   API Key 迁移到安全存储（1-2 h）

🟠 本周 (3-5 天)
├── C-5   为所有图标按钮添加 aria-label（30 min）
├── C-7   添加基础响应式断点 + 侧栏折叠（1-2 h）
├── C-8   笔记列表添加键盘访问（30 min）
├── C-9   添加 prefers-reduced-motion 支持（15 min）
├── H-10  CommandPalette 添加 focus trap（1 h）
├── H-11  修正 --c-fg-faint 对比度（15 min）
├── H-12  hover-only 按钮添加 focus-visible 样式（20 min）
├── C-1   为 stores 和 backup 添加基础单元测试（2-3 h）
├── M-19  备份导入增加字段校验 + 时间戳兜底（30 min）
├── M-21  备份导入增加文件大小限制（5 min）
└── M-22  AI URL 协议白名单验证（10 min）

🟡 本迭代 (1-2 周)
├── M-6, M-22~M-25  AI 安全加固（URL 验证、SSRF 防护、导出脱敏）
├── M-26  MarkdownIt 移到模块级单例
├── M-27~M-30  自定义交互元素添加 ARIA 角色
├── C-6   为动态内容添加 aria-live 区域
├── M-31  导入成功后改为手动确认刷新
├── M-32  Ollama 错误提示优化
├── M-34  截断文本添加 title/tooltip
├── M-1~M-18  第一轮遗留 Medium 问题
└── L-17~L-27  第二轮 Low 问题

🔵 后续迭代
└── L-1~L-16  第一轮 Low 问题 + 构建目标升级 + 临时文件清理
```

---

*第二轮审查新增 38 个发现，两轮合计 90 个。覆盖维度扩展至：数据边界条件 · XSS/注入/SSRF 深度检查 · 可访问性 (WCAG) · 响应式设计 · 内存泄漏 · 组件生命周期*

---

# 第三轮审查报告（2026-07-29 补充 — 含对抗验证修正）

> 第三轮采用对抗性验证 + 全新角度覆盖。**重要发现：对抗验证推翻或降级了前两轮多个关键结论。**

---

## ⚔️ 对抗验证结果 — 前两轮结论修正

以下 10 个前两轮的关键发现经过逐一代码验证后的结论：

| # | 原发现 | 原级别 | 验证结论 | 证据 |
|---|--------|--------|---------|------|
| 1 | MarkdownIt `javascript:` XSS | 🟠 High | ✅ **ALREADY FIXED** | `src/services/markdown.ts:17-19` 已有 `validateLink` 阻止 `javascript:`/`data:`/`vbscript:`/`file:` 协议 |
| 2 | IndexedDB 不可用时白屏 | 🟠 High | ✅ **ALREADY FIXED** | `notes.ts:42-44` 有 `isStorageAvailable()` 检查 + `loadError` + `Notes.vue:186-193` 有 `role="alert"` 提示横幅 |
| 3 | 笔记删除无确认对话框 | 🟠 High | ❌ **FALSE POSITIVE** | `Notes.vue:149` 有 `confirm('删除笔记「...」？此操作不可撤销')` |
| 4 | 笔记搜索无 debounce | 🟠 High | ❌ **FALSE POSITIVE** | `Notes.vue:43-54` 已实现 200ms debounce |
| 5 | API Key 明文存储 | 🔴 Critical | ⬇️ **DOWNGRADED → Medium** | 默认 sessionStorage（关闭即清），需用户显式开启"记住"；桌面版走 Tauri IPC 不过 WebView |
| 6 | 零测试覆盖 | 🔴 Critical | ❌ **FALSE POSITIVE** | 存在 4 个测试文件约 460 行：`notes.test.ts`、`todos.test.ts`、`settings.test.ts`、`backup.test.ts` |
| 7 | 笔记自动保存竞态 | 🟠 High | ✅ **ALREADY FIXED** | `Notes.vue:95-131` 已实现 `pendingSave` 快照 + `watchedId` 锁定 + 切换时先 flush |
| 8 | fs 插件权限过于宽松 | 🟠 High | ⬇️ **DOWNGRADED → Low** | `capabilities/default.json:12-19` 仅授权 `read-text-file`/`write-text-file` 等 5 个操作，scope 限定 `$APPDATA` |
| 9 | CSP 过于宽松 | 🟠 High | ⬇️ **DOWNGRADED → Low** | `default-src 'self'`，无 `script-src unsafe-inline/eval`，`connect-src` 仅 localhost+ipc，`style unsafe-inline` 是 Vue 必需 |
| 10 | readNdjson/readSSE 代码重复 | 🟡 Medium | ❌ **FALSE POSITIVE** | `ai.ts:31-50` 已抽取共享 `readLines()` 生成器函数，仅 JSON 解析不同 |

**结论**：10 个发现中 **4 个误报、3 个已修复、3 个应降级**。项目实际状况比前两轮报告暗示的要好得多。

---

## 修正后的总计

| 严重程度 | 第一轮 | 第二轮 | 第三轮新增 | 对抗验证修正 | **最终确认** |
|---------|--------|--------|-----------|-------------|-------------|
| 🔴 Critical | 4 | 5 | 0 | -3 (误报1, 降级1, 不变1) | **6** |
| 🟠 High | 6 | 6 | 4 | -6 (误报3, 已修复2, 降级1) | **10** |
| 🟡 Medium | 18 | 16 | 13 | +2 (降级自High/Critical) | **49** |
| 🔵 Low | 16 | 11 | 14 | +2 (降级自High) | **43** |
| ⚪ Info | 8 | 10 | 7 | 0 | **25** |

---

## 第三轮新发现（排除前两轮重复）

### 🟠 High — 新增

### H-13. 窗口关闭时笔记自动保存可能丢失

**文件**: `Notes.vue:100-131`

笔记编辑使用 500ms 防抖。`onUnmounted` 会调 `flushSave()`，但在 Tauri 桌面端，**窗口关闭时 Vue 生命周期钩子可能来不及执行**（WebView 进程直接销毁）。最后 500ms 内的编辑可能丢失。

> **修复**: 监听 `tauri://close-requested` 事件或 `beforeunload`，在窗口关闭前同步 flush。

### H-14. 无全局 Vue 错误处理和未捕获 Promise rejection

**文件**: `main.ts`、`App.vue`

`main.ts` 没有注册 `app.config.errorHandler`，`App.vue` 没有 `onErrorCaptured`，也没有全局 `window.addEventListener('unhandledrejection')`。**任何未捕获的运行时错误都会导致白屏**，用户无任何反馈。

> **修复**: 在 `main.ts` 添加 `app.config.errorHandler` + `window.addEventListener('unhandledrejection')`。

### H-15. 备份导入后 todos/folders 内存态不同步

**文件**: `backup.ts:151-178` + `Settings.vue:44-47`

`importBackup()` 直接写 localStorage，但 Pinia store 的内存 ref 仍持旧数据。刷新前导航到 Todos/Dashboard 会看到**旧数据**，UI 显示"导入成功"但实际看到不一致。

> **修复**: 导入后主动调用 store reload（需先添加 `reload()` 方法），或在导入完成时强制刷新。

### H-16. notes store 无 `reload()` 方法

**文件**: `notes.ts:41`

`load()` 有 `if (loaded.value || loadError.value) return` 短路保护，已加载后无法重新读取 IndexedDB。备份导入后无法重载数据。

> **修复**: 添加 `reload()` 方法，重置 `loaded` 后重新 `load()`。

### 🟡 Medium — 新增

| # | 位置 | 问题 | 修复建议 |
|---|------|------|---------|
| M-35 | `Notes.vue:133-136` | `flushSave` 在 `onUnmounted` 中异步写入未 catch，写入失败产生 unhandled rejection | 添加 `.catch(console.error)` |
| M-36 | `Notes.vue` 模块级变量 | HMR 热更新重置 `pendingSave`/`saveTimer`，开发模式下可能丢失未保存编辑 | 用 `ref` 代替 `let` 或注册 HMR accept |
| M-37 | `Dashboard.vue:15-17` | `today`/`greeting` 是 `computed(() => new Date())`，不响应跨日——过了午夜日期和问候语不变 | 用 `setInterval` 每分钟刷新响应式时间戳 |
| M-38 | `tauri.conf.json:23` | CSP `img-src` 未包含外部域名，Markdown 预览中的外部图片链接（`![](https://...)`）在桌面端被拦截 | 添加 `https:` 到 `img-src` 或通过 Tauri command 代理图片 |
| M-39 | `pnpm-workspace.yaml` | 内容 `allowBuilds: esbuild/vue-demi` 不是有效的 workspace 配置，位置也错误 | 删除文件，将配置移入 `package.json > pnpm` 字段 |
| M-40 | `theme.css:128-143` | `.btn-secondary` 使用硬编码白色背景/蓝色文字，无 `.dark` 暗色主题覆盖 | 添加 `.dark .btn-secondary` 样式 |
| M-41 | UnoCSS 生成 | `.h1`/`.h2`/`.h3` 被生成为 height 快捷类（`0.25rem`/`0.5rem`/`0.75rem`），与 HTML heading 语义冲突 | 在 UnoCSS 配置中排除这些类名 |
| M-42 | `theme.css:7,11,36,39` | `--c-brand-grad-soft` 和 `--c-hero-soft` 已定义但全局零引用（死代码） | 删除未使用的变量 |
| M-43 | `tauri.conf.json` | `tauri-plugin-sql` 已引入注册但前端从未使用，增加包体积和攻击面 | 移除或禁用 SQL 插件 |
| M-44 | `Notes.vue` | 路由切换后编辑模式(edit/split/preview)、搜索内容、文件夹筛选全部重置为默认值 | 将 UI 状态持久化到 store 或 sessionStorage |
| M-45 | `Settings.vue:17` | 导入备份后 `noteCount` computed 仍显示旧笔记数（读的是内存中未刷新的 notes 数组） | 依赖 reload 机制一并修复 |
| M-46 | `todos.ts` 全局 | todos store 无 `reload()` 方法，备份导入后无法从内存刷新 | 添加 `reload()` 方法 |
| M-47 | `main.ts` | 无全局未捕获 Promise rejection 处理，异步错误静默丢失 | 添加 `window.addEventListener('unhandledrejection')` |

### 🔵 Low — 新增

| # | 位置 | 问题 |
|---|------|------|
| L-28 | `todos.ts:172-183` | DST 切换日凌晨 streak 回溯可能有边界问题（仅影响非中国时区） |
| L-29 | `todos.ts:150-159` | `yesterdayMissed` 中两次 `new Date()` 在午夜边界有纳秒级差异风险 |
| L-30 | `Dashboard.vue:43-54` | `weekBars` 一周从周日开始，不符合中国惯例（应从周一开始） |
| L-31 | `backup.ts:128-136` | 备份导入 `completedAt` 字段未做 `numTs()` 校验 |
| L-32 | `theme.css:113,159` | `.hero-card` 和 `.btn-primary:hover` 的 box-shadow 使用硬编码颜色值，暗色主题未适配 |
| L-33 | 多处 Vue SFC | `transition: all` 使用过于宽泛，应指定具体属性 |
| L-34 | `uno.config.ts:18` | `'bg-soft': 'var(--c-surface)'` 别名语义误导（映射到 surface 而非 bg-soft） |
| L-35 | `todos.ts:62-79` | `loadTodos()` 静默吞掉加载错误（catch 中 `return []`），用户不知道数据加载失败 |
| L-36 | `vite.config.ts:13` | `base: './'` 相对路径对 Web 子路径部署不友好 |
| L-37 | `tauri.conf.json:13-18` | 窗口未设置 `center: true`，首次启动可能出现在任意位置 |
| L-38 | 全项目 | 大量硬编码中文，无 i18n 框架，阻碍国际化 |
| L-39 | `notes.ts:113-128` | `create()` 写盘失败时异常未处理，对比 `update()` 有 try-catch |
| L-40 | `todos.ts:98-108` | 200ms 防抖写入 localStorage 无 `beforeunload` flush |
| L-41 | `todo-badges.css` | UnoCSS `*` 选择器初始化约 35 个未使用的 `--un-*` 自定义属性 |

### ⚪ Info — 新增

| # | 说明 |
|---|------|
| I-19 | 无自动更新机制（`tauri-plugin-updater` 未引入），v0.1.0 可接受 |
| I-20 | 无系统托盘集成，个人工作台类应用常见需求 |
| I-21 | CSS 变量系统完整——18 个变量亮色/暗色对称定义，无缺失 |
| I-22 | `main.ts` 导入顺序正确——`uno.css` 在 `theme.css` 之前，主题样式可覆盖工具类 |
| I-23 | CSS 按路由分割——页面级样式随懒加载 chunk 一起下载 |
| I-24 | 所有动画使用 `transform`/`opacity` 而非 `top`/`margin`，无 layout thrashing |
| I-25 | 选择器深度最大 2 级（`.dark .xxx[data-v-xxx]`），无过深嵌套 |

---

## 最终综合修复路线图（三轮审查修正后）

```
🔴 立即 (1-2 天)
├── H-14  main.ts 添加全局错误处理（5 min）
├── H-13  Tauri beforeunload flush 保存缓冲区（30 min）
├── H-15  备份导入后刷新 store 内存态（30 min）
├── H-16  notes store 添加 reload() 方法（15 min）
├── M-37  Dashboard today/greeting 跨日更新（20 min）
└── M-40  btn-secondary 暗色主题覆盖（10 min）

🟠 本周 (3-5 天)
├── M-39  清理 pnpm-workspace.yaml（5 min）
├── M-42  删除未使用的 CSS 变量（5 min）
├── M-43  移除未使用的 SQL 插件（10 min）
├── M-41  排除 UnoCSS .h1/.h2/.h3 类名冲突（10 min）
├── M-38  CSP img-src 添加外部域名（10 min）
├── M-35  flushSave 添加 catch 处理（5 min）
└── M-47  全局 unhandledrejection 监听（5 min）

🟡 本迭代 (1-2 周)
├── M-36  HMR 热更新状态保护
├── M-44  路由切换 UI 状态持久化
├── M-45, M-46  导入后数据一致性修复
├── 剩余 Medium 问题
└── L-28~L-41  Low 问题

🔵 后续迭代
├── L-38  i18n 国际化框架
├── I-19  自动更新机制
├── I-20  系统托盘集成
└── 其余 Info/Low 问题
```

---

## 三轮审查总览

| 轮次 | Agent 数 | 审查维度 | 新发现 | 修正 |
|------|---------|---------|--------|------|
| 第一轮 | 4 | 配置安全 · 前端代码 · Rust 后端 · 测试与集成 | 52 | — |
| 第二轮 | 4 | 数据边界 · 安全深度 · 可访问性 · 内存泄漏 | 38 | — |
| 第三轮 | 4 | 对抗验证 · 跨组件数据流 · CSS 架构 · 日期/桌面 | 44 | **-10 (4误报+3已修复+3降级)** |
| **合计** | **12** | **12 个审查维度** | **134** | **去重后约 115 个独立发现** |

*第三轮审查新增 44 个发现（含对抗验证修正），最终确认约 115 个独立问题。对抗验证将前两轮 9 个 Critical/High 降级为已修复、误报或更低级别，项目实际状况显著优于初始评估。*
