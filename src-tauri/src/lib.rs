// 青简 Tauri 后端入口
// 后续里程碑将在此接入：
//  - AI 请求中转（保护 API Key，规避 CORS）
//  - Vault 文件系统监听（Obsidian 直连热更新）
//  - 本地加密（密码保险箱）
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_sql::Builder::default().build())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
