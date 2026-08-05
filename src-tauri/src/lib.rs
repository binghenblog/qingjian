// 青简 Tauri 后端入口
// 当前已接入：AI 请求中转（保护 API Key，规避 CORS / CSP）
// 后续里程碑：Vault 文件系统监听（Obsidian 直连热更新）、本地加密（密码保险箱）

use futures_util::StreamExt;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::net::{IpAddr, ToSocketAddrs};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use tauri::ipc::Channel;
use tauri::State;

/// 密钥安全托管（审查 R-1）：桌面端把 API Key 存进系统凭据库
/// （Windows Credential Manager / macOS Keychain / Linux Secret Service+keyutils），
/// `ai-chat` 不再接收前端明文 Key，直接由本模块从凭据库读取。
/// 移动端（Android/iOS）不编译 keyring（见 Cargo.toml 平台限定依赖），
/// 命令返回「平台不支持」，由前端回退到直传明文（现状，无系统凭据库可用）。
#[cfg(not(any(target_os = "android", target_os = "ios")))]
mod secure_key {
    use keyring::Entry;

    const SERVICE: &str = "com.qingjian.app";
    const USER: &str = "qingjian";

    pub fn store(key: &str) -> Result<(), String> {
        Entry::new(SERVICE, USER)
            .map_err(|e| e.to_string())?
            .set_password(key)
            .map_err(|e| e.to_string())
    }

    pub fn load() -> Result<Option<String>, String> {
        let entry = Entry::new(SERVICE, USER).map_err(|e| e.to_string())?;
        match entry.get_password() {
            Ok(k) => Ok(Some(k)),
            Err(keyring::Error::NoEntry) => Ok(None),
            Err(e) => Err(e.to_string()),
        }
    }

    pub fn delete() -> Result<(), String> {
        let entry = Entry::new(SERVICE, USER).map_err(|e| e.to_string())?;
        match entry.delete_credential() {
            Ok(_) => Ok(()),
            Err(keyring::Error::NoEntry) => Ok(()),
            Err(e) => Err(e.to_string()),
        }
    }
}

/// 移动端回退实现：系统凭据库不可用，命令恒报「平台不支持」，前端据此走直传路径。
#[cfg(any(target_os = "android", target_os = "ios"))]
mod secure_key {
    pub fn store(_key: &str) -> Result<(), String> {
        Err("当前平台不支持系统凭据库".into())
    }
    pub fn load() -> Result<Option<String>, String> {
        Ok(None)
    }
    pub fn delete() -> Result<(), String> {
        Ok(())
    }
}

/// 保存 API Key 到系统凭据库（审查 R-1）。前端设置页在桌面端调用。
#[tauri::command(rename = "store-api-key")]
fn store_api_key(key: String) -> Result<(), String> {
    secure_key::store(&key)
}

/// 从系统凭据库读取 API Key（审查 R-1）。
#[tauri::command(rename = "load-api-key")]
fn load_api_key() -> Result<Option<String>, String> {
    secure_key::load()
}

/// 删除系统凭据库中的 API Key（审查 R-1）。
#[tauri::command(rename = "delete-api-key")]
fn delete_api_key() -> Result<(), String> {
    secure_key::delete()
}

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

/// 跨命令共享状态：进行中 AI 流式请求的取消令牌表，按 request_id 映射（审查 M-7）。
/// 每个 `ai_chat` 生成独立 `Arc<AtomicBool>` 作为取消令牌并以 request_id 登记，
/// `cancel_ai_chat` 仅置位对应请求，互不影响，新请求也不会清除旧请求的取消标志。
struct AiState {
    cancel: Mutex<HashMap<String, Arc<AtomicBool>>>,
}

/// 判定某 IP 是否受限（SSRF 防护，审查 C-1 / H-1 / M-1 / M-2）：
/// 覆盖回环 / 未指定 / 私有网段 / 链路本地 / 唯一本地 / 多播 / 文档地址。
/// IPv4-mapped IPv6（::ffff:a.b.c.d）先还原为 IPv4 再判定。
fn is_blocked_ip(ip: IpAddr) -> bool {
    let ip = match ip {
        IpAddr::V6(v6) => {
            if let Some(v4) = v6.to_ipv4_mapped() {
                IpAddr::V4(v4)
            } else {
                IpAddr::V6(v6)
            }
        }
        other => other,
    };
    match ip {
        IpAddr::V4(v4) => {
            let o = v4.octets();
            v4.is_unspecified()
                || v4.is_loopback()
                || v4.is_private()
                || v4.is_link_local()
                || v4.is_multicast()
                // 文档/测试网段（TEST-NET），is_documentation 当前不稳定，手工判定（审查 M-1）
                || (o[0] == 192 && o[1] == 0 && o[2] == 2)
                || (o[0] == 198 && o[1] == 51 && o[2] == 100)
                || (o[0] == 203 && o[1] == 0 && o[2] == 113)
        }
        IpAddr::V6(v6) => {
            let o = v6.octets();
            v6.is_unspecified()
                || v6.is_loopback()
                || v6.is_unique_local()
                || v6.is_unicast_link_local()
                || v6.is_multicast()
                // 2001:db8::/32 文档网段（is_documentation 不稳定，手工判定，审查 M-1）
                || (o[0] == 0x20 && o[1] == 0x01 && o[2] == 0x0d && o[3] == 0xb8)
        }
    }
}

/// 校验 host 是否受限（SSRF 防护，审查 H-1 / H-3 / M-1 / M-2）：
/// - 先尝试当 IP 字面量解析（覆盖十进制 `2130706433` / 十六进制 `0x7f000001` / 尾点 `127.0.0.1.` 等编码绕过）；
/// - 失败则作为域名用系统 resolver 解析全部 A/AAAA 记录，逐一判定网段（覆盖 `127.0.0.0/8`、`10/8`、`172.16/12`、`192.168/16`、`169.254/16`、`fe80::/10`、`fc00::/7`、`::1`）。
/// 解析失败（DNS 不可达等）保守拦截，避免放行未知地址。
async fn is_blocked_host(host: &str) -> bool {
    // 纯 IP 字面量（调用方已去除 IPv6 方括号）
    if let Ok(ip) = host.parse::<IpAddr>() {
        return is_blocked_ip(ip);
    }
    // 域名：阻塞式 DNS 解析（spawn_blocking 避免阻塞 async executor），逐 IP 判定
    let host = host.to_string();
    tokio::task::spawn_blocking(move || {
        match (host.as_str(), 0u16).to_socket_addrs() {
            Ok(mut addrs) => addrs.any(|a| is_blocked_ip(a.ip())),
            // 解析失败：保守策略，拦截（宁可误拦，不放开内网）
            Err(_) => true,
        }
    })
    .await
    .unwrap_or(true)
}

/// 校验并归一化 AI 接口地址（审查 H-3 / H-5 / M-23）：必须 http/https；拦截受限 host。
async fn safe_url(raw: &str) -> Result<String, String> {
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
    if is_blocked_host(&host).await {
        return Err("接口地址指向受限内部地址，已被安全策略拦截".into());
    }
    Ok(base.trim_end_matches('/').to_string())
}

/// 云端 AI 流式中转（审查 C-2 / C-3）。
/// 由 Rust 后端发起请求，密钥经前端传入但仅驻留内存、规避 WebView CSP / CORS 限制；
/// 通过 `Channel` 把每个 token 推回前端，保持流式体验。
///
/// ⚠️ 安全（审查 R-1，v0.5.1 起）：桌面端密钥已由 `secure_key` 模块从系统凭据库读取，
/// **不再信任前端传入的明文 Key**（`config.api_key` 在桌面端被忽略，杜绝 XSS 窃取后伪冒）。
/// 移动端（Android/iOS）无系统凭据库接入，回退到前端直传（现状）。
#[tauri::command(rename = "ai-chat")]
async fn ai_chat(
    config: AiConfig,
    messages: Vec<ChatMsg>,
    request_id: String,
    on_token: Channel<String>,
    state: State<'_, AiState>,
) -> Result<(), String> {
    // 本请求的独立取消令牌，按 request_id 登记（审查 M-7）
    let cancel_token = Arc::new(AtomicBool::new(false));
    state
        .cancel
        .lock()
        .expect("ai state lock poisoned")
        .insert(request_id.clone(), cancel_token.clone());

    let base = safe_url(&config.base_url).await?;
    let url = if base.ends_with("/chat/completions") {
        base
    } else {
        format!("{}/chat/completions", base)
    };

    // 桌面端：密钥从系统凭据库读取；移动端：回退到前端直传（审查 R-1）
    #[cfg(not(any(target_os = "android", target_os = "ios")))]
    let api_key: Option<String> = {
        // 显式引用前端传入字段以保持命令签名与移动端一致，但**不信任其值**（R-1）
        let _frontend_key = &config.api_key;
        secure_key::load().ok().flatten()
    };
    #[cfg(any(target_os = "android", target_os = "ios"))]
    let api_key: Option<String> = config.api_key.clone();

    let mut headers = reqwest::header::HeaderMap::new();
    headers.insert(
        reqwest::header::CONTENT_TYPE,
        reqwest::header::HeaderValue::from_static("application/json"),
    );
    if let Some(key) = &api_key {
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

    // 超时策略（审查 L-3）：仅限制连接建立（15s），流式读取不设硬性总超时，避免超长回复被截断；
    // 另对「空闲读」设置 60s 上限，防止云端保持连接但不发数据导致永久挂起。
    let client = reqwest::Client::builder()
        .connect_timeout(std::time::Duration::from_secs(15))
        // 严禁自动跟随重定向：SSRF 防护关键（审查 C-1）。攻击者配置的域名若 302 跳转到
        // 169.254.169.254 / 127.0.0.1 等内网，会原样携带 Authorization 头，导致凭证泄漏。
        .redirect(reqwest::redirect::Policy::none())
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
        let _ = state.cancel.lock().expect("ai state lock poisoned").remove(&request_id);
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
    const MAX_BUF: usize = 1 << 20; // 1 MiB：异常端点保护，防止内存膨胀（审查 L-2）
    loop {
        // 空闲读超时（审查 L-3）：60s 无新数据则中止
        let chunk = match tokio::time::timeout(std::time::Duration::from_secs(60), stream.next()).await {
            Ok(Some(c)) => c,
            Ok(None) => break,
            Err(_) => break,
        };
        if cancel_token.load(Ordering::Relaxed) {
            break;
        }
        let bytes = chunk.map_err(|e| e.to_string())?;
        buf.push_str(&String::from_utf8_lossy(&bytes));
        if buf.len() > MAX_BUF {
            buf.clear(); // 异常超长 payload：丢弃
        }
        while let Some(pos) = buf.find('\n') {
            let line: String = buf.drain(..pos + 1).collect();
            let line = line.trim();
            if line.is_empty() || !line.starts_with("data:") {
                continue;
            }
            let data = line.trim_start_matches("data:").trim();
            if data == "[DONE]" {
                let _ = on_token.send("__DONE__".to_string());
                let _ = state.cancel.lock().expect("ai state lock poisoned").remove(&request_id);
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
    // 流结束：处理不以换行结尾的末行（审查 L-2），避免最后 token 丢失
    let rest = buf.trim();
    if !rest.is_empty() && rest.starts_with("data:") {
        let data = rest.trim_start_matches("data:").trim();
        if data != "[DONE]" {
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
    let _ = state.cancel.lock().expect("ai state lock poisoned").remove(&request_id);
    Ok(())
}

/// 取消指定 request_id 的 AI 流式请求（审查 H-8 / M-7）：仅置位对应令牌，互不影响。
#[tauri::command(rename = "cancel-ai-chat")]
fn cancel_ai_chat(request_id: String, state: State<'_, AiState>) {
    let guard = state.cancel.lock().expect("ai state lock poisoned");
    if let Some(token) = guard.get(&request_id) {
        token.store(true, Ordering::Relaxed);
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .manage(AiState {
            cancel: Mutex::new(HashMap::new()),
        })
        .invoke_handler(tauri::generate_handler![
            ai_chat,
            cancel_ai_chat,
            store_api_key,
            load_api_key,
            delete_api_key
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
