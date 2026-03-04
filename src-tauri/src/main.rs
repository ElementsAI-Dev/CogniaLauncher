// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

/// Attach to the parent console on Windows release builds so CLI output is visible.
/// This is a no-op when launched without a console (e.g. double-click from Explorer).
#[cfg(all(windows, not(debug_assertions)))]
fn try_attach_console() {
    // If there are positional args (subcommands) or --help/--version, we need console output
    let has_subcommand = std::env::args()
        .skip(1)
        .any(|a| !a.starts_with('-') && !a.starts_with('/'));
    let has_help_or_version =
        std::env::args().any(|a| a == "--help" || a == "-h" || a == "--version" || a == "-V");
    if has_subcommand || has_help_or_version {
        unsafe {
            windows_sys::Win32::System::Console::AttachConsole(
                windows_sys::Win32::System::Console::ATTACH_PARENT_PROCESS,
            );
        }
    }
}

fn main() {
    #[cfg(all(windows, not(debug_assertions)))]
    try_attach_console();

    app_lib::run();
}
