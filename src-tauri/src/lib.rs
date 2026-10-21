// T3MP3ST Tauri shell — thin webview over the loopback UI (docs/ served at /ui).
// In prod builds the shell spawns the bundled API-server sidecar itself via
// std::process::Command (no tauri-plugin-shell, no webview capability);
// in dev, beforeDevCommand keeps running `npm run server` alongside instead.

use std::net::TcpStream;
use std::path::{Path, PathBuf};
use std::process::{Child, Command};
use std::sync::{Arc, Mutex};
use std::time::Duration;

use tauri::Manager;

const SIDECAR_PORT: u16 = 3333;

/// Poll the sidecar's loopback listener. Best effort: ~10s of 250ms attempts.
fn wait_for_sidecar(port: u16) -> bool {
    for _ in 0..40 {
        if TcpStream::connect(("127.0.0.1", port)).is_ok() {
            return true;
        }
        std::thread::sleep(Duration::from_millis(250));
    }
    eprintln!(
        "[purple-team] sidecar not answering on 127.0.0.1:{port} after 10s; continuing anyway"
    );
    false
}

/// Sidecar file names. The .deb ships the sidecar next to the app binary
/// (usr/bin). The AppImage ships it under usr/lib/t3mp3st-sidecar instead, so
/// linuxdeploy never rewrites its RPATH (see docs/TAURI.md, phase 41).
const SIDECAR_FILE: &str = "t3mp3st-server";
const SIDECAR_FILE_EXE: &str = "t3mp3st-server.exe";
const APPIMAGE_SIDECAR_DIR: &str = "t3mp3st-sidecar";

/// Finds the bundled sidecar for an app binary living in `dir`: first next to
/// the binary (deb layout), then under `../lib/t3mp3st-sidecar` (AppImage layout).
fn sidecar_binary(dir: &Path) -> Option<PathBuf> {
    let lib_dir = dir.parent().map(|usr| usr.join("lib").join(APPIMAGE_SIDECAR_DIR));
    [Some(dir.to_path_buf()), lib_dir]
        .into_iter()
        .flatten()
        .flat_map(|candidate| [candidate.join(SIDECAR_FILE), candidate.join(SIDECAR_FILE_EXE)])
        .find(|path| path.exists())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Shared handle to the spawned API server, taken and reaped on exit.
    let sidecar: Arc<Mutex<Option<Child>>> = Arc::new(Mutex::new(None));

    let spawned = Arc::clone(&sidecar);
    tauri::Builder::default()
        .setup(move |app| {
            // Dev keeps the documented flow (beforeDevCommand runs
            // `npm run server`); the sidecar is a prod-only concern.
            if !tauri::is_dev() {
                if let Ok(exe) = std::env::current_exe() {
                    if let Some(dir) = exe.parent() {
                        if let Some(sidecar_path) = sidecar_binary(dir) {
                            // express.static('docs') and express.static('ui/dist') are
                            // cwd-relative. Bundle resources map ../docs/ → resource_dir/docs
                            // and ../ui/dist/ → resource_dir/ui/dist, so the sidecar's cwd is
                            // the resource dir when the docs mount exists. State stays
                            // in-memory unless T3MP3ST_STATE_DIR is set, so this cwd is safe.
                            let cwd = app
                                .path()
                                .resource_dir()
                                .ok()
                                .filter(|resource| resource.join("docs").is_dir())
                                .unwrap_or_else(|| dir.to_path_buf());
                            match Command::new(&sidecar_path)
                                .env("T3MP3ST_PORT", SIDECAR_PORT.to_string())
                                .current_dir(&cwd)
                                .spawn()
                            {
                                Ok(child) => {
                                    eprintln!(
                                        "[purple-team] sidecar spawned (pid {}), port {SIDECAR_PORT}",
                                        child.id()
                                    );
                                    if let Ok(mut slot) = spawned.lock() {
                                        *slot = Some(child);
                                    }
                                    if wait_for_sidecar(SIDECAR_PORT) {
                                        // Same-origin loopback UI: the page and
                                        // the API share 127.0.0.1, so the
                                        // existing origin gate applies unchanged.
                                        if let Some(window) = app.get_webview_window("main") {
                                            // Land on the React dashboard when its build ships in the
                                            // bundle; a bundle without it keeps the static pages.
                                            let entry = if cwd.join("ui").join("dist").join("index.html").is_file() {
                                                "app"
                                            } else {
                                                "ui"
                                            };
                                            let url = format!("http://127.0.0.1:{SIDECAR_PORT}/{entry}/");
                                            match url.parse::<tauri::Url>() {
                                                Ok(parsed) => {
                                                    if let Err(err) = window.navigate(parsed) {
                                                        eprintln!(
                                                            "[purple-team] webview navigate failed: {err}"
                                                        );
                                                    }
                                                }
                                                Err(err) => {
                                                    eprintln!("[purple-team] sidecar UI url invalid: {err}");
                                                }
                                            }
                                        }
                                    }
                                }
                                Err(err) => {
                                    eprintln!(
                                        "[purple-team] sidecar spawn failed: {err}; continuing \
                                         without it (degraded shell — run `npm run server` \
                                         alongside)"
                                    );
                                }
                            }
                        } else {
                            eprintln!(
                                "[purple-team] no sidecar binary next to {dir:?}; continuing \
                                 without it (degraded shell — run `npm run server` alongside)"
                            );
                        }
                    }
                }
            }
            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("error while running tauri application")
        .run(move |_, event| {
            if let tauri::RunEvent::Exit = event {
                // Kill + reap: no orphaned API server outlives the shell.
                if let Some(mut child) = sidecar.lock().ok().and_then(|mut slot| slot.take()) {
                    let _ = child.kill();
                    let _ = child.wait();
                }
            }
        });
}
