// T3MP3ST Tauri shell — thin webview over the loopback UI (docs/ served at /ui).
// All execution stays in the alongside Node API server; the shell owns no
// commands (capabilities/default.json is core:default only).

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
