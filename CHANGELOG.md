# Changelog

All notable changes to 青简 (QingJian) are documented here.

The project adheres to [Semantic Versioning](https://semver.org/).

## [0.5.0] - 2026-08-03

v0.5.0 是图标统一与打包体验修复版：把 Web / 桌面 / 移动三端的应用图标与品牌标识拉齐，并修复「打包后的 exe / apk 安装后导航栏图标不显示」问题。

### Added
- **应用图标统一**：源图 `docs/1.png`（1502×1502 透明圆角 PNG），经 `pnpm tauri icon docs/1.png` 一次性生成桌面 `src-tauri/icons/*` 与 Android `mipmap-*` 多分辨率集合；Android 自适应图标（foreground PNG + 背景色）正确接线。
- **Web favicon 三件套**：`public/favicon.ico`（多尺寸）、`public/favicon.svg`、`public/apple-touch-icon.png`，由 `index.html` 的 `<link>` 引用。

### Fixed
- **打包后导航栏 / 设置页品牌 logo 不显示**：原 `<img src="/logo.png">` 在 Tauri `asset://` 协议 + `base: './'` 相对路径下打包后加载失败。改为内联 `data:` URI（`src/assets/logo.ts` 的 `appLogoDataUri`），导航栏与「关于」页 logo 在 exe / apk 安装后稳定显示。

### Changed
- **版本号**：`package.json` / `src-tauri/tauri.conf.json` / `Cargo.toml` / `Cargo.lock` / 中英文 i18n `version` 字段统一升至 `0.5.0`。

## [0.4.0] - 2026-08-03

v0.4.0 是修复版：核心是修复 Android APK 交叉编译链接失败（经 Gradle 调起 cargo 时 linker 回落宿主 gcc）、并让 APK 可正常安装（apksigner 签名）、修复桌面端 CSP 运行期 JS 错误；同时完成一轮无障碍 / i18n / 数据健壮性修复，补充 AI 服务安全单测。

### Fixed
- **Android APK 交叉编译链接（CI）**：Tauri 的 android 构建经 Gradle 插件调起 cargo（`pnpm tauri android android-studio-script`），Gradle daemon 不继承 CI 步骤的 `CARGO_TARGET_*_LINKER` 环境变量，导致 rustc 链接 cdylib 时回落宿主 `gcc(cc)`、缺 Android sysroot 而报 `unable to find library -landroid/-llog/-lunwind`。改为仓库根 `.cargo/config.toml` 为 4 个 Android target 指定 NDK clang 作 linker（armv7 用 NDK 侧名 `armv7a-linux-androideabi-clang`），cargo 无论从哪条路径被调用都会读取；`release.yml` 软链步骤覆盖全部 4 个 ABI，并移除已失效的 `CARGO_TARGET_*_LINKER` env。
- **Android 出包改走 gradle**：`tauri build --target aarch64-linux-android` 在 bundle 阶段报 `Native android bundles not yet supported`，改为 `pnpm tauri android build --apk --ci -t aarch64`。
- **APK 签名（可安装）**：未签名 APK 无法安装（报「包似乎无效 / 缺开发者证书」）。配置 `KEYSTORE_BASE64` / `KEY_ALIAS` / `KEY_PASSWORD` Secrets 时，用 `apksigner` 对产出 APK 签名后上传；未配置时保持 debug key 签名。
- **CSP 运行期 JS 错误**：vue-i18n 9 用 `new Function` 编译消息模板，CSP `script-src` 未放行 `unsafe-eval` 导致 exe 报错，已放行（本地优先桌面应用，风险可控）。
- **SDK 平台版本对齐（CI）**：gen/android 工程 `compileSdk=36`，CI 原装 `android-34` 会在 AGP 阶段报 `failed to find target SDK 36`，改为 `platforms;android-36` + `build-tools;36.0.0`。
- **无障碍 / i18n 一致性**：Dashboard 待办完成 `aria-label` 改走 i18n；FAB 缺省 `aria-label` 用 `common.add`；纪念日/好句表单 Esc 改全局监听，焦点在表单外也能关闭。
- **记账分类交互**：由可手输的 datalist 改为预设 chips 单选，与 `TX_CATEGORIES` 预设一致，避免自由分类无法再编辑。
- **数据健壮性**：备份校验对新增表（transactions/workouts/weights/anniversaries/quotes）元素补 `id` 校验，避免 IndexedDB 主键缺失写入异常；Notes 内容预览改分步清洗 markdown 符号。
- **AI 服务单测**：新增 `ai.test.ts` 覆盖 `assertSafeUrl` SSRF 绕过向量、SSE/ndjson 流式解析、401/429 错误分支、空 Key 不携带 Authorization、`isTauri` 环境判定；`useAiStore` 暴露 `needsKey` 供 AI 视图复用（原定义未导出）。

## [0.3.0] - 2026-08-03

v0.3.0 是继 v0.2.0 之后的功能与健壮性大版本：新增多个生活模块、重做导航与备份、接入 AI × 本地数据上下文，并系统性修复了三轮安全/可访问性审查发现的问题（含 Rust 后端编译验证通过）。

### Added
- **生活模块**：健身 Fitness、记账 Ledger、纪念日 Anniversaries、记好句 Quotes。
- **日程与待办合并**：日程并入待办，统一为 GTD 风格的单一清单。
- **备份 v2**：全量 JSON 备份导入导出；命令面板支持页面/操作直达跳转；新增模块单元测试。
- **笔记删除撤销**：删除笔记后可撤销，Toast 支持动作按钮。
- **AI × 本地数据**：AI 对话可直接读取笔记/待办上下文（`buildContext` 注入，附注入安全提示），支持「就这篇笔记与 AI 讨论」「周总结」「规划待办」等快捷动作。
- **左侧抽屉式导航**：导航栏改为左侧抽屉，配 ⌘K 命令面板；按钮经半圆无阴影 → 正方形圆角迭代，打开时右侧页面自动收窄。
- **Android APK 自动构建（M5）**：`tauri android init` 生成 Android 工程骨架并提交仓库；`release.yml` 新增独立 android job（ubuntu + JDK17 + NDK r25c），推 `v0.3.0` 触发 Windows + Linux + APK 三端出包（未配签名 Secrets 时用 debug key 构建）。

### Changed
- **数据层**：升级至 Dexie v4 表结构。
- **备份合并策略**：由「按 id 去重」改为「较新时间戳胜」，导入不再覆盖本地更新的数据。
- **暗色主题**：对比度与复选框样式去重优化，可达性更好。

### Fixed
- **High（批次 A）**：修复 6 项高危问题（全局错误处理、数据安全等）。
- **数据层一致性（批次 B M-1~M-5）**：笔记删除改为先删盘再删内存，避免失败「复活」笔记；待办/设置补齐 `beforeunload` 落盘，关闭窗口不丢最后改动。
- **AI 流式健壮性（M-6/M-7/L-9）**：`readLines` 刷新尾行不丢数据；请求加 `withTimeout` 超时；云端 401/429 区分报错（未授权/限流）。
- **Rust 加固（M-9/M-10）**：`reqwest` 改 `rustls-tls` 去掉 native-tls；新增 AI 对话取消令牌 `cancel_ai_chat`。
- **并发确认（M-12）**：`useConfirm` 改为队列化，避免并发确认互相覆盖。
- **注入隔离 / clearSession / i18n（M-11/M-13/M-14/L-10）**：AI 清理历史先重置会话；快捷键/命令面板描述接入 i18n。
- **可访问性（C）**：设置项补齐 `beforeunload` flush；AI 对话区 `role="log"` 改 `aria-live="off"`，避免流式逐 token 被读屏器刷屏；滚动尊重 `prefers-reduced-motion`。
- **健壮性（C L-1~L-8）**：`storage.createCrud` 真实 `async/await`；`TodoBadges` 优先级兜底；`Todos.dueLabel` 去除非空断言；`useShortcuts` 输入框/可编辑区忽略快捷键；`BaseLayout` 抽屉 Esc 关闭 + 关闭时 `inert`/`aria-hidden`；命令面板打开时屏蔽全局快捷键；AI 消息 `key` 改用稳定 `id`；`markdown` 协议黑名单补全 `ftp`/`tel` 防 XSS。
- **Tauri v2 命令权限与命名规范**：原 `ai_chat`/`cancel_ai_chat` 含下划线违反 Tauri v2 ACL 标识符规则，改为 `ai-chat`/`cancel-ai-chat`，补 `permissions/*.toml` 并同步前端 `invoke`；`cargo check` 通过。

## [0.2.0]

- 新增全局 Toast 通知与 AI 多会话功能。
- 新增 en-US 第二语种与语言切换，清理死字段。
- 全站 UI 文案经 vue-i18n 渲染。
- 多轮安全/稳定性审查修复（Critical/High/Medium/Low）。

[0.5.0]: https://github.com/binghenblog/qingjian/releases/tag/v0.5.0
[0.4.0]: https://github.com/binghenblog/qingjian/releases/tag/v0.4.0
[0.3.0]: https://github.com/binghenblog/qingjian/releases/tag/v0.3.0
[0.2.0]: https://github.com/binghenblog/qingjian/releases/tag/v0.2.0
