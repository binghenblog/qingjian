<p align="center">
  <img src="public/favicon.svg" alt="青简" width="96" />
</p>

<h1 align="center">青简（QingJian）</h1>

<p align="center">
  轻量 · 现代 · 开源 · 本地优先的个人工作台，原生支持 AI
</p>

<p align="center">
  <img alt="License" src="https://img.shields.io/badge/license-MIT-blue.svg" />
  <img alt="Version" src="https://img.shields.io/badge/version-0.1.0-orange.svg" />
  <img alt="Platform" src="https://img.shields.io/badge/platform-Windows%20%7C%20Linux%20%7C%20macOS%20%7C%20Android-2ea043.svg" />
  <img alt="Stack" src="https://img.shields.io/badge/stack-Vue%203%20%2B%20Tauri%20v2-42b883.svg" />
</p>

---

## 简介

**青简** 是一个面向注重隐私与效率的个人用户的本地优先（Local-First）工作台：你的笔记、待办与对话数据默认全部存在你自己设备上，离线可用，云端只是可选增强项，而非使用前提。

首期以 **Web 端**交付（同时兼容 Tauri 桌面窗口与移动端视图），后续通过 **Tauri v2** 一键打包为桌面 `exe` 与移动 `apk`。AI 能力内置统一接口，既可接入云端大模型（OpenAI 兼容协议），也可接入本机运行的本地模型（Ollama），二者随时切换。

> 设计原则：**MVP 的全部功能均不依赖云端即可完整使用**；同步 / 云端始终是增强项，而非前置条件。

---

## ✨ 特性

- **📊 仪表盘**：问候语 + 今日待办概览 + 统计卡片，打开即见全局。
- **📝 知识库 / 笔记**：Markdown 编辑、文件夹分组、`#标签`、全文搜索（关键字高亮）、`[[双链]]` 渲染、命令面板内直接搜索笔记。
- **✅ 待办 / 任务**：
  - 预设分类：**每日 / 生活 / 工作 / 学习 / 游戏**，支持自定义分类。
  - 「每日任务」置顶，并突出显示**昨日未完成项**（变色提示）。
  - 优先级、截止日、完成态、进度条。
- **⌘ 命令面板**：`⌘K` / `Ctrl+K` 全局唤起，搜索与操作直达；核心页面支持 `Alt+1~5` 快捷键直达。
- **🤖 AI 助手**：
  - 双通道：**云端（OpenAI 兼容）** + **本地（Ollama）**，统一接口、随时切换。
  - 流式输出（打字机效果）、可中止。
  - 云端请求经 **Tauri 后端中转**，**API Key 仅存本地、绝不进入前端包体**。
- **⚙️ 设置**：主题（亮 / 暗 / 跟随系统）、AI 配置、数据导出 / 导入、快捷键说明。
- **💾 数据可携带**：全量 JSON 备份导出 / 导入（合并或替换，密钥安全脱敏）；Vault 直连模式规划中（见路线图）。

---

## 🚀 快速开始

### 要求

- **Node.js 22+**
- **pnpm**（项目使用 `pnpm@11`，见 `package.json` 的 `packageManager` 字段）
- 桌面 / 移动打包额外需要 **Rust 工具链**（[rustup](https://rustup.rs)）

### Web 开发

```bash
pnpm install
pnpm dev        # 启动开发服务器，默认 http://localhost:1420
pnpm build      # 构建产物输出到 dist/
pnpm preview    # 本地预览构建产物
pnpm test       # 运行单元测试（Vitest）
pnpm typecheck  # 类型检查（vue-tsc）
```

### 桌面 / 移动（Tauri v2）

```bash
pnpm install
pnpm tauri dev      # 启动桌面开发窗口
pnpm tauri build    # 打包出安装包（Windows: .msi/.exe；Linux/macOS；Android: .apk）
```

> 打包签名所需的 Windows 代码签名证书与 Android `keystore` **仅存放于 CI Secrets**，不进入仓库。详见 [SECURITY.md](SECURITY.md) 与开发文档的「发布前安全清单」。

---

## 🧠 AI 配置

在「设置 → AI」中切换与配置：

**本地模型（Ollama，默认，零流量）**
1. 安装 [Ollama](https://ollama.com) 并拉取模型，例如：`ollama pull llama3`。
2. 保持默认 `Base URL = http://127.0.0.1:11434`、模型 `llama3` 即可使用。

**云端模型（OpenAI 兼容）**
1. 将「提供方」切换为「云端」。
2. 填写 `Base URL`（如 `https://api.openai.com/v1` 或任意兼容端点）与 `Model`。
3. 填写 `API Key`：
   - 默认**仅存于当前会话（sessionStorage）**，关闭页面即清除；
   - 勾选「记住密钥」后存于本地 `localStorage`。
   - 密钥在 Web 端默认不入库，且经 Tauri 后端中转，不会出现在前端产物中。
4. 自定义 `Base URL` 已做 **SSRF 防护**（限制为本机或白名单域名，屏蔽云元数据地址）。

---

## 📁 项目结构

```
qingjian/
├── public/                # 静态资源（图标等）
├── src/                   # 前端源码（Vue 3 + Vite）
│   ├── components/        # 通用组件（命令面板、任务徽章）
│   ├── composables/       # 组合式逻辑（主题、快捷键）
│   ├── layouts/           # 布局（侧边栏 + 内容区）
│   ├── services/         # 业务逻辑（AI / 存储 / 备份 / Markdown / Tauri 桥）
│   ├── stores/           # Pinia 状态（笔记 / 待办 / 设置）
│   ├── styles/           # UnoCSS 与主题变量
│   ├── views/            # 页面（仪表盘 / 笔记 / 待办 / AI / 设置）
│   ├── router/           # 路由（hash 模式）
│   └── main.ts
├── src-tauri/             # Tauri（Rust）工程：存储 / AI 中转 / 权限 / 打包
├── .github/workflows/     # CI（lint + test + build）/ Release（tauri-action）
├── tests / __tests__      # 单元测试（Vitest）
├── README.md
├── CONTRIBUTING.md
├── SECURITY.md
└── LICENSE
```

---

## 🏗️ 架构

```
┌─────────────────────────────────────────────┐
│               前端 (Vue 3 + Vite)             │
│  UI 组件层 → Pinia 状态 → Repository 数据层    │
│  AI 服务层 (AIProvider 抽象)                  │
└───────────────┬───────────────────┬──────────┘
                │ Tauri invoke      │ HTTP(S)
                ▼                   ▼
┌──────────────────────┐   ┌────────────────────────┐
│  Tauri (Rust) 后端    │   │  外部 AI 服务            │
│  - SQLite 存储        │   │  - 云端：OpenAI 兼容 API │
│  - 文件系统 / 路径    │   │  - 本地：Ollama(本机)    │
│  - AI 请求中转(安全)  │   └────────────────────────┘
└──────────────────────┘
         │
         ▼
┌──────────────────────┐
│  本地数据目录          │
│  qingjian.db (SQLite) │
│  附件 / 配置 / 缓存    │
└──────────────────────┘
```

- **存储抽象**：通过 `StorageAdapter` 接口屏蔽差异——桌面用 SQLite，Web 用 Dexie / IndexedDB（schema 对齐），上层业务无感知。
- **AI 抽象**：统一 `AIProvider` 接口，业务层只调用 `chat()`，不感知云端 / 本地。

---

## 💾 数据存储与安全

- **本地优先**：Web 端数据存于浏览器 IndexedDB（Dexie）；桌面端存于本地 SQLite 文件，可整体复制备份。
- **密钥安全**：API Key 默认仅存会话，可选项本地持久化；云端请求经 Tauri 后端中转，Key 不进前端包体。
- **输入安全**：Markdown 链接做协议白名单校验（拦截 `javascript:` / `vbscript:` / `data:` / `file:` 等），防止 XSS。
- **网络防护**：自定义 AI endpoint 做 SSRF 校验，屏蔽云元数据地址。
- **仓库安全**：密钥、用户数据、`*.db`、构建产物均被 `.gitignore` 排除；启用 Dependabot / Secret Scanning / CodeQL（详见开发文档安全清单）。

更多细节见 [SECURITY.md](SECURITY.md)。

---

## 🗺️ 路线图

| 阶段 | 目标 | 状态 |
| --- | --- | --- |
| M0 脚手架 | Vue3 + Vite + Tauri v2 工程跑通 | ✅ |
| M1 数据层 | StorageAdapter + 笔记 / 待办 CRUD | ✅ |
| M2 核心 UI | 仪表盘 / 笔记编辑器 / 待办 / 命令面板 / 主题 | ✅ |
| M3 AI 接入 | AIProvider 双通道 + 流式对话 | ✅ |
| M4 打磨与导出 | 搜索 / 导出导入 / 设置 / 快捷键 / 安全加固 | ✅ |
| M5 跨端打包 | tauri-action 出 exe / apk，GitHub Release | 🚧 进行中 |
| V1 迭代 | 书签 / 时间线 / 文件柜 / 密码保险箱 / 多端同步 / **Obsidian Vault 直连** | 📋 规划 |

> **Obsidian 兼容**：Vault 本质是本地 Markdown + `.obsidian` 目录，数据格式开放。V1 计划支持「Vault 直连模式」——在设置中选择 Obsidian Vault 文件夹，青简直接读写其中的 `.md` 文件，成为 Obsidian 的「另一个前端」，兼容 `[[双链]]`、`#标签`、YAML frontmatter 与 `![[附件]]`。

---

## 🤝 贡献

欢迎 Issue 与 PR！

- 分支模型：受保护的 `main` + 短生命周期 `feature/*`，完成后提 PR。
- 提交规范：Conventional Commits（`feat:` / `fix:` / `docs:` / `chore:` …）。
- 开发环境搭建、代码规范与提交流程见 [CONTRIBUTING.md](CONTRIBUTING.md)。

---

## 📄 许可证

[MIT](LICENSE) © binghenblog
