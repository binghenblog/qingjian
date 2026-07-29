# 贡献指南

欢迎参与青简的开发！

## 开发环境
- Node 22+、pnpm
- Rust 工具链（仅桌面 / 移动端 Tauri 构建需要，[rustup](https://rustup.rs)）
- 安装依赖：`pnpm install`

## 分支模型
- `main` 受保护，始终可发布。
- 新功能在 `feature/*` 分支开发，完成后提 PR 合并。

## 提交规范
采用 Conventional Commits：`feat:`、`fix:`、`docs:`、`chore:`、`refactor:`、`test:` 等。

## 本地运行
- Web：`pnpm dev`（http://localhost:1420）
- Tauri：`pnpm tauri dev`

## 安全约定
- 不要提交任何密钥、`.env`、用户数据或签名文件（已被 `.gitignore` 忽略）。
- 详见 [SECURITY.md](SECURITY.md) 与开发文档 10.6。
