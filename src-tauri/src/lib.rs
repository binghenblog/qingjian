// 青简 Tauri 后端入口
// 当前已接入：AI 请求中转（保护 API Key，规避 CORS / CSP）
// 后续里程碑：Vault 文件系统监听（Obsidian 直连热更新）、本地加密（密码保险箱）

use futures_util::StreamExt;
use serde::{Deserialize, Serialize};
use tauri::ipc::Channel;

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

/// 云端 AI 流式中转（审查 C-2 / C-3）。
/// 由 Rust 后端发起请求，密钥不进入前端 JS，规避 WebView CSP / CORS 限制；
/// 通过 `Channel` 把每个 token 推回前端，保持流式体验。
#[tauri::command]
async fn ai_chat(config: AiConfig, messages: Vec<ChatMsg>, on_token: Channel<String>) -> Result<(), String> {
    let client = reqwest::Client::new();
    let base = config.base_url.trim_end_matches('/');
    let url = if base.ends_with("/chat/completions") {
        base.to_string()
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
        let clip = if txt.len() > 200 { &txt[..200] } else { &txt };
        return Err(format!(
            "云端请求失败 ({}){}",
            status,
            if clip.is_empty() { String::new() } else { format!(": {}", clip) }
        ));
    }

    let mut stream = res.bytes_stream();
    let mut buf = String::new();
    while let Some(chunk) = stream.next().await {
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

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .invoke_handler(tauri::generate_handler![ai_chat])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
