# 青简 (QingJian) 项目全面审查报告

**审查日期**: 2026-07-29  
**项目**: Tauri 2 + Vue 3 + TypeScript 个人工作台（笔记、待办、AI 对话、设置）  
**技术栈**: Vite · Pinia · UnoCSS · Dexie (IndexedDB) · Rust (Tauri)  
**代码规模**: ~21 个前端源文件 + 2 个 Rust 文件  

---

## 问题总览

| 严重程度 | 数量 | 说明 |
|---------|------|------|
| 🔴 Critical | 4 | 必须立即修复，影响功能/安全 |
| 🟠 High | 6 | 应尽快修复，存在数据风险或功能缺陷 |
| 🟡 Medium | 18 | 建议修复，影响代码质量和可维护性 |
| 🔵 Low | 16 | 可选优化，当前影响较小 |
| ⚪ Info | 8 | 信息提示和正面评价 |
| **合计** | **52** | |

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

*本报告由 4 个并行审查 Agent 生成，覆盖维度：配置安全 · 前端代码质量 · Rust 后端安全 · 测试与集成*
