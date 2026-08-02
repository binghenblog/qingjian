// 青简 Tauri 后端入口
// 当前已接入：AI 请求中转（保护 API Key，规避 CORS / CSP）
// 后续里程碑：Vault 文件系统监听（Obsidian 直连热更新）、本地加密（密码保险箱）

use futures_util::StreamExt;
use serde::{Deserialize, Serialize};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use tauri::ipc::Channel;
use tauri::State;

#[derive(Deserialize)]
struct AiConfig {
    base_url: String,
    api_key: Option<String>,
    model: String,
}

#[derive(Serialize, Deserialize, Clone)]
struct ChatMsg {
    role: String,
    content: String,
}

/// 跨命令共享状态：当前 AI 流式请求的取消标记（审查 H-8 / M-10）。
/// 每次 `ai_chat` 生成独立的 `Arc<AtomicBool>` 作为取消令牌并写入此处，
/// 因此取消「当前」请求不会误伤其它并发请求，新请求也不会清除旧请求的取消标志。
struct AiState {
    cancel: Mutex<Arc<AtomicBool>>,
}

/** 受限内部地址：回环 / 私有网段 / 链路本地 / 唯一本地，SSRF 防护（审查 H-3 / H-5 / M-23）。
 * 说明：Rust 中转命令 `ai_chat` 仅由「云端」provider 调用（本地 Ollama 走前端直连路径），
 * 因此此处可放心拦截所有私有/回环地址，避免恶意配置诱导后端携带 API Key 请求内网造成凭证泄漏。 */
fn is_blocked_host(host: &str) -> bool {
    let h = host.to_lowercase();
    // 回环 / 全零
    if h == "localhost" || h == "0.0.0.0" || h == "127.0.0.1" || h == "::1" || h == "::" {
        return true;
    }
    if h.contains(':') {
        // IPv6：链路本地 fe80::/10、唯一本地 fc00::/7
        return h.starts_with("169.254.") || h.starts_with("fe80") || h.starts_with("fc") || h.starts_with("fd");
    }
    if h.contains('.') {
        // IPv4 链路本地
        if h.starts_with("169.254.") {
            return true;
        }
        // 解析前两段，判定 RFC 1918 私有网段
        let mut parts = h.split('.');
        let first: u32 = match parts.next().and_then(|p| p.parse().ok()) {
            Some(v) if v <= 255 => v,
            _ => return false,
        };
        let second: u32 = match parts.next().and_then(|p| p.parse().ok()) {
            Some(v) if v <= 255 => v,
            _ => return false,
        };
        // 10.0.0.0/8、172.16.0.0/12、192.168.0.0/16
        return first == 10 || (first == 172 && (16..=31).contains(&second)) || (first == 192 && second == 168);
    }
    false
}

/// 校验并归一化 AI 接口地址（审查 H-3 / H-5）：必须 http/https；拦截回环/私有/链路本地地址。
fn safe_url(raw: &str) -> Result<String, String> {
    let base = raw.trim();
    if base.is_empty() {
        return Err("未填写 AI 接口地址".into());
    }
    // 协议白名单：仅允许 http / https
    let after_scheme = if let Some(rest) = base.strip_prefix("https://") {
        rest
    } else if let Some(rest) = base.strip_prefix("http://") {
        rest
    } else {
        return Err("不支持的协议，仅允许 http/https".into());
    };
    // 取主机部分并去除端口 / IPv6 方括号，用于 SSRF 拦截
    let raw_host = after_scheme
        .split(['/', '?', '#'])
        .next()
        .unwrap_or("")
        .to_lowercase();
    let host = if raw_host.starts_with('[') {
        // [IPv6]:port 形式
        raw_host.trim_start_matches('[').split(']').next().unwrap_or("").to_string()
    } else if raw_host.contains("::") {
        raw_host.to_string() // 缩写 IPv6，端口须加方括号，此处直接判定
    } else if let Some(idx) = raw_host.rfind(':') {
        raw_host[..idx].to_string() // 非 IPv6 缩写：冒号后为端口
    } else {
        raw_host
    };
    if is_blocked_host(&host) {
        return Err("接口地址指向受限内部地址，已被安全策略拦截".into());
    }
    Ok(base.trim_end_matches('/').to_string())
}

/// 云端 AI 流式中转（审查 C-2 / C-3）。
/// 由 Rust 后端发起请求，密钥不进入前端 JS，规避 WebView CSP / CORS 限制；
/// 通过 `Channel` 把每个 token 推回前端，保持流式体验。
#[tauri::command]
async fn ai_chat(
    config: AiConfig,
    messages: Vec<ChatMsg>,
    on_token: Channel<String>,
    state: State<'_, AiState>,
) -> Result<(), String> {
    // 生成本次请求的独立取消令牌，替换当前令牌（审查 M-10）
    let cancel_token = Arc::new(AtomicBool::new(false));
    *state.cancel.lock().unwrap() = cancel_token.clone();

    let base = safe_url(&config.base_url)?;
    let url = if base.ends_with("/chat/completions") {
        base
    } else {
        format!("{}/chat/completions", base)
    };

    let mut headers = reqwest::header::HeaderMap::new();
    headers.insert(
        reqwest::header::CONTENT_TYPE,
        reqwest::header::HeaderValue::from_static("application/json"),
    );
    if let Some(key) = &config.api_key {
        if !key.trim().is_empty() {
            let val = format!("Bearer {}", key);
            headers.insert(
                reqwest::header::AUTHORIZATION,
                reqwest::header::HeaderValue::from_str(&val).map_err(|e| e.to_string())?,
            );
        }
    }

    let body = serde_json::json!({
        "model": config.model,
        "messages": messages,
        "stream": true
    });

    // 请求超时，避免云端无响应时应用永久挂起（审查 H-7）
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(120))
        .build()
        .map_err(|e| e.to_string())?;

    let res = client
        .post(&url)
        .headers(headers)
        .json(&body)
        .send()
        .await
        .map_err(|e| e.to_string())?;

    if !res.status().is_success() {
        let status = res.status().as_u16();
        let txt = res.text().await.unwrap_or_default();
        // 按字符截断（非字节），避免多字节 UTF-8 落在边界处 panic（审查 H-6）
        let clip: String = txt.chars().take(200).collect();
        return Err(format!(
            "云端请求失败 ({}){}",
            status,
            if clip.is_empty() {
                String::new()
            } else {
                format!(": {}", clip)
            }
        ));
    }

    let mut stream = res.bytes_stream();
    let mut buf = String::new();
    while let Some(chunk) = stream.next().await {
        // 用户点「停止」→ 中止循环（审查 H-8 / M-10，仅检查本请求的令牌）
        if cancel_token.load(Ordering::Relaxed) {
            break;
        }
        let bytes = chunk.map_err(|e| e.to_string())?;
        buf.push_str(&String::from_utf8_lossy(&bytes));
        while let Some(pos) = buf.find('\n') {
            let line: String = buf.drain(..pos + 1).collect();
            let line = line.trim();
            if line.is_empty() || !line.starts_with("data:") {
                continue;
            }
            let data = line.trim_start_matches("data:").trim();
            if data == "[DONE]" {
                let _ = on_token.send("__DONE__".to_string());
                return Ok(());
            }
            if let Ok(v) = serde_json::from_str::<serde_json::Value>(data) {
                if let Some(delta) = v
                    .get("choices")
                    .and_then(|c| c.get(0))
                    .and_then(|c| c.get("delta"))
                    .and_then(|d| d.get("content"))
                    .and_then(|c| c.as_str())
                {
                    let _ = on_token.send(delta.to_string());
                }
            }
        }
    }
    let _ = on_token.send("__DONE__".to_string());
    Ok(())
}

/// 取消进行中的 AI 流式请求（审查 H-8 / M-10）：仅置位当前请求的令牌。
#[tauri::command]
fn cancel_ai_chat(state: State<'_, AiState>) {
    let guard = state.cancel.lock().unwrap();
    guard.store(true, Ordering::Relaxed);
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .manage(AiState {
            cancel: Mutex::new(Arc::new(AtomicBool::new(false))),
        })
        .invoke_handler(tauri::generate_handler![ai_chat, cancel_ai_chat])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
