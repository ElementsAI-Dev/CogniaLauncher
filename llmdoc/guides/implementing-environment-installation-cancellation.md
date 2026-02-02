# How to Implement Environment Installation Cancellation

1. **Create cancellation token:** When starting installation, create an `Arc<AtomicBool>` and store it in `CancellationTokens` HashMap with key `"envType:version"`.

2. **Check for cancellation:** In the installation loop (e.g., during download), periodically check the token: `if token.load(Ordering::SeqCst) { return Err(...); }`.

3. **Emit cancellation event:** When cancelled, emit error event via `app.emit("env-install-progress", EnvInstallProgress { step: "error", error: Some("cancelled"), .. })`.

4. **Clean up token:** Remove from HashMap after completion or cancellation.

5. **Frontend invokes:** Call `envInstallCancel(envType, version)` from `lib/tauri.ts:31-32` which triggers steps 3-4.

**Reference:** `src-tauri/src/commands/environment.rs:11-17` (get_cancel_key), `src-tauri/src/commands/environment.rs:323-353` (env_install_cancel).
