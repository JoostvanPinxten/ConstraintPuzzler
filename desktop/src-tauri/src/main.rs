// The desktop app: a window that shows the web build of the app (app/dist). All puzzle logic is
// in the web code; this only hosts it.

// no console window next to the app on Windows (release builds)
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    tauri::Builder::default()
        .run(tauri::generate_context!())
        .expect("error while running ConstraintPuzzler");
}
