# 青简（QingJian）

轻量、现代、开源、本地优先的个人工作台，原生支持 AI。

> 当前为 **M0 脚手架阶段**（2026-07-29）。功能仍在按里程碑推进，详见 [开发文档](docs/青简-开发文档.md)。

## 特性（规划）
- **本地优先**：数据默认存本地，离线可用，云端为可选增强
- **知识库**：Markdown 笔记；V1 支持 Obsidian Vault 直连（`[[双链]]`、#标签、frontmatter）
- **效率**：仪表盘、待办、全局命令面板（⌘K）
- **AI 助手**：云端（OpenAI 兼容）+ 本地（Ollama）双通道，经 Tauri 后端中转，Key 不进前端
- **跨端**：一套前端代码打包为桌面 exe 与移动 apk（Tauri v2）

## 技术栈
Vue 3 + Vite + TypeScript · UnoCSS · Pinia · Vue Router · Tauri v2 · SQLite / Dexie

## 快速开始
要求：**Node 22+**、**pnpm**。

### Web 开发
```bash
pnpm install
pnpm dev        # http://localhost:1420
pnpm build      # 产物 dist/
```

### 桌面 / 移动（Tauri）
要求 Rust 工具链（[rustup](https://rustup.rs)）。
```bash
pnpm install
pnpm tauri dev      # 开发窗口
pnpm tauri build    # 出包（exe / apk 等）
```

## 项目结构
见 [开发文档](docs/青简-开发文档.md) 第 8 节。

## 安全
密钥与用户数据绝不入库。详见 [SECURITY.md](SECURITY.md) 与开发文档 10.6「发布前安全清单」。

## 许可证
[MIT](LICENSE)
