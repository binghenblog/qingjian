# 安全政策

青简是本地优先应用，用户的笔记、Vault、密码库均存储于本地。我们高度重视隐私与安全。

## 报告漏洞
- 推荐：仓库 → **Security → Report a vulnerability**（GitHub Security Advisory，私密上报）。
- 或提 Issue，标题以 `[SECURITY]` 开头，避免公开敏感细节。
- 我们会尽快响应并修复。

## 密钥与数据
- 云端 AI Key 仅存本地、经 Tauri 后端中转，**绝不进入前端包体或仓库**。
- 仓库不含任何真实用户数据；`.env`、`*.db`、用户数据目录已被 `.gitignore` 忽略。
- 签名密钥（Windows / Android）仅存 CI Secrets，绝不入库。

## 依赖安全
- 已启用 Dependabot 与 CodeQL（见 `.github/`）。
- 如发现依赖漏洞，请一并上报。

## 负责任披露
请给我们合理时间来修复，再公开细节。感谢你的贡献让青简更安全。
