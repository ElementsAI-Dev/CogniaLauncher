use crate::cache::MetadataCache;
use crate::core::{
    DetectedEnvironment, EnvCleanupResult, EnvUpdateCheckResult, EnvironmentInfo,
    EnvironmentManager, SharedVersionCache,
};
use crate::provider::{
    EnvironmentProvider, InstallProgressEvent, InstallRequest, InstallStage, ProgressSender,
    Provider, ProviderRegistry,
};
use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet};
use std::sync::Arc;
use tauri::{AppHandle, Emitter, State};
use tokio::sync::{mpsc, RwLock};

pub type SharedRegistry = Arc<RwLock<ProviderRegistry>>;

/// TTL constants for environment cache categories (in seconds)
const ENV_LIST_CACHE_TTL: i64 = 120; // 2 minutes
const ENV_SYSTEM_DETECT_TTL: i64 = 300; // 5 minutes
const ENV_INSTALLED_TTL: i64 = 60; // 1 minute
const ENV_PROVIDERS_TTL: i64 = 600; // 10 minutes (rarely changes)

async fn open_env_metadata_cache(
    config: &crate::commands::config::SharedSettings,
    ttl: i64,
) -> Result<MetadataCache, String> {
    let s = config.read().await;
    let cache_dir = s.get_cache_dir();
    drop(s);
    MetadataCache::open_with_ttl(&cache_dir, ttl)
        .await
        .map_err(|e| e.to_string())
}

/// Invalidate environment-related cache keys (called after install/uninstall/switch).
pub async fn invalidate_env_caches(config: &crate::commands::config::SharedSettings) {
    if let Ok(mut cache) = open_env_metadata_cache(config, ENV_LIST_CACHE_TTL).await {
        // Exact key removals
        let _ = cache.remove("env:list").await;
        let _ = cache.remove("env:system_all").await;
        let _ = cache.remove("env:providers").await;
        // Prefix removals (env:system:node, env:versions:node:fnm, env:available:node:fnm, etc.)
        let _ = cache.remove_by_prefix("env:system:").await;
        let _ = cache.remove_by_prefix("env:versions:").await;
        let _ = cache.remove_by_prefix("env:available:").await;
    }
}

/// Cancellation tokens for ongoing installations
pub type CancellationTokens = Arc<RwLock<HashMap<String, Arc<std::sync::atomic::AtomicBool>>>>;

fn sanitize_detection_sources(
    env_type: &str,
    detection_files: &[DetectionFileConfig],
) -> Vec<String> {
    let logical_env_type = EnvironmentManager::logical_env_type(env_type);
    let allowed_sources =
        crate::core::project_env_detect::default_detection_sources(&logical_env_type);
    let allowed: HashSet<&str> = allowed_sources.iter().copied().collect();

    let mut enabled = Vec::new();
    for detection_file in detection_files {
        if detection_file.enabled
            && allowed.contains(detection_file.file_name.as_str())
            && !enabled.contains(&detection_file.file_name)
        {
            enabled.push(detection_file.file_name.clone());
        }
    }

    if enabled.is_empty() {
        crate::core::project_env_detect::default_enabled_detection_sources(&logical_env_type)
    } else {
        enabled
    }
}

async fn enabled_detection_sources_for_env_type(
    env_type: &str,
    config: &crate::commands::config::SharedSettings,
) -> Vec<String> {
    let logical_env_type = EnvironmentManager::logical_env_type(env_type);
    let key = format!("env_settings.{}", logical_env_type);
    let s = config.read().await;

    if let Some(value) = s.get_value(&key) {
        if let Ok(settings) = serde_json::from_str::<EnvironmentSettings>(&value) {
            return sanitize_detection_sources(&logical_env_type, &settings.detection_files);
        }
    }

    crate::core::project_env_detect::default_enabled_detection_sources(&logical_env_type)
}

/// Get a cancellation key for an installation
fn get_cancel_key(env_type: &str, version: &str) -> String {
    format!("{}:{}", env_type, version)
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum EnvInstallPhase {
    Resolve,
    SelectArtifact,
    Download,
    Verify,
    Persist,
    Finalize,
}

impl EnvInstallPhase {
    const fn index(self) -> usize {
        match self {
            Self::Resolve => 0,
            Self::SelectArtifact => 1,
            Self::Download => 2,
            Self::Verify => 3,
            Self::Persist => 4,
            Self::Finalize => 5,
        }
    }
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum EnvInstallTerminalState {
    Completed,
    Failed,
    Cancelled,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum EnvInstallFailureClass {
    SelectionError,
    NetworkError,
    IntegrityError,
    CacheError,
    Cancelled,
    Timeout,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EnvInstallArtifact {
    pub id: String,
    pub name: String,
    pub version: String,
    pub provider: String,
}

#[derive(Debug, Default)]
struct InstallLifecycle {
    current_phase: Option<EnvInstallPhase>,
    terminal_emitted: bool,
}

impl InstallLifecycle {
    fn transition(&mut self, next: EnvInstallPhase) -> Result<(), String> {
        if self.terminal_emitted {
            return Err(
                "lifecycle violation: received a non-terminal stage after terminal state"
                    .to_string(),
            );
        }

        match self.current_phase {
            None => {
                if next != EnvInstallPhase::Resolve {
                    return Err(format!(
                        "lifecycle violation: first stage must be `{}` but got `{}`",
                        phase_name(EnvInstallPhase::Resolve),
                        phase_name(next),
                    ));
                }
                self.current_phase = Some(next);
                Ok(())
            }
            Some(current) if current == next => Ok(()),
            Some(current) if next.index() == current.index() + 1 => {
                self.current_phase = Some(next);
                Ok(())
            }
            Some(current) if next.index() < current.index() => Err(format!(
                "lifecycle violation: stage moved backwards from `{}` to `{}`",
                phase_name(current),
                phase_name(next),
            )),
            Some(current) => Err(format!(
                "lifecycle violation: skipped required stage between `{}` and `{}`",
                phase_name(current),
                phase_name(next),
            )),
        }
    }

    fn mark_terminal(&mut self, terminal: EnvInstallTerminalState) -> Result<(), String> {
        if self.terminal_emitted {
            return Err("lifecycle violation: terminal state already emitted".to_string());
        }

        if terminal == EnvInstallTerminalState::Completed
            && self.current_phase != Some(EnvInstallPhase::Finalize)
        {
            return Err(
                "lifecycle violation: `completed` emitted before `finalize` stage".to_string(),
            );
        }

        self.terminal_emitted = true;
        Ok(())
    }
}

const fn phase_name(phase: EnvInstallPhase) -> &'static str {
    match phase {
        EnvInstallPhase::Resolve => "resolve",
        EnvInstallPhase::SelectArtifact => "select-artifact",
        EnvInstallPhase::Download => "download",
        EnvInstallPhase::Verify => "verify",
        EnvInstallPhase::Persist => "persist",
        EnvInstallPhase::Finalize => "finalize",
    }
}

fn legacy_step_from_phase(
    phase: Option<EnvInstallPhase>,
    terminal_state: Option<EnvInstallTerminalState>,
) -> String {
    if let Some(terminal) = terminal_state {
        return match terminal {
            EnvInstallTerminalState::Completed => "done",
            EnvInstallTerminalState::Failed => "error",
            EnvInstallTerminalState::Cancelled => "cancelled",
        }
        .to_string();
    }

    match phase.unwrap_or(EnvInstallPhase::Resolve) {
        EnvInstallPhase::Resolve | EnvInstallPhase::SelectArtifact => "fetching",
        EnvInstallPhase::Download => "downloading",
        EnvInstallPhase::Verify => "extracting",
        EnvInstallPhase::Persist | EnvInstallPhase::Finalize => "configuring",
    }
    .to_string()
}

fn classify_install_failure(error: &str, cancelled: bool) -> EnvInstallFailureClass {
    if cancelled {
        return EnvInstallFailureClass::Cancelled;
    }

    let msg = error.to_ascii_lowercase();
    if msg.contains("cancelled") || msg.contains("canceled") {
        return EnvInstallFailureClass::Cancelled;
    }
    if msg.contains("lifecycle violation") {
        return EnvInstallFailureClass::CacheError;
    }
    if msg.contains("timeout") {
        return EnvInstallFailureClass::Timeout;
    }
    if msg.contains("checksum")
        || msg.contains("hash mismatch")
        || msg.contains("integrity")
        || msg.contains("signature")
    {
        return EnvInstallFailureClass::IntegrityError;
    }
    if msg.contains("cache") || msg.contains("partial") || msg.contains("stale") {
        return EnvInstallFailureClass::CacheError;
    }
    if msg.contains("provider not found")
        || msg.contains("compatible artifact")
        || msg.contains("artifact selection")
        || msg.contains("resolve provider")
    {
        return EnvInstallFailureClass::SelectionError;
    }
    EnvInstallFailureClass::NetworkError
}

fn retry_guidance(
    class: EnvInstallFailureClass,
) -> (Option<bool>, Option<u32>, Option<u32>, Option<u32>) {
    match class {
        EnvInstallFailureClass::NetworkError | EnvInstallFailureClass::Timeout => {
            (Some(true), Some(2), Some(1), Some(3))
        }
        EnvInstallFailureClass::Cancelled => (Some(false), None, None, None),
        EnvInstallFailureClass::SelectionError
        | EnvInstallFailureClass::IntegrityError
        | EnvInstallFailureClass::CacheError => (Some(false), None, Some(1), Some(1)),
    }
}

fn build_lifecycle_failure_progress(
    env_type: &str,
    version: &str,
    phase: Option<EnvInstallPhase>,
    reason: String,
    artifact: Option<EnvInstallArtifact>,
) -> EnvInstallProgress {
    let failure_class = classify_install_failure(&reason, false);
    let (retryable, retry_after_seconds, attempt, max_attempts) = retry_guidance(failure_class);
    build_install_progress(
        env_type,
        version,
        phase,
        Some(EnvInstallTerminalState::Failed),
        Some(failure_class),
        artifact,
        Some(reason.clone()),
        None,
        retryable,
        retry_after_seconds,
        attempt,
        max_attempts,
        0.0,
        None,
        None,
        None,
        Some(reason),
    )
}

fn build_cancelled_progress(
    env_type: &str,
    version: &str,
    phase: Option<EnvInstallPhase>,
    artifact: Option<EnvInstallArtifact>,
) -> EnvInstallProgress {
    let (retryable, retry_after_seconds, attempt, max_attempts) =
        retry_guidance(EnvInstallFailureClass::Cancelled);
    build_install_progress(
        env_type,
        version,
        phase,
        Some(EnvInstallTerminalState::Cancelled),
        Some(EnvInstallFailureClass::Cancelled),
        artifact,
        Some("Installation cancelled by user".to_string()),
        None,
        retryable,
        retry_after_seconds,
        attempt,
        max_attempts,
        0.0,
        None,
        None,
        None,
        Some("Installation cancelled by user".to_string()),
    )
}

/// Progress event payload for environment installation
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EnvInstallProgress {
    pub env_type: String,
    pub version: String,
    pub step: String,
    pub phase: Option<EnvInstallPhase>,
    pub terminal_state: Option<EnvInstallTerminalState>,
    pub failure_class: Option<EnvInstallFailureClass>,
    pub artifact: Option<EnvInstallArtifact>,
    pub stage_message: Option<String>,
    pub selection_rationale: Option<String>,
    pub retryable: Option<bool>,
    pub retry_after_seconds: Option<u32>,
    pub attempt: Option<u32>,
    pub max_attempts: Option<u32>,
    pub progress: f32,
    pub downloaded_size: Option<u64>,
    pub total_size: Option<u64>,
    pub speed: Option<f64>,
    pub error: Option<String>,
}

#[allow(clippy::too_many_arguments)]
fn build_install_progress(
    env_type: &str,
    version: &str,
    phase: Option<EnvInstallPhase>,
    terminal_state: Option<EnvInstallTerminalState>,
    failure_class: Option<EnvInstallFailureClass>,
    artifact: Option<EnvInstallArtifact>,
    stage_message: Option<String>,
    selection_rationale: Option<String>,
    retryable: Option<bool>,
    retry_after_seconds: Option<u32>,
    attempt: Option<u32>,
    max_attempts: Option<u32>,
    progress: f32,
    downloaded_size: Option<u64>,
    total_size: Option<u64>,
    speed: Option<f64>,
    error: Option<String>,
) -> EnvInstallProgress {
    let clamped_progress = progress.clamp(0.0, 100.0);
    EnvInstallProgress {
        env_type: env_type.to_string(),
        version: version.to_string(),
        step: legacy_step_from_phase(phase, terminal_state),
        phase,
        terminal_state,
        failure_class,
        artifact,
        stage_message,
        selection_rationale,
        retryable,
        retry_after_seconds,
        attempt,
        max_attempts,
        progress: clamped_progress,
        downloaded_size,
        total_size,
        speed,
        error,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn lifecycle_enforces_canonical_order_and_single_terminal() {
        let mut lifecycle = InstallLifecycle::default();

        lifecycle.transition(EnvInstallPhase::Resolve).unwrap();
        lifecycle.transition(EnvInstallPhase::SelectArtifact).unwrap();
        lifecycle.transition(EnvInstallPhase::Download).unwrap();
        lifecycle.transition(EnvInstallPhase::Verify).unwrap();
        lifecycle.transition(EnvInstallPhase::Persist).unwrap();
        lifecycle.transition(EnvInstallPhase::Finalize).unwrap();
        lifecycle
            .mark_terminal(EnvInstallTerminalState::Completed)
            .unwrap();

        let err = lifecycle
            .mark_terminal(EnvInstallTerminalState::Completed)
            .unwrap_err();
        assert!(err.contains("terminal state already emitted"));
    }

    #[test]
    fn lifecycle_rejects_skipped_stage() {
        let mut lifecycle = InstallLifecycle::default();
        lifecycle.transition(EnvInstallPhase::Resolve).unwrap();

        let err = lifecycle
            .transition(EnvInstallPhase::Download)
            .unwrap_err();
        assert!(err.contains("skipped required stage"));
    }

    #[test]
    fn lifecycle_rejects_non_terminal_after_terminal() {
        let mut lifecycle = InstallLifecycle::default();
        lifecycle.transition(EnvInstallPhase::Resolve).unwrap();
        lifecycle.transition(EnvInstallPhase::SelectArtifact).unwrap();
        lifecycle.transition(EnvInstallPhase::Download).unwrap();
        lifecycle.transition(EnvInstallPhase::Verify).unwrap();
        lifecycle.transition(EnvInstallPhase::Persist).unwrap();
        lifecycle.transition(EnvInstallPhase::Finalize).unwrap();
        lifecycle
            .mark_terminal(EnvInstallTerminalState::Completed)
            .unwrap();

        let err = lifecycle
            .transition(EnvInstallPhase::Finalize)
            .unwrap_err();
        assert!(err.contains("after terminal state"));
    }

    #[test]
    fn completed_requires_finalize_phase() {
        let mut lifecycle = InstallLifecycle::default();
        lifecycle.transition(EnvInstallPhase::Resolve).unwrap();

        let err = lifecycle
            .mark_terminal(EnvInstallTerminalState::Completed)
            .unwrap_err();
        assert!(err.contains("completed"));
    }

    #[test]
    fn cancelled_payload_uses_terminal_cancelled_state() {
        let payload = build_cancelled_progress(
            "node",
            "20.0.0",
            Some(EnvInstallPhase::Download),
            Some(EnvInstallArtifact {
                id: "provider:node@20.0.0".to_string(),
                name: "node".to_string(),
                version: "20.0.0".to_string(),
                provider: "provider".to_string(),
            }),
        );

        assert_eq!(payload.step, "cancelled");
        assert_eq!(
            payload.terminal_state,
            Some(EnvInstallTerminalState::Cancelled)
        );
        assert_eq!(
            payload.failure_class,
            Some(EnvInstallFailureClass::Cancelled)
        );
    }
}

#[tauri::command]
pub async fn env_list(
    force: Option<bool>,
    registry: State<'_, SharedRegistry>,
    config: State<'_, crate::commands::config::SharedSettings>,
) -> Result<Vec<EnvironmentInfo>, String> {
    let cache_key = "env:list";

    if !force.unwrap_or(false) {
        if let Ok(mut cache) = open_env_metadata_cache(config.inner(), ENV_LIST_CACHE_TTL).await {
            if let Ok(Some(cached)) = cache.get::<Vec<EnvironmentInfo>>(cache_key).await {
                if !cached.is_stale {
                    return Ok(cached.data);
                }
            }
        }
    }

    let manager = EnvironmentManager::new(registry.inner().clone());
    let max_concurrency = config.read().await.startup.max_concurrent_scans;
    let result = manager
        .list_environments_with_concurrency(max_concurrency)
        .await
        .map_err(|e| e.to_string())?;

    if let Ok(mut cache) = open_env_metadata_cache(config.inner(), ENV_LIST_CACHE_TTL).await {
        let _ = cache
            .set_with_ttl(cache_key, &result, ENV_LIST_CACHE_TTL)
            .await;
    }

    Ok(result)
}

#[tauri::command]
pub async fn env_get(
    env_type: String,
    registry: State<'_, SharedRegistry>,
) -> Result<EnvironmentInfo, String> {
    let manager = EnvironmentManager::new(registry.inner().clone());
    manager
        .get_environment(&env_type)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn env_install(
    env_type: String,
    version: String,
    provider_id: Option<String>,
    registry: State<'_, SharedRegistry>,
    tokens: State<'_, CancellationTokens>,
    config: State<'_, crate::commands::config::SharedSettings>,
    app: AppHandle,
) -> Result<(), String> {
    let manager = EnvironmentManager::new(registry.inner().clone());
    let mut lifecycle = InstallLifecycle::default();

    // Create a cancellation token for this installation
    let cancel_key = get_cancel_key(&env_type, &version);
    let cancel_token = Arc::new(std::sync::atomic::AtomicBool::new(false));
    {
        let mut tokens_guard = tokens.write().await;
        tokens_guard.insert(cancel_key.clone(), cancel_token.clone());
    }

    if let Err(reason) = lifecycle.transition(EnvInstallPhase::Resolve) {
        let current_phase = lifecycle.current_phase;
        let _ = lifecycle.mark_terminal(EnvInstallTerminalState::Failed);
        let _ = app.emit(
            "env-install-progress",
            build_lifecycle_failure_progress(&env_type, &version, current_phase, reason.clone(), None),
        );
        let mut tokens_guard = tokens.write().await;
        tokens_guard.remove(&cancel_key);
        return Err(reason);
    }

    let _ = app.emit(
        "env-install-progress",
        build_install_progress(
            &env_type,
            &version,
            Some(EnvInstallPhase::Resolve),
            None,
            None,
            None,
            Some("Resolving provider and install plan".to_string()),
            None,
            None,
            None,
            None,
            None,
            2.0,
            None,
            None,
            None,
            None,
        ),
    );

    // Resolve provider and install with progress
    let (logical_env_type, provider_key, provider) = match manager
        .resolve_provider(&env_type, provider_id.as_deref(), Some(&version))
        .await
    {
        Ok(value) => value,
        Err(err) => {
            let error_message = err.to_string();
            let failure_class = classify_install_failure(&error_message, false);
            let (retryable, retry_after_seconds, attempt, max_attempts) =
                retry_guidance(failure_class);
            let _ = lifecycle.mark_terminal(EnvInstallTerminalState::Failed);
            let _ = app.emit(
                "env-install-progress",
                build_install_progress(
                    &env_type,
                    &version,
                    Some(EnvInstallPhase::Resolve),
                    Some(EnvInstallTerminalState::Failed),
                    Some(failure_class),
                    None,
                    Some("Failed while resolving provider".to_string()),
                    None,
                    retryable,
                    retry_after_seconds,
                    attempt,
                    max_attempts,
                    0.0,
                    None,
                    None,
                    None,
                    Some(error_message.clone()),
                ),
            );

            let mut tokens_guard = tokens.write().await;
            tokens_guard.remove(&cancel_key);
            return Err(error_message);
        }
    };

    let artifact = EnvInstallArtifact {
        id: format!("{}:{}@{}", provider_key, logical_env_type, version),
        name: logical_env_type.clone(),
        version: version.clone(),
        provider: provider_key.clone(),
    };

    if let Err(reason) = lifecycle.transition(EnvInstallPhase::SelectArtifact) {
        let current_phase = lifecycle.current_phase;
        let _ = lifecycle.mark_terminal(EnvInstallTerminalState::Failed);
        let _ = app.emit(
            "env-install-progress",
            build_lifecycle_failure_progress(
                &env_type,
                &version,
                current_phase,
                reason.clone(),
                Some(artifact.clone()),
            ),
        );
        let mut tokens_guard = tokens.write().await;
        tokens_guard.remove(&cancel_key);
        return Err(reason);
    }

    let selection_rationale = Some(format!(
        "Selected provider `{}` for `{}` on `{:?}` via priority-ordered candidates",
        provider_key,
        logical_env_type,
        crate::platform::env::current_platform(),
    ));
    let _ = app.emit(
        "env-install-progress",
        build_install_progress(
            &env_type,
            &version,
            Some(EnvInstallPhase::SelectArtifact),
            None,
            None,
            Some(artifact.clone()),
            Some("Deterministically selecting installation artifact".to_string()),
            selection_rationale,
            None,
            None,
            None,
            None,
            8.0,
            None,
            None,
            None,
            None,
        ),
    );

    // Create a progress channel
    let (tx, mut rx): (ProgressSender, mpsc::Receiver<InstallProgressEvent>) = mpsc::channel(32);

    if let Err(reason) = lifecycle.transition(EnvInstallPhase::Download) {
        let current_phase = lifecycle.current_phase;
        let _ = lifecycle.mark_terminal(EnvInstallTerminalState::Failed);
        let _ = app.emit(
            "env-install-progress",
            build_lifecycle_failure_progress(
                &env_type,
                &version,
                current_phase,
                reason.clone(),
                Some(artifact.clone()),
            ),
        );
        let mut tokens_guard = tokens.write().await;
        tokens_guard.remove(&cancel_key);
        return Err(reason);
    }

    let _ = app.emit(
        "env-install-progress",
        build_install_progress(
            &env_type,
            &version,
            Some(EnvInstallPhase::Download),
            None,
            None,
            Some(artifact.clone()),
            Some("Starting transfer".to_string()),
            None,
            None,
            None,
            None,
            None,
            10.0,
            None,
            None,
            None,
            None,
        ),
    );

    // Clone values for the progress forwarding task
    let env_type_clone = env_type.clone();
    let version_clone = version.clone();
    let app_clone = app.clone();
    let cancel_token_clone = cancel_token.clone();
    let artifact_clone = artifact.clone();

    // Spawn a task to forward progress events to the frontend
    let progress_task = tokio::spawn(async move {
        while let Some(event) = rx.recv().await {
            // Check cancellation before forwarding progress
            if cancel_token_clone.load(std::sync::atomic::Ordering::SeqCst) {
                break;
            }

            if matches!(event.stage, InstallStage::Done | InstallStage::Failed) {
                continue;
            }

            let progress = if event.progress_percent.is_finite() {
                event.progress_percent.clamp(0.0, 85.0).max(10.0)
            } else {
                10.0
            };

            let stage_message = if event.message.trim().is_empty() {
                Some(format!("Provider stage: {:?}", event.stage))
            } else {
                Some(event.message.clone())
            };

            let _ = app_clone.emit(
                "env-install-progress",
                build_install_progress(
                    &env_type_clone,
                    &version_clone,
                    Some(EnvInstallPhase::Download),
                    None,
                    None,
                    Some(artifact_clone.clone()),
                    stage_message,
                    None,
                    None,
                    None,
                    None,
                    None,
                    progress,
                    if event.downloaded_bytes > 0 {
                        Some(event.downloaded_bytes)
                    } else {
                        None
                    },
                    event.total_bytes,
                    if event.speed_bps > 0.0 {
                        Some(event.speed_bps)
                    } else {
                        None
                    },
                    None,
                ),
            );
        }
    });

    // Create the install request
    let request = InstallRequest {
        name: logical_env_type,
        version: Some(version.clone()),
        global: true,
        force: false,
    };

    // Check cancellation before starting install
    if cancel_token.load(std::sync::atomic::Ordering::SeqCst) {
        if let Err(reason) = lifecycle.mark_terminal(EnvInstallTerminalState::Cancelled) {
            let current_phase = lifecycle.current_phase;
            let _ = app.emit(
                "env-install-progress",
                build_lifecycle_failure_progress(
                    &env_type,
                    &version,
                    current_phase,
                    reason.clone(),
                    Some(artifact.clone()),
                ),
            );
            let mut tokens_guard = tokens.write().await;
            tokens_guard.remove(&cancel_key);
            return Err(reason);
        }

        let _ = app.emit(
            "env-install-progress",
            build_cancelled_progress(
                &env_type,
                &version,
                lifecycle.current_phase.or(Some(EnvInstallPhase::Download)),
                Some(artifact.clone()),
            ),
        );

        // Cleanup cancellation token
        let mut tokens_guard = tokens.write().await;
        tokens_guard.remove(&cancel_key);
        return Err("Installation cancelled by user".to_string());
    }

    // Perform installation with progress reporting
    let result = provider.install_with_progress(request, Some(tx)).await;

    // Wait for progress task to complete
    let _ = progress_task.await;

    // Cleanup cancellation token
    {
        let mut tokens_guard = tokens.write().await;
        tokens_guard.remove(&cancel_key);
    }

    // Check if cancelled during installation
    if cancel_token.load(std::sync::atomic::Ordering::SeqCst) {
        if let Err(reason) = lifecycle.mark_terminal(EnvInstallTerminalState::Cancelled) {
            let current_phase = lifecycle.current_phase;
            let _ = app.emit(
                "env-install-progress",
                build_lifecycle_failure_progress(
                    &env_type,
                    &version,
                    current_phase,
                    reason.clone(),
                    Some(artifact.clone()),
                ),
            );
            return Err(reason);
        }

        let _ = app.emit(
            "env-install-progress",
            build_cancelled_progress(
                &env_type,
                &version,
                lifecycle.current_phase.or(Some(EnvInstallPhase::Download)),
                Some(artifact.clone()),
            ),
        );
        return Err("Installation cancelled by user".to_string());
    }

    // Handle result
    match result {
        Ok(_receipt) => {
            for (phase, progress, stage_message) in [
                (
                    EnvInstallPhase::Verify,
                    90.0,
                    "Verifying artifact integrity".to_string(),
                ),
                (
                    EnvInstallPhase::Persist,
                    96.0,
                    "Persisting verified artifact metadata".to_string(),
                ),
                (
                    EnvInstallPhase::Finalize,
                    99.0,
                    "Finalizing installation state".to_string(),
                ),
            ] {
                if let Err(reason) = lifecycle.transition(phase) {
                    let current_phase = lifecycle.current_phase;
                    let _ = lifecycle.mark_terminal(EnvInstallTerminalState::Failed);
                    let _ = app.emit(
                        "env-install-progress",
                        build_lifecycle_failure_progress(
                            &env_type,
                            &version,
                            current_phase,
                            reason.clone(),
                            Some(artifact.clone()),
                        ),
                    );
                    return Err(reason);
                }

                let _ = app.emit(
                    "env-install-progress",
                    build_install_progress(
                        &env_type,
                        &version,
                        Some(phase),
                        None,
                        None,
                        Some(artifact.clone()),
                        Some(stage_message),
                        None,
                        None,
                        None,
                        None,
                        None,
                        progress,
                        None,
                        None,
                        None,
                        None,
                    ),
                );
            }

            if let Err(reason) = lifecycle.mark_terminal(EnvInstallTerminalState::Completed) {
                let current_phase = lifecycle.current_phase;
                let _ = app.emit(
                    "env-install-progress",
                    build_lifecycle_failure_progress(
                        &env_type,
                        &version,
                        current_phase,
                        reason.clone(),
                        Some(artifact.clone()),
                    ),
                );
                return Err(reason);
            }

            // Invalidate environment caches after successful install
            invalidate_env_caches(config.inner()).await;

            // Emit final success event
            let _ = app.emit(
                "env-install-progress",
                build_install_progress(
                    &env_type,
                    &version,
                    Some(EnvInstallPhase::Finalize),
                    Some(EnvInstallTerminalState::Completed),
                    None,
                    Some(artifact),
                    Some("Installation completed".to_string()),
                    None,
                    None,
                    None,
                    None,
                    None,
                    100.0,
                    None,
                    None,
                    None,
                    None,
                ),
            );
            Ok(())
        }
        Err(e) => {
            let error_message = e.to_string();
            let failure_class = classify_install_failure(
                &error_message,
                cancel_token.load(std::sync::atomic::Ordering::SeqCst),
            );
            let (retryable, retry_after_seconds, attempt, max_attempts) =
                retry_guidance(failure_class);
            if let Err(reason) = lifecycle.mark_terminal(EnvInstallTerminalState::Failed) {
                let current_phase = lifecycle.current_phase;
                let _ = app.emit(
                    "env-install-progress",
                    build_lifecycle_failure_progress(
                        &env_type,
                        &version,
                        current_phase,
                        reason.clone(),
                        Some(artifact.clone()),
                    ),
                );
                return Err(reason);
            }

            // Emit final error event
            let _ = app.emit(
                "env-install-progress",
                build_install_progress(
                    &env_type,
                    &version,
                    lifecycle.current_phase.or(Some(EnvInstallPhase::Download)),
                    Some(EnvInstallTerminalState::Failed),
                    Some(failure_class),
                    Some(artifact),
                    Some("Installation failed".to_string()),
                    None,
                    retryable,
                    retry_after_seconds,
                    attempt,
                    max_attempts,
                    0.0,
                    None,
                    None,
                    None,
                    Some(error_message.clone()),
                ),
            );
            Err(error_message)
        }
    }
}

#[tauri::command]
pub async fn env_uninstall(
    env_type: String,
    version: String,
    provider_id: Option<String>,
    registry: State<'_, SharedRegistry>,
    config: State<'_, crate::commands::config::SharedSettings>,
) -> Result<(), String> {
    let manager = EnvironmentManager::new(registry.inner().clone());
    manager
        .uninstall_version(&env_type, &version, provider_id.as_deref())
        .await
        .map_err(|e| e.to_string())?;

    // Invalidate environment caches after successful uninstall
    invalidate_env_caches(config.inner()).await;

    Ok(())
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EnvVersionMutationResult {
    pub env_type: String,
    pub operation: String,
    pub requested_version: String,
    pub effective_version: Option<String>,
    pub source_type: String,
    pub success: bool,
    pub status: String,
    pub message: Option<String>,
}

fn normalize_version_token(raw: &str) -> String {
    let mut normalized = raw.trim().to_ascii_lowercase();
    if let Some(stripped) = normalized.strip_prefix('v') {
        normalized = stripped.to_string();
    }
    if normalized.starts_with("go") && normalized[2..].chars().next().is_some_and(|c| c.is_ascii_digit())
    {
        normalized = normalized[2..].to_string();
    }
    normalized
}

fn versions_compatible(expected: &str, actual: &str) -> bool {
    let expected = normalize_version_token(expected);
    let actual = normalize_version_token(actual);
    if expected.is_empty() || actual.is_empty() {
        return false;
    }
    expected == actual
        || actual.starts_with(&expected)
        || expected.starts_with(&actual)
}

#[tauri::command]
pub async fn env_use_global(
    env_type: String,
    version: String,
    provider_id: Option<String>,
    registry: State<'_, SharedRegistry>,
    config: State<'_, crate::commands::config::SharedSettings>,
) -> Result<EnvVersionMutationResult, String> {
    let manager = EnvironmentManager::new(registry.inner().clone());
    let logical_env_type = EnvironmentManager::logical_env_type(&env_type);
    let (_logical, _provider_key, provider) = manager
        .resolve_provider(&logical_env_type, provider_id.as_deref(), Some(&version))
        .await
        .map_err(|e| e.to_string())?;
    provider
        .set_global_version(&version)
        .await
        .map_err(|e| e.to_string())?;

    let effective_version = provider
        .get_current_version()
        .await
        .map_err(|e| e.to_string())?;
    let success = effective_version
        .as_deref()
        .map(|effective| versions_compatible(&version, effective))
        .unwrap_or(false);
    let message = if success {
        None
    } else {
        Some(format!(
            "Global version verification failed: expected `{}`, got `{}`",
            version,
            effective_version.as_deref().unwrap_or("none")
        ))
    };

    // Invalidate environment caches after version switch
    invalidate_env_caches(config.inner()).await;

    Ok(EnvVersionMutationResult {
        env_type: logical_env_type,
        operation: "set_global".to_string(),
        requested_version: version,
        effective_version,
        source_type: "global".to_string(),
        success,
        status: if success {
            "verified".to_string()
        } else {
            "verification_failed".to_string()
        },
        message,
    })
}

#[tauri::command]
pub async fn env_use_local(
    env_type: String,
    version: String,
    project_path: String,
    provider_id: Option<String>,
    registry: State<'_, SharedRegistry>,
    config: State<'_, crate::commands::config::SharedSettings>,
) -> Result<EnvVersionMutationResult, String> {
    let manager = EnvironmentManager::new(registry.inner().clone());
    let logical_env_type = EnvironmentManager::logical_env_type(&env_type);
    let (_logical, _provider_key, provider) = manager
        .resolve_provider(&logical_env_type, provider_id.as_deref(), Some(&version))
        .await
        .map_err(|e| e.to_string())?;
    provider
        .set_local_version(std::path::Path::new(&project_path), &version)
        .await
        .map_err(|e| e.to_string())?;

    let sources = enabled_detection_sources_for_env_type(&logical_env_type, config.inner()).await;
    let detected = manager
        .detect_version_with_sources(&logical_env_type, std::path::Path::new(&project_path), &sources)
        .await
        .map_err(|e| e.to_string())?;
    let effective_version = detected.as_ref().map(|d| d.version.clone());
    let source_type = detected
        .as_ref()
        .map(|d| d.source_type.clone())
        .unwrap_or_else(|| "unknown".to_string());
    let success = detected
        .as_ref()
        .map(|d| d.source_type == "local" && versions_compatible(&version, &d.version))
        .unwrap_or(false);
    let message = if success {
        None
    } else {
        Some(format!(
            "Local version verification failed: expected local `{}`, got `{}` ({})",
            version,
            effective_version.as_deref().unwrap_or("none"),
            source_type
        ))
    };

    // Invalidate environment caches after local version switch
    invalidate_env_caches(config.inner()).await;

    Ok(EnvVersionMutationResult {
        env_type: logical_env_type,
        operation: "set_local".to_string(),
        requested_version: version,
        effective_version,
        source_type,
        success,
        status: if success {
            "verified".to_string()
        } else {
            "verification_failed".to_string()
        },
        message,
    })
}

#[tauri::command]
pub async fn env_detect(
    env_type: String,
    start_path: String,
    registry: State<'_, SharedRegistry>,
    config: State<'_, crate::commands::config::SharedSettings>,
) -> Result<Option<DetectedEnvironment>, String> {
    let manager = EnvironmentManager::new(registry.inner().clone());
    let logical_env_type = EnvironmentManager::logical_env_type(&env_type);
    let sources = enabled_detection_sources_for_env_type(&logical_env_type, config.inner()).await;
    manager
        .detect_version_with_sources(
            &logical_env_type,
            std::path::Path::new(&start_path),
            &sources,
        )
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn env_detect_all(
    start_path: String,
    registry: State<'_, SharedRegistry>,
    config: State<'_, crate::commands::config::SharedSettings>,
) -> Result<Vec<DetectedEnvironment>, String> {
    let all_types = crate::provider::SystemEnvironmentType::all();

    // Pre-fetch all per-env-type detection sources (requires config lock)
    let mut source_map: Vec<(String, Vec<String>)> = Vec::with_capacity(all_types.len());
    for env in &all_types {
        let env_type = env.env_type();
        let sources = enabled_detection_sources_for_env_type(env_type, config.inner()).await;
        source_map.push((env_type.to_string(), sources));
    }

    // Run detections in parallel
    let registry_inner = registry.inner().clone();
    let mut futures = Vec::with_capacity(source_map.len());
    for (env_type, sources) in source_map {
        let reg = registry_inner.clone();
        let path = start_path.clone();
        futures.push(async move {
            let manager = EnvironmentManager::new(reg);
            manager
                .detect_version_with_sources(&env_type, std::path::Path::new(&path), &sources)
                .await
        });
    }

    let results = futures::future::join_all(futures).await;
    let detected: Vec<DetectedEnvironment> = results
        .into_iter()
        .filter_map(|r| r.ok().flatten())
        .collect();

    Ok(detected)
}

#[tauri::command]
pub async fn env_available_versions(
    env_type: String,
    provider_id: Option<String>,
    force: Option<bool>,
    registry: State<'_, SharedRegistry>,
    version_cache: State<'_, SharedVersionCache>,
    config: State<'_, crate::commands::config::SharedSettings>,
) -> Result<Vec<crate::provider::VersionInfo>, String> {
    let cache_key = format!("{}:{}", env_type, provider_id.as_deref().unwrap_or(""));
    let metadata_key = format!(
        "env:available:{}:{}",
        env_type,
        provider_id.as_deref().unwrap_or("auto")
    );

    // Layer 1: in-memory VersionCache (fastest, survives within session)
    if !force.unwrap_or(false) {
        if let Some(cached) = version_cache.get(&cache_key).await {
            return Ok(cached);
        }

        // Layer 2: MetadataCache (SQLite, survives across restarts)
        if let Ok(mut md_cache) = open_env_metadata_cache(config.inner(), ENV_PROVIDERS_TTL).await {
            if let Ok(Some(cached)) = md_cache
                .get::<Vec<crate::provider::VersionInfo>>(&metadata_key)
                .await
            {
                if !cached.is_stale {
                    // Warm in-memory cache from disk cache
                    version_cache
                        .set(cache_key.clone(), cached.data.clone())
                        .await;
                    return Ok(cached.data);
                }
            }
        }
    }

    let manager = EnvironmentManager::new(registry.inner().clone());
    let versions = manager
        .get_available_versions(&env_type, provider_id.as_deref())
        .await
        .map_err(|e| e.to_string())?;

    // Write to both cache layers
    version_cache.set(cache_key, versions.clone()).await;
    if let Ok(mut md_cache) = open_env_metadata_cache(config.inner(), ENV_PROVIDERS_TTL).await {
        let _ = md_cache
            .set_with_ttl(&metadata_key, &versions, ENV_PROVIDERS_TTL)
            .await;
    }

    Ok(versions)
}

#[tauri::command]
pub async fn env_list_providers(
    force: Option<bool>,
    registry: State<'_, SharedRegistry>,
    config: State<'_, crate::commands::config::SharedSettings>,
) -> Result<Vec<EnvironmentProviderInfo>, String> {
    let cache_key = "env:providers";

    if !force.unwrap_or(false) {
        if let Ok(mut cache) = open_env_metadata_cache(config.inner(), ENV_PROVIDERS_TTL).await {
            if let Ok(Some(cached)) = cache.get::<Vec<EnvironmentProviderInfo>>(cache_key).await {
                if !cached.is_stale {
                    return Ok(cached.data);
                }
            }
        }
    }

    let registry_guard = registry.inner().read().await;
    let mut providers = Vec::new();

    for provider_id in registry_guard.list_all_environment_providers() {
        if let Some(provider) = registry_guard.get_environment_provider(provider_id) {
            let (env_type, description) = match provider_id {
                "fnm" => (
                    "node",
                    "Fast and simple Node.js version manager, built in Rust",
                ),
                "nvm" => ("node", "Node Version Manager - POSIX-compliant bash script"),
                "volta" => (
                    "node",
                    "Hassle-free JavaScript tool manager with seamless per-project versions",
                ),
                "pyenv" => ("python", "Simple Python version management"),
                "uv" => ("python", "Fast Python version & package manager by Astral"),
                "conda" => (
                    "python",
                    "Conda package, dependency, and environment manager",
                ),
                "rustup" => ("rust", "The Rust toolchain installer"),
                "goenv" => ("go", "Go version management, like pyenv for Go"),
                "rbenv" => ("ruby", "Seamless Ruby version management"),
                "sdkman" => ("java", "SDKMAN! - Software Development Kit Manager for JVM"),
                "sdkman-kotlin" => ("kotlin", "SDKMAN! - Kotlin compiler manager"),
                "sdkman-scala" => ("scala", "SDKMAN! - Scala compiler manager"),
                "sdkman-groovy" => ("groovy", "SDKMAN! - Groovy compiler manager"),
                "sdkman-gradle" => ("gradle", "SDKMAN! - Gradle build tool manager"),
                "sdkman-maven" => ("maven", "SDKMAN! - Maven build tool manager"),
                "adoptium" => (
                    "java",
                    "Adoptium Temurin JDK - Cross-platform Java version manager",
                ),
                "phpbrew" => ("php", "PHPBrew - Brew & manage multiple PHP versions"),
                "dotnet" => ("dotnet", ".NET SDK version management"),
                "deno" => ("deno", "Deno runtime version management"),
                "zig" => ("zig", "Zig version management via ziglang.org downloads"),
                "fvm" => ("dart", "Flutter Version Manager for Dart/Flutter SDK"),
                "mise" => (
                    "polyglot",
                    "Modern polyglot version manager (successor to rtx/asdf)",
                ),
                "asdf" => (
                    "polyglot",
                    "Extendable version manager for multiple runtimes",
                ),
                "nix" => ("polyglot", "Nix package manager with reproducible builds"),
                _ if provider_id.starts_with("system-") => {
                    let env = provider_id.strip_prefix("system-").unwrap_or(provider_id);
                    (
                        env,
                        "System-installed runtime (not managed by a version manager)",
                    )
                }
                _ => (provider_id, provider.display_name()),
            };

            providers.push(EnvironmentProviderInfo {
                id: provider_id.to_string(),
                display_name: provider.display_name().to_string(),
                env_type: env_type.to_string(),
                description: description.to_string(),
            });
        }
    }

    if let Ok(mut cache) = open_env_metadata_cache(config.inner(), ENV_PROVIDERS_TTL).await {
        let _ = cache
            .set_with_ttl(cache_key, &providers, ENV_PROVIDERS_TTL)
            .await;
    }

    Ok(providers)
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct EnvironmentProviderInfo {
    pub id: String,
    pub display_name: String,
    pub env_type: String,
    pub description: String,
}

/// Resolve a version alias (like 'lts', 'latest', 'stable') to an actual version number
#[tauri::command]
pub async fn env_resolve_alias(
    env_type: String,
    alias: String,
    registry: State<'_, SharedRegistry>,
) -> Result<String, String> {
    let manager = EnvironmentManager::new(registry.inner().clone());
    let versions = manager
        .get_available_versions(&env_type, None)
        .await
        .map_err(|e| e.to_string())?;

    let alias_lower = alias.to_lowercase();
    let alias_env_type = match env_type.as_str() {
        "fnm" | "nvm" | "volta" => "node",
        "pyenv" | "uv" | "conda" | "pipx" => "python",
        "goenv" => "go",
        "rustup" => "rust",
        "rbenv" => "ruby",
        "sdkman" => "java",
        "sdkman-kotlin" => "kotlin",
        "sdkman-scala" => "scala",
        "sdkman-groovy" => "groovy",
        "sdkman-gradle" => "gradle",
        "sdkman-maven" => "maven",
        "adoptium" => "java",
        "phpbrew" => "php",
        "dotnet" => "dotnet",
        "deno" => "deno",
        "zig" => "zig",
        _ => env_type.as_str(),
    };

    match alias_lower.as_str() {
        "latest" | "newest" | "current" => versions
            .first()
            .map(|v| v.version.clone())
            .ok_or_else(|| "No versions available".to_string()),
        "lts" => {
            // For Node.js, LTS versions are even major versions
            if alias_env_type == "node" {
                versions
                    .iter()
                    .find(|v| {
                        if let Some(major) = v.version.split('.').next() {
                            if let Ok(num) = major.trim_start_matches('v').parse::<u32>() {
                                return num >= 4 && num % 2 == 0;
                            }
                        }
                        false
                    })
                    .map(|v| v.version.clone())
                    .ok_or_else(|| "No LTS version available".to_string())
            } else {
                // For other languages, return the latest stable version
                versions
                    .iter()
                    .find(|v| !v.deprecated && !v.yanked)
                    .map(|v| v.version.clone())
                    .ok_or_else(|| "No stable version available".to_string())
            }
        }
        "stable" => versions
            .iter()
            .find(|v| !v.deprecated && !v.yanked)
            .map(|v| v.version.clone())
            .ok_or_else(|| "No stable version available".to_string()),
        _ => {
            // Check if it's already a valid version number
            if versions.iter().any(|v| v.version == alias) {
                Ok(alias)
            } else {
                // Try partial matching (e.g., "20" matches "20.10.0")
                versions
                    .iter()
                    .find(|v| v.version.starts_with(&alias))
                    .map(|v| v.version.clone())
                    .ok_or_else(|| format!("Version '{}' not found", alias))
            }
        }
    }
}

/// Environment settings structure for persistence
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct EnvironmentSettings {
    pub env_type: String,
    pub env_variables: Vec<EnvVariableConfig>,
    pub detection_files: Vec<DetectionFileConfig>,
    pub auto_switch: bool,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct EnvVariableConfig {
    pub key: String,
    pub value: String,
    pub enabled: bool,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct DetectionFileConfig {
    pub file_name: String,
    pub enabled: bool,
}

/// Save environment settings (env variables, detection files, auto-switch)
#[tauri::command]
pub async fn env_save_settings(
    settings: EnvironmentSettings,
    config: State<'_, crate::commands::config::SharedSettings>,
) -> Result<(), String> {
    let key = format!("env_settings.{}", settings.env_type);
    let value = serde_json::to_string(&settings).map_err(|e| e.to_string())?;

    let mut s = config.write().await;
    s.set_value(&key, &value).map_err(|e| e.to_string())?;
    s.save().await.map_err(|e| e.to_string())
}

/// Load environment settings for a specific environment type
#[tauri::command]
pub async fn env_load_settings(
    env_type: String,
    config: State<'_, crate::commands::config::SharedSettings>,
) -> Result<Option<EnvironmentSettings>, String> {
    let key = format!("env_settings.{}", env_type);
    let s = config.read().await;

    if let Some(value) = s.get_value(&key) {
        let settings: EnvironmentSettings =
            serde_json::from_str(&value).map_err(|e| e.to_string())?;
        Ok(Some(settings))
    } else {
        Ok(None)
    }
}

/// Cancel an ongoing environment installation
#[tauri::command]
pub async fn env_install_cancel(
    env_type: String,
    version: String,
    tokens: State<'_, CancellationTokens>,
    _app: AppHandle,
) -> Result<bool, String> {
    let key = get_cancel_key(&env_type, &version);
    let tokens_guard = tokens.read().await;

    if let Some(token) = tokens_guard.get(&key) {
        token.store(true, std::sync::atomic::Ordering::SeqCst);

        Ok(true)
    } else {
        Ok(false)
    }
}

/// System-detected environment information
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct SystemEnvironmentInfo {
    pub env_type: String,
    pub version: String,
    pub executable_path: Option<String>,
    pub source: String,
}

/// Detect all system-installed environments (not managed by version managers)
/// This detects environments installed via official installers, package managers, etc.
#[tauri::command]
pub async fn env_detect_system_all(
    force: Option<bool>,
    config: State<'_, crate::commands::config::SharedSettings>,
) -> Result<Vec<SystemEnvironmentInfo>, String> {
    use crate::provider::{SystemEnvironmentProvider, SystemEnvironmentType};

    let cache_key = "env:system_all";

    if !force.unwrap_or(false) {
        if let Ok(mut cache) = open_env_metadata_cache(config.inner(), ENV_SYSTEM_DETECT_TTL).await
        {
            if let Ok(Some(cached)) = cache.get::<Vec<SystemEnvironmentInfo>>(cache_key).await {
                if !cached.is_stale {
                    return Ok(cached.data);
                }
            }
        }
    }

    let mut results = Vec::new();

    for env_type in SystemEnvironmentType::all() {
        let provider = SystemEnvironmentProvider::new(env_type);

        if provider.is_available().await {
            if let Ok(Some(version)) = provider.get_current_version().await {
                let versions = provider.list_installed_versions().await.unwrap_or_default();
                let path = versions
                    .first()
                    .map(|v| v.install_path.to_string_lossy().to_string());

                results.push(SystemEnvironmentInfo {
                    env_type: env_type.env_type().to_string(),
                    version,
                    executable_path: path,
                    source: "system".to_string(),
                });
            }
        }
    }

    if let Ok(mut cache) = open_env_metadata_cache(config.inner(), ENV_SYSTEM_DETECT_TTL).await {
        let _ = cache
            .set_with_ttl(cache_key, &results, ENV_SYSTEM_DETECT_TTL)
            .await;
    }

    Ok(results)
}

/// Detect a specific system-installed environment
#[tauri::command]
pub async fn env_detect_system(
    env_type: String,
    force: Option<bool>,
    config: State<'_, crate::commands::config::SharedSettings>,
) -> Result<Option<SystemEnvironmentInfo>, String> {
    use crate::provider::{SystemEnvironmentProvider, SystemEnvironmentType};

    let system_type = match env_type.as_str() {
        "node" | "nodejs" => Some(SystemEnvironmentType::Node),
        "python" | "python3" => Some(SystemEnvironmentType::Python),
        "go" | "golang" => Some(SystemEnvironmentType::Go),
        "rust" | "rustc" => Some(SystemEnvironmentType::Rust),
        "ruby" => Some(SystemEnvironmentType::Ruby),
        "java" => Some(SystemEnvironmentType::Java),
        "kotlin" | "kotlinc" => Some(SystemEnvironmentType::Kotlin),
        "php" => Some(SystemEnvironmentType::Php),
        "dotnet" | ".net" => Some(SystemEnvironmentType::Dotnet),
        "deno" => Some(SystemEnvironmentType::Deno),
        "bun" => Some(SystemEnvironmentType::Bun),
        "zig" => Some(SystemEnvironmentType::Zig),
        "dart" | "flutter" => Some(SystemEnvironmentType::Dart),
        "lua" => Some(SystemEnvironmentType::Lua),
        "scala" => Some(SystemEnvironmentType::Scala),
        "groovy" => Some(SystemEnvironmentType::Groovy),
        "elixir" => Some(SystemEnvironmentType::Elixir),
        "erlang" | "otp" => Some(SystemEnvironmentType::Erlang),
        "swift" => Some(SystemEnvironmentType::Swift),
        "julia" => Some(SystemEnvironmentType::Julia),
        "perl" => Some(SystemEnvironmentType::Perl),
        "r" | "rlang" => Some(SystemEnvironmentType::R),
        "haskell" | "ghc" => Some(SystemEnvironmentType::Haskell),
        "clojure" | "clj" => Some(SystemEnvironmentType::Clojure),
        "crystal" => Some(SystemEnvironmentType::Crystal),
        "nim" => Some(SystemEnvironmentType::Nim),
        "ocaml" => Some(SystemEnvironmentType::Ocaml),
        "fortran" | "gfortran" => Some(SystemEnvironmentType::Fortran),
        "c" | "gcc" | "cc" => Some(SystemEnvironmentType::C),
        "cpp" | "c++" | "g++" | "clang++" | "clang" => Some(SystemEnvironmentType::Cpp),
        _ => None,
    };

    let Some(system_type) = system_type else {
        return Ok(None);
    };

    let cache_key = format!("env:system:{}", &env_type);

    if !force.unwrap_or(false) {
        if let Ok(mut cache) = open_env_metadata_cache(config.inner(), ENV_SYSTEM_DETECT_TTL).await
        {
            if let Ok(Some(cached)) = cache.get::<Option<SystemEnvironmentInfo>>(&cache_key).await {
                if !cached.is_stale {
                    return Ok(cached.data);
                }
            }
        }
    }

    let provider = SystemEnvironmentProvider::new(system_type);

    let result = if !provider.is_available().await {
        None
    } else if let Ok(Some(version)) = provider.get_current_version().await {
        let versions = provider.list_installed_versions().await.unwrap_or_default();
        let path = versions
            .first()
            .map(|v| v.install_path.to_string_lossy().to_string());

        Some(SystemEnvironmentInfo {
            env_type: system_type.env_type().to_string(),
            version,
            executable_path: path,
            source: "system".to_string(),
        })
    } else {
        None
    };

    if let Ok(mut cache) = open_env_metadata_cache(config.inner(), ENV_SYSTEM_DETECT_TTL).await {
        let _ = cache
            .set_with_ttl(&cache_key, &result, ENV_SYSTEM_DETECT_TTL)
            .await;
    }

    Ok(result)
}

/// Get the environment type mapping from provider ID to logical environment type
#[tauri::command]
pub async fn env_get_type_mapping() -> Result<std::collections::HashMap<String, String>, String> {
    let mut mapping = std::collections::HashMap::new();

    // Version managers to environment types
    mapping.insert("fnm".to_string(), "node".to_string());
    mapping.insert("nvm".to_string(), "node".to_string());
    mapping.insert("volta".to_string(), "node".to_string());
    mapping.insert("pyenv".to_string(), "python".to_string());
    mapping.insert("uv".to_string(), "python".to_string());
    mapping.insert("conda".to_string(), "python".to_string());
    mapping.insert("goenv".to_string(), "go".to_string());
    mapping.insert("rbenv".to_string(), "ruby".to_string());
    mapping.insert("rustup".to_string(), "rust".to_string());
    mapping.insert("sdkman".to_string(), "java".to_string());
    mapping.insert("sdkman-kotlin".to_string(), "kotlin".to_string());
    mapping.insert("sdkman-scala".to_string(), "scala".to_string());
    mapping.insert("phpbrew".to_string(), "php".to_string());
    mapping.insert("dotnet".to_string(), "dotnet".to_string());
    mapping.insert("deno".to_string(), "deno".to_string());
    mapping.insert("mise".to_string(), "polyglot".to_string());
    mapping.insert("asdf".to_string(), "polyglot".to_string());
    mapping.insert("nix".to_string(), "polyglot".to_string());
    mapping.insert("pipx".to_string(), "python".to_string());
    mapping.insert("zig".to_string(), "zig".to_string());
    mapping.insert("fvm".to_string(), "dart".to_string());
    mapping.insert("sdkman-groovy".to_string(), "groovy".to_string());
    mapping.insert("sdkman-gradle".to_string(), "gradle".to_string());
    mapping.insert("sdkman-maven".to_string(), "maven".to_string());
    mapping.insert("adoptium".to_string(), "java".to_string());

    // System providers
    mapping.insert("system-node".to_string(), "node".to_string());
    mapping.insert("system-python".to_string(), "python".to_string());
    mapping.insert("system-go".to_string(), "go".to_string());
    mapping.insert("system-rust".to_string(), "rust".to_string());
    mapping.insert("system-ruby".to_string(), "ruby".to_string());
    mapping.insert("system-java".to_string(), "java".to_string());
    mapping.insert("system-kotlin".to_string(), "kotlin".to_string());
    mapping.insert("system-php".to_string(), "php".to_string());
    mapping.insert("system-dotnet".to_string(), "dotnet".to_string());
    mapping.insert("system-deno".to_string(), "deno".to_string());
    mapping.insert("system-bun".to_string(), "bun".to_string());
    mapping.insert("system-zig".to_string(), "zig".to_string());
    mapping.insert("system-dart".to_string(), "dart".to_string());
    mapping.insert("luarocks".to_string(), "lua".to_string());
    mapping.insert("system-lua".to_string(), "lua".to_string());
    mapping.insert("system-scala".to_string(), "scala".to_string());
    mapping.insert("system-groovy".to_string(), "groovy".to_string());
    mapping.insert("system-elixir".to_string(), "elixir".to_string());
    mapping.insert("system-erlang".to_string(), "erlang".to_string());
    mapping.insert("system-swift".to_string(), "swift".to_string());
    mapping.insert("system-julia".to_string(), "julia".to_string());
    mapping.insert("system-perl".to_string(), "perl".to_string());
    mapping.insert("system-r".to_string(), "r".to_string());
    mapping.insert("system-haskell".to_string(), "haskell".to_string());
    mapping.insert("system-clojure".to_string(), "clojure".to_string());
    mapping.insert("system-crystal".to_string(), "crystal".to_string());
    mapping.insert("system-nim".to_string(), "nim".to_string());
    mapping.insert("system-ocaml".to_string(), "ocaml".to_string());
    mapping.insert("system-fortran".to_string(), "fortran".to_string());

    // C/C++ tool providers
    mapping.insert("msvc".to_string(), "cpp".to_string());
    mapping.insert("msys2".to_string(), "cpp".to_string());
    mapping.insert("vcpkg".to_string(), "cpp".to_string());
    mapping.insert("conan".to_string(), "cpp".to_string());
    mapping.insert("xmake".to_string(), "cpp".to_string());
    mapping.insert("system-c".to_string(), "c".to_string());
    mapping.insert("system-cpp".to_string(), "cpp".to_string());

    Ok(mapping)
}

/// Verify that a specific version was installed successfully
#[tauri::command]
pub async fn env_verify_install(
    env_type: String,
    version: String,
    provider_id: Option<String>,
    registry: State<'_, SharedRegistry>,
) -> Result<EnvVerifyResult, String> {
    let manager = EnvironmentManager::new(registry.inner().clone());
    let (_logical_env_type, _provider_key, provider) = manager
        .resolve_provider(&env_type, provider_id.as_deref(), Some(&version))
        .await
        .map_err(|e| e.to_string())?;

    // Check if the version appears in installed versions
    let installed = provider.list_installed_versions().await.unwrap_or_default();
    let found = installed
        .iter()
        .any(|v| v.version == version || v.version.contains(&version));

    // Check if the provider is still available (sanity check)
    let provider_available = provider.is_available().await;

    // Get the current version to verify switching worked
    let current = provider.get_current_version().await.ok().flatten();

    Ok(EnvVerifyResult {
        installed: found,
        provider_available,
        current_version: current,
        requested_version: version,
    })
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EnvVerifyResult {
    pub installed: bool,
    pub provider_available: bool,
    pub current_version: Option<String>,
    pub requested_version: String,
}

/// Get installed versions for a specific environment provider
#[tauri::command]
pub async fn env_installed_versions(
    env_type: String,
    provider_id: Option<String>,
    force: Option<bool>,
    registry: State<'_, SharedRegistry>,
    config: State<'_, crate::commands::config::SharedSettings>,
) -> Result<Vec<crate::provider::InstalledVersion>, String> {
    let cache_key = format!(
        "env:versions:{}:{}",
        &env_type,
        provider_id.as_deref().unwrap_or("auto")
    );

    if !force.unwrap_or(false) {
        if let Ok(mut cache) = open_env_metadata_cache(config.inner(), ENV_INSTALLED_TTL).await {
            if let Ok(Some(cached)) = cache
                .get::<Vec<crate::provider::InstalledVersion>>(&cache_key)
                .await
            {
                if !cached.is_stale {
                    return Ok(cached.data);
                }
            }
        }
    }

    let manager = EnvironmentManager::new(registry.inner().clone());
    let (_logical_env_type, _provider_key, provider) = manager
        .resolve_provider(&env_type, provider_id.as_deref(), None)
        .await
        .map_err(|e| e.to_string())?;

    let versions = provider
        .list_installed_versions()
        .await
        .map_err(|e| e.to_string())?;

    if let Ok(mut cache) = open_env_metadata_cache(config.inner(), ENV_INSTALLED_TTL).await {
        let _ = cache
            .set_with_ttl(&cache_key, &versions, ENV_INSTALLED_TTL)
            .await;
    }

    Ok(versions)
}

/// Get the current active version for a specific environment provider
#[tauri::command]
pub async fn env_current_version(
    env_type: String,
    provider_id: Option<String>,
    registry: State<'_, SharedRegistry>,
) -> Result<Option<String>, String> {
    let manager = EnvironmentManager::new(registry.inner().clone());
    let (_logical_env_type, _provider_key, provider) = manager
        .resolve_provider(&env_type, provider_id.as_deref(), None)
        .await
        .map_err(|e| e.to_string())?;

    provider
        .get_current_version()
        .await
        .map_err(|e| e.to_string())
}

/// Get the default detection file sources for a given environment type.
/// This allows the frontend to query the backend's authoritative list
/// instead of maintaining a duplicate.
#[tauri::command]
pub async fn env_get_detection_sources(env_type: String) -> Result<Vec<String>, String> {
    let logical = EnvironmentManager::logical_env_type(&env_type);
    let sources = crate::core::project_env_detect::default_detection_sources(&logical);
    Ok(sources.iter().map(|s| s.to_string()).collect())
}

/// Get detection sources for all known environment types at once.
#[tauri::command]
pub async fn env_get_all_detection_sources(
) -> Result<std::collections::HashMap<String, Vec<String>>, String> {
    use crate::provider::SystemEnvironmentType;

    let mut result = std::collections::HashMap::new();
    for env in SystemEnvironmentType::all() {
        let env_type = env.env_type();
        let sources = crate::core::project_env_detect::default_detection_sources(env_type);
        result.insert(
            env_type.to_string(),
            sources.iter().map(|s| s.to_string()).collect(),
        );
    }
    Ok(result)
}

// ──────────────────────────────────────────────────────
// EOL (End-of-Life) data commands
// ──────────────────────────────────────────────────────

pub type SharedEolCache = Arc<crate::core::eol::EolCache>;

/// Get EOL lifecycle data for all release cycles of an environment type
#[tauri::command]
pub async fn env_get_eol_info(
    env_type: String,
    eol_cache: State<'_, SharedEolCache>,
) -> Result<Vec<crate::core::eol::EolCycleInfo>, String> {
    eol_cache
        .get_eol_data(&env_type)
        .await
        .map_err(|e| e.to_string())
}

/// Get EOL status for a specific version of an environment
#[tauri::command]
pub async fn env_get_version_eol(
    env_type: String,
    version: String,
    eol_cache: State<'_, SharedEolCache>,
) -> Result<Option<crate::core::eol::EolCycleInfo>, String> {
    eol_cache
        .get_version_eol(&env_type, &version)
        .await
        .map_err(|e| e.to_string())
}

// ──────────────────────────────────────────────────────
// Environment version update checking & cleanup
// ──────────────────────────────────────────────────────

/// Check if a newer version is available for a specific environment
#[tauri::command]
pub async fn env_check_updates(
    env_type: String,
    registry: State<'_, SharedRegistry>,
) -> Result<EnvUpdateCheckResult, String> {
    let manager = EnvironmentManager::new(registry.inner().clone());
    manager
        .check_env_updates(&env_type)
        .await
        .map_err(|e| e.to_string())
}

/// Check for updates across all known environment types
#[tauri::command]
pub async fn env_check_updates_all(
    registry: State<'_, SharedRegistry>,
) -> Result<Vec<EnvUpdateCheckResult>, String> {
    let manager = EnvironmentManager::new(registry.inner().clone());
    manager
        .check_all_env_updates()
        .await
        .map_err(|e| e.to_string())
}

/// Batch-remove old versions for an environment
#[tauri::command]
pub async fn env_cleanup_versions(
    env_type: String,
    versions_to_remove: Vec<String>,
    registry: State<'_, SharedRegistry>,
    config: State<'_, crate::commands::config::SharedSettings>,
) -> Result<EnvCleanupResult, String> {
    let manager = EnvironmentManager::new(registry.inner().clone());
    let result = manager
        .cleanup_versions(&env_type, &versions_to_remove)
        .await
        .map_err(|e| e.to_string())?;

    // Invalidate environment caches after version cleanup
    invalidate_env_caches(config.inner()).await;

    Ok(result)
}

/// List global packages installed under a specific environment version
#[tauri::command]
pub async fn env_list_global_packages(
    env_type: String,
    version: String,
    provider_id: Option<String>,
    registry: State<'_, SharedRegistry>,
) -> Result<Vec<GlobalPackageInfo>, String> {
    let manager = EnvironmentManager::new(registry.inner().clone());
    let (_logical, _pid, provider) = manager
        .resolve_provider(&env_type, provider_id.as_deref(), Some(&version))
        .await
        .map_err(|e| e.to_string())?;

    let env_mods = provider
        .get_env_modifications(&version)
        .map_err(|e| e.to_string())?;

    let logical = EnvironmentManager::logical_env_type(&env_type);

    let packages = match logical.as_str() {
        "node" => list_node_global_packages(&env_mods).await,
        "python" => list_python_global_packages(&env_mods).await,
        "rust" => list_rust_global_packages(&env_mods).await,
        "go" => list_go_global_packages(&env_mods).await,
        _ => Ok(vec![]),
    };

    packages.map_err(|e| e.to_string())
}

/// Migrate global packages from one version to another
#[tauri::command]
pub async fn env_migrate_packages(
    env_type: String,
    _from_version: String,
    to_version: String,
    packages: Vec<String>,
    provider_id: Option<String>,
    registry: State<'_, SharedRegistry>,
    config: State<'_, crate::commands::config::SharedSettings>,
    app: AppHandle,
) -> Result<EnvMigrateResult, String> {
    let manager = EnvironmentManager::new(registry.inner().clone());

    // Switch to the target version first
    manager
        .set_global_version(&env_type, &to_version, provider_id.as_deref())
        .await
        .map_err(|e| e.to_string())?;

    let (_logical, _pid, provider) = manager
        .resolve_provider(&env_type, provider_id.as_deref(), Some(&to_version))
        .await
        .map_err(|e| e.to_string())?;

    let env_mods = provider
        .get_env_modifications(&to_version)
        .map_err(|e| e.to_string())?;

    let logical = EnvironmentManager::logical_env_type(&env_type);

    let mut migrated = Vec::new();
    let mut failed = Vec::new();
    let mut skipped = Vec::new();

    let total = packages.len();
    for (idx, pkg) in packages.iter().enumerate() {
        // Emit progress
        let _ = app.emit(
            "env-migrate-progress",
            serde_json::json!({
                "envType": env_type,
                "current": idx + 1,
                "total": total,
                "package": pkg,
            }),
        );

        let result = match logical.as_str() {
            "node" => install_node_global_package(pkg, &env_mods).await,
            "python" => install_python_global_package(pkg, &env_mods).await,
            "rust" => install_rust_global_package(pkg, &env_mods).await,
            "go" => install_go_global_package(pkg, &env_mods).await,
            _ => {
                skipped.push(pkg.clone());
                continue;
            }
        };

        match result {
            Ok(()) => migrated.push(pkg.clone()),
            Err(e) => failed.push(MigrateFailure {
                name: pkg.clone(),
                error: e.to_string(),
            }),
        }
    }

    // Invalidate environment caches after package migration
    invalidate_env_caches(config.inner()).await;

    Ok(EnvMigrateResult {
        migrated,
        failed,
        skipped,
    })
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GlobalPackageInfo {
    pub name: String,
    pub version: String,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EnvMigrateResult {
    pub migrated: Vec<String>,
    pub failed: Vec<MigrateFailure>,
    pub skipped: Vec<String>,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MigrateFailure {
    pub name: String,
    pub error: String,
}

// ── Helper functions for global package listing & installation ──

fn build_process_opts(
    env_mods: &crate::platform::env::EnvModifications,
    timeout_secs: u64,
) -> crate::platform::process::ProcessOptions {
    let mut opts = crate::platform::process::ProcessOptions {
        timeout: Some(std::time::Duration::from_secs(timeout_secs)),
        ..Default::default()
    };
    for (k, v) in &env_mods.set_variables {
        opts.env.insert(k.clone(), v.clone());
    }
    // Prepend version-specific paths to PATH
    if !env_mods.path_prepend.is_empty() {
        let prepend: Vec<String> = env_mods
            .path_prepend
            .iter()
            .map(|p| p.to_string_lossy().to_string())
            .collect();
        let current_path = std::env::var("PATH").unwrap_or_default();
        let separator = if cfg!(windows) { ";" } else { ":" };
        let new_path = format!("{}{}{}", prepend.join(separator), separator, current_path);
        opts.env.insert("PATH".into(), new_path);
    }
    opts
}

async fn list_node_global_packages(
    env_mods: &crate::platform::env::EnvModifications,
) -> Result<Vec<GlobalPackageInfo>, crate::error::CogniaError> {
    use crate::platform::process;

    let opts = build_process_opts(env_mods, 30);
    let output = process::execute("npm", &["ls", "-g", "--json", "--depth=0"], Some(opts)).await;

    let stdout = match output {
        Ok(o) => o.stdout,
        Err(_) => return Ok(vec![]),
    };

    let mut packages = Vec::new();
    if let Ok(json) = serde_json::from_str::<serde_json::Value>(&stdout) {
        if let Some(deps) = json.get("dependencies").and_then(|d| d.as_object()) {
            for (name, info) in deps {
                if name == "npm" || name == "corepack" {
                    continue;
                }
                let version = info
                    .get("version")
                    .and_then(|v| v.as_str())
                    .unwrap_or("unknown")
                    .to_string();
                packages.push(GlobalPackageInfo {
                    name: name.clone(),
                    version,
                });
            }
        }
    }

    Ok(packages)
}

async fn list_python_global_packages(
    env_mods: &crate::platform::env::EnvModifications,
) -> Result<Vec<GlobalPackageInfo>, crate::error::CogniaError> {
    use crate::platform::process;

    let opts = build_process_opts(env_mods, 30);

    // Try uv first (10-100x faster), fallback to pip
    let stdout = if let Ok(o) = process::execute(
        "uv",
        &["pip", "list", "--format", "json"],
        Some(opts.clone()),
    )
    .await
    {
        if o.success {
            o.stdout
        } else {
            String::new()
        }
    } else {
        String::new()
    };

    let stdout = if stdout.is_empty() {
        match process::execute("pip", &["list", "--format=json"], Some(opts)).await {
            Ok(o) => o.stdout,
            Err(_) => return Ok(vec![]),
        }
    } else {
        stdout
    };

    let mut packages = Vec::new();
    if let Ok(list) = serde_json::from_str::<Vec<serde_json::Value>>(&stdout) {
        for item in list {
            let name = item
                .get("name")
                .and_then(|n| n.as_str())
                .unwrap_or("")
                .to_string();
            let version = item
                .get("version")
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .to_string();
            if ["pip", "setuptools", "wheel", "pkg_resources"].contains(&name.as_str()) {
                continue;
            }
            if !name.is_empty() {
                packages.push(GlobalPackageInfo { name, version });
            }
        }
    }

    Ok(packages)
}

async fn install_node_global_package(
    name: &str,
    env_mods: &crate::platform::env::EnvModifications,
) -> Result<(), crate::error::CogniaError> {
    use crate::platform::process;

    let opts = build_process_opts(env_mods, 120);
    match process::execute("npm", &["install", "-g", name], Some(opts)).await {
        Ok(o) if o.success => Ok(()),
        Ok(o) => Err(crate::error::CogniaError::Provider(format!(
            "npm install -g {} failed: {}",
            name, o.stderr
        ))),
        Err(e) => Err(crate::error::CogniaError::Provider(format!(
            "Failed to install {}: {}",
            name, e
        ))),
    }
}

async fn install_python_global_package(
    name: &str,
    env_mods: &crate::platform::env::EnvModifications,
) -> Result<(), crate::error::CogniaError> {
    use crate::platform::process;

    let opts = build_process_opts(env_mods, 120);

    // Try uv first (faster), fallback to pip
    if let Ok(o) = process::execute("uv", &["pip", "install", name], Some(opts.clone())).await {
        if o.success {
            return Ok(());
        }
    }

    match process::execute("pip", &["install", name], Some(opts)).await {
        Ok(o) if o.success => Ok(()),
        Ok(o) => Err(crate::error::CogniaError::Provider(format!(
            "pip install {} failed: {}",
            name, o.stderr
        ))),
        Err(e) => Err(crate::error::CogniaError::Provider(format!(
            "Failed to install {}: {}",
            name, e
        ))),
    }
}

async fn list_rust_global_packages(
    env_mods: &crate::platform::env::EnvModifications,
) -> Result<Vec<GlobalPackageInfo>, crate::error::CogniaError> {
    use crate::platform::process;
    use crate::provider::cargo::parse_installed_list_output;

    let opts = build_process_opts(env_mods, 30);
    let output = process::execute("cargo", &["install", "--list"], Some(opts)).await;

    let stdout = match output {
        Ok(o) => o.stdout,
        Err(_) => return Ok(vec![]),
    };

    // Reuse the cargo provider's parsing logic
    let packages = parse_installed_list_output(&stdout)
        .into_iter()
        .map(|(name, version)| GlobalPackageInfo { name, version })
        .collect();

    Ok(packages)
}

async fn install_rust_global_package(
    name: &str,
    env_mods: &crate::platform::env::EnvModifications,
) -> Result<(), crate::error::CogniaError> {
    use crate::platform::process;

    let opts = build_process_opts(env_mods, 300);
    match process::execute("cargo", &["install", name], Some(opts)).await {
        Ok(o) if o.success => Ok(()),
        Ok(o) => Err(crate::error::CogniaError::Provider(format!(
            "cargo install {} failed: {}",
            name, o.stderr
        ))),
        Err(e) => Err(crate::error::CogniaError::Provider(format!(
            "Failed to install {}: {}",
            name, e
        ))),
    }
}

async fn list_go_global_packages(
    env_mods: &crate::platform::env::EnvModifications,
) -> Result<Vec<GlobalPackageInfo>, crate::error::CogniaError> {
    // List binaries in GOBIN or GOPATH/bin
    let bin_dir = env_mods
        .set_variables
        .get("GOBIN")
        .map(std::path::PathBuf::from)
        .or_else(|| {
            env_mods
                .set_variables
                .get("GOPATH")
                .map(|s| std::path::PathBuf::from(s).join("bin"))
        })
        .or_else(|| {
            std::env::var("GOBIN")
                .ok()
                .map(std::path::PathBuf::from)
                .or_else(|| {
                    std::env::var("GOPATH")
                        .ok()
                        .map(|p| std::path::PathBuf::from(p).join("bin"))
                })
                .or_else(|| {
                    std::env::var("HOME")
                        .or_else(|_| std::env::var("USERPROFILE"))
                        .ok()
                        .map(|h| std::path::PathBuf::from(h).join("go").join("bin"))
                })
        });

    let bin_dir = match bin_dir {
        Some(dir) if dir.exists() => dir,
        _ => return Ok(vec![]),
    };

    let mut packages = Vec::new();
    if let Ok(entries) = std::fs::read_dir(&bin_dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_file() {
                if let Some(name) = path.file_name().and_then(|n| n.to_str()) {
                    #[cfg(windows)]
                    if !name.ends_with(".exe") {
                        continue;
                    }

                    let display_name = name.strip_suffix(".exe").unwrap_or(name);

                    // Go binaries don't embed version metadata,
                    // so we report "installed" as the version
                    packages.push(GlobalPackageInfo {
                        name: display_name.to_string(),
                        version: "installed".to_string(),
                    });
                }
            }
        }
    }

    Ok(packages)
}

async fn install_go_global_package(
    name: &str,
    env_mods: &crate::platform::env::EnvModifications,
) -> Result<(), crate::error::CogniaError> {
    use crate::platform::process;

    let opts = build_process_opts(env_mods, 120);
    let pkg = if name.contains('@') {
        name.to_string()
    } else {
        format!("{}@latest", name)
    };
    match process::execute("go", &["install", &pkg], Some(opts)).await {
        Ok(o) if o.success => Ok(()),
        Ok(o) => Err(crate::error::CogniaError::Provider(format!(
            "go install {} failed: {}",
            name, o.stderr
        ))),
        Err(e) => Err(crate::error::CogniaError::Provider(format!(
            "Failed to install {}: {}",
            name, e
        ))),
    }
}

// ──────────────────────────────────────────────────────
// Rustup-specific commands: components, targets, show
// ──────────────────────────────────────────────────────

/// List components for a Rust toolchain
#[tauri::command]
pub async fn rustup_list_components(
    toolchain: Option<String>,
    registry: State<'_, SharedRegistry>,
) -> Result<Vec<crate::provider::rustup::RustComponent>, String> {
    let registry_guard = registry.read().await;
    let provider = registry_guard
        .get_environment_provider("rustup")
        .ok_or("Rustup provider not found")?;

    // Downcast to RustupProvider to access component methods
    let rustup = provider
        .as_any()
        .downcast_ref::<crate::provider::rustup::RustupProvider>()
        .ok_or("Failed to get RustupProvider")?;

    rustup
        .list_components(toolchain.as_deref())
        .await
        .map_err(|e| e.to_string())
}

/// Add a component to a Rust toolchain
#[tauri::command]
pub async fn rustup_add_component(
    component: String,
    toolchain: Option<String>,
    registry: State<'_, SharedRegistry>,
) -> Result<(), String> {
    let registry_guard = registry.read().await;
    let provider = registry_guard
        .get_environment_provider("rustup")
        .ok_or("Rustup provider not found")?;

    let rustup = provider
        .as_any()
        .downcast_ref::<crate::provider::rustup::RustupProvider>()
        .ok_or("Failed to get RustupProvider")?;

    rustup
        .add_component(&component, toolchain.as_deref())
        .await
        .map_err(|e| e.to_string())
}

/// Remove a component from a Rust toolchain
#[tauri::command]
pub async fn rustup_remove_component(
    component: String,
    toolchain: Option<String>,
    registry: State<'_, SharedRegistry>,
) -> Result<(), String> {
    let registry_guard = registry.read().await;
    let provider = registry_guard
        .get_environment_provider("rustup")
        .ok_or("Rustup provider not found")?;

    let rustup = provider
        .as_any()
        .downcast_ref::<crate::provider::rustup::RustupProvider>()
        .ok_or("Failed to get RustupProvider")?;

    rustup
        .remove_component(&component, toolchain.as_deref())
        .await
        .map_err(|e| e.to_string())
}

/// List targets for a Rust toolchain
#[tauri::command]
pub async fn rustup_list_targets(
    toolchain: Option<String>,
    registry: State<'_, SharedRegistry>,
) -> Result<Vec<crate::provider::rustup::RustTarget>, String> {
    let registry_guard = registry.read().await;
    let provider = registry_guard
        .get_environment_provider("rustup")
        .ok_or("Rustup provider not found")?;

    let rustup = provider
        .as_any()
        .downcast_ref::<crate::provider::rustup::RustupProvider>()
        .ok_or("Failed to get RustupProvider")?;

    rustup
        .list_targets(toolchain.as_deref())
        .await
        .map_err(|e| e.to_string())
}

/// Add a cross-compilation target
#[tauri::command]
pub async fn rustup_add_target(
    target: String,
    toolchain: Option<String>,
    registry: State<'_, SharedRegistry>,
) -> Result<(), String> {
    let registry_guard = registry.read().await;
    let provider = registry_guard
        .get_environment_provider("rustup")
        .ok_or("Rustup provider not found")?;

    let rustup = provider
        .as_any()
        .downcast_ref::<crate::provider::rustup::RustupProvider>()
        .ok_or("Failed to get RustupProvider")?;

    rustup
        .add_target(&target, toolchain.as_deref())
        .await
        .map_err(|e| e.to_string())
}

/// Remove a cross-compilation target
#[tauri::command]
pub async fn rustup_remove_target(
    target: String,
    toolchain: Option<String>,
    registry: State<'_, SharedRegistry>,
) -> Result<(), String> {
    let registry_guard = registry.read().await;
    let provider = registry_guard
        .get_environment_provider("rustup")
        .ok_or("Rustup provider not found")?;

    let rustup = provider
        .as_any()
        .downcast_ref::<crate::provider::rustup::RustupProvider>()
        .ok_or("Failed to get RustupProvider")?;

    rustup
        .remove_target(&target, toolchain.as_deref())
        .await
        .map_err(|e| e.to_string())
}

/// Get detailed rustup show info
#[tauri::command]
pub async fn rustup_show(
    registry: State<'_, SharedRegistry>,
) -> Result<crate::provider::rustup::RustupShowInfo, String> {
    let registry_guard = registry.read().await;
    let provider = registry_guard
        .get_environment_provider("rustup")
        .ok_or("Rustup provider not found")?;

    let rustup = provider
        .as_any()
        .downcast_ref::<crate::provider::rustup::RustupProvider>()
        .ok_or("Failed to get RustupProvider")?;

    rustup.show_info().await.map_err(|e| e.to_string())
}

/// Update rustup itself
#[tauri::command]
pub async fn rustup_self_update(registry: State<'_, SharedRegistry>) -> Result<(), String> {
    let registry_guard = registry.read().await;
    let provider = registry_guard
        .get_environment_provider("rustup")
        .ok_or("Rustup provider not found")?;

    let rustup = provider
        .as_any()
        .downcast_ref::<crate::provider::rustup::RustupProvider>()
        .ok_or("Failed to get RustupProvider")?;

    rustup.self_update().await.map_err(|e| e.to_string())
}

/// Update all installed Rust toolchains
#[tauri::command]
pub async fn rustup_update_all(registry: State<'_, SharedRegistry>) -> Result<String, String> {
    let registry_guard = registry.read().await;
    let provider = registry_guard
        .get_environment_provider("rustup")
        .ok_or("Rustup provider not found")?;

    let rustup = provider
        .as_any()
        .downcast_ref::<crate::provider::rustup::RustupProvider>()
        .ok_or("Failed to get RustupProvider")?;

    rustup.update_all().await.map_err(|e| e.to_string())
}

/// Set a directory override for toolchain selection
#[tauri::command]
pub async fn rustup_override_set(
    toolchain: String,
    path: Option<String>,
    registry: State<'_, SharedRegistry>,
) -> Result<(), String> {
    let registry_guard = registry.read().await;
    let provider = registry_guard
        .get_environment_provider("rustup")
        .ok_or("Rustup provider not found")?;

    let rustup = provider
        .as_any()
        .downcast_ref::<crate::provider::rustup::RustupProvider>()
        .ok_or("Failed to get RustupProvider")?;

    let path_buf = path.map(std::path::PathBuf::from);
    rustup
        .override_set(&toolchain, path_buf.as_deref())
        .await
        .map_err(|e| e.to_string())
}

/// Remove a directory override
#[tauri::command]
pub async fn rustup_override_unset(
    path: Option<String>,
    registry: State<'_, SharedRegistry>,
) -> Result<(), String> {
    let registry_guard = registry.read().await;
    let provider = registry_guard
        .get_environment_provider("rustup")
        .ok_or("Rustup provider not found")?;

    let rustup = provider
        .as_any()
        .downcast_ref::<crate::provider::rustup::RustupProvider>()
        .ok_or("Failed to get RustupProvider")?;

    let path_buf = path.map(std::path::PathBuf::from);
    rustup
        .override_unset(path_buf.as_deref())
        .await
        .map_err(|e| e.to_string())
}

/// List all directory overrides
#[tauri::command]
pub async fn rustup_override_list(
    registry: State<'_, SharedRegistry>,
) -> Result<Vec<crate::provider::rustup::RustupOverride>, String> {
    let registry_guard = registry.read().await;
    let provider = registry_guard
        .get_environment_provider("rustup")
        .ok_or("Rustup provider not found")?;

    let rustup = provider
        .as_any()
        .downcast_ref::<crate::provider::rustup::RustupProvider>()
        .ok_or("Failed to get RustupProvider")?;

    rustup.override_list().await.map_err(|e| e.to_string())
}

/// Run a command with a specific toolchain
#[tauri::command]
pub async fn rustup_run(
    toolchain: String,
    command: String,
    args: Option<Vec<String>>,
    registry: State<'_, SharedRegistry>,
) -> Result<String, String> {
    let registry_guard = registry.read().await;
    let provider = registry_guard
        .get_environment_provider("rustup")
        .ok_or("Rustup provider not found")?;

    let rustup = provider
        .as_any()
        .downcast_ref::<crate::provider::rustup::RustupProvider>()
        .ok_or("Failed to get RustupProvider")?;

    let args_ref: Vec<&str> = args
        .as_ref()
        .map(|a| a.iter().map(|s| s.as_str()).collect())
        .unwrap_or_default();

    rustup
        .run_with_toolchain(&toolchain, &command, &args_ref)
        .await
        .map_err(|e| e.to_string())
}

/// Resolve which binary will be run for a given command
#[tauri::command]
pub async fn rustup_which(
    binary: String,
    registry: State<'_, SharedRegistry>,
) -> Result<String, String> {
    let registry_guard = registry.read().await;
    let provider = registry_guard
        .get_environment_provider("rustup")
        .ok_or("Rustup provider not found")?;

    let rustup = provider
        .as_any()
        .downcast_ref::<crate::provider::rustup::RustupProvider>()
        .ok_or("Failed to get RustupProvider")?;

    rustup
        .which_binary(&binary)
        .await
        .map(|p| p.to_string_lossy().to_string())
        .map_err(|e| e.to_string())
}

/// Get the current rustup profile
#[tauri::command]
pub async fn rustup_get_profile(registry: State<'_, SharedRegistry>) -> Result<String, String> {
    let registry_guard = registry.read().await;
    let provider = registry_guard
        .get_environment_provider("rustup")
        .ok_or("Rustup provider not found")?;

    let rustup = provider
        .as_any()
        .downcast_ref::<crate::provider::rustup::RustupProvider>()
        .ok_or("Failed to get RustupProvider")?;

    rustup.get_profile().await.map_err(|e| e.to_string())
}

/// Set the rustup profile (minimal, default, complete)
#[tauri::command]
pub async fn rustup_set_profile(
    profile: String,
    registry: State<'_, SharedRegistry>,
) -> Result<(), String> {
    let registry_guard = registry.read().await;
    let provider = registry_guard
        .get_environment_provider("rustup")
        .ok_or("Rustup provider not found")?;

    let rustup = provider
        .as_any()
        .downcast_ref::<crate::provider::rustup::RustupProvider>()
        .ok_or("Failed to get RustupProvider")?;

    rustup
        .set_profile(&profile)
        .await
        .map_err(|e| e.to_string())
}

// ──────────────────────────────────────────────────────
// Go-specific commands: env info, mod tidy, cache mgmt
// These use direct `go` CLI execution (no provider downcast needed)
// ──────────────────────────────────────────────────────

/// Run a `go` command with optional GOPROXY mirror injection
async fn run_go_command(
    args: &[&str],
    cwd: Option<&str>,
    timeout_secs: u64,
    proxy_url: Option<&str>,
) -> Result<String, String> {
    use crate::platform::process::{self, ProcessOptions};

    let mut opts = ProcessOptions::new().with_timeout(std::time::Duration::from_secs(timeout_secs));

    if let Some(cwd_path) = cwd {
        opts.cwd = Some(cwd_path.to_string());
    }

    // Inject GOPROXY when a mirror is configured in settings
    if let Some(proxy) = proxy_url {
        opts.env
            .insert("GOPROXY".into(), format!("{},direct", proxy));
    }

    let output = process::execute("go", args, Some(opts))
        .await
        .map_err(|e| e.to_string())?;

    if output.success {
        Ok(output.stdout)
    } else {
        Err(output.stderr)
    }
}

/// Get Go environment info via `go env -json`
#[tauri::command]
pub async fn go_env_info() -> Result<crate::provider::goenv::GoEnvInfo, String> {
    let output = run_go_command(&["env", "-json"], None, 10, None).await?;
    let json: serde_json::Value =
        serde_json::from_str(&output).map_err(|e| format!("Failed to parse go env JSON: {}", e))?;

    Ok(crate::provider::goenv::GoEnvInfo {
        goroot: json["GOROOT"].as_str().unwrap_or("").to_string(),
        gopath: json["GOPATH"].as_str().unwrap_or("").to_string(),
        gobin: json["GOBIN"].as_str().unwrap_or("").to_string(),
        goproxy: json["GOPROXY"].as_str().unwrap_or("").to_string(),
        goprivate: json["GOPRIVATE"].as_str().unwrap_or("").to_string(),
        gonosumdb: json["GONOSUMDB"].as_str().unwrap_or("").to_string(),
        gotoolchain: json["GOTOOLCHAIN"].as_str().unwrap_or("").to_string(),
        gomodcache: json["GOMODCACHE"].as_str().unwrap_or("").to_string(),
        goos: json["GOOS"].as_str().unwrap_or("").to_string(),
        goarch: json["GOARCH"].as_str().unwrap_or("").to_string(),
        goversion: json["GOVERSION"].as_str().unwrap_or("").to_string(),
        goflags: json["GOFLAGS"].as_str().unwrap_or("").to_string(),
        cgo_enabled: json["CGO_ENABLED"].as_str().unwrap_or("").to_string(),
    })
}

/// Run `go mod tidy` in a project directory (uses go mirror from settings)
#[tauri::command]
pub async fn go_mod_tidy(
    project_path: String,
    config: State<'_, crate::commands::config::SharedSettings>,
) -> Result<String, String> {
    let go_mirror = config.read().await.get_mirror_url("go");
    run_go_command(
        &["mod", "tidy"],
        Some(&project_path),
        120,
        go_mirror.as_deref(),
    )
    .await
}

/// Run `go mod download` in a project directory (uses go mirror from settings)
#[tauri::command]
pub async fn go_mod_download(
    project_path: String,
    config: State<'_, crate::commands::config::SharedSettings>,
) -> Result<String, String> {
    let go_mirror = config.read().await.get_mirror_url("go");
    run_go_command(
        &["mod", "download"],
        Some(&project_path),
        300,
        go_mirror.as_deref(),
    )
    .await
}

/// Clean Go caches (build, mod, test, or all)
#[tauri::command]
pub async fn go_clean_cache(cache_type: String) -> Result<String, String> {
    let args: Vec<&str> = match cache_type.as_str() {
        "build" => vec!["clean", "-cache"],
        "mod" => vec!["clean", "-modcache"],
        "test" => vec!["clean", "-testcache"],
        "all" => vec!["clean", "-cache", "-modcache", "-testcache"],
        _ => {
            return Err(format!(
                "Unknown cache type: {}. Use 'build', 'mod', 'test', or 'all'",
                cache_type
            ))
        }
    };
    run_go_command(&args, None, 60, None).await?;
    Ok(format!("Successfully cleaned {} cache", cache_type))
}

/// Get Go cache paths and sizes
#[tauri::command]
pub async fn go_cache_info() -> Result<crate::provider::goenv::GoCacheInfo, String> {
    let output = run_go_command(&["env", "GOCACHE", "GOMODCACHE"], None, 10, None).await?;

    let lines: Vec<&str> = output.lines().collect();
    let build_cache_path = lines.first().map(|s| s.trim()).unwrap_or("").to_string();
    let mod_cache_path = lines.get(1).map(|s| s.trim()).unwrap_or("").to_string();

    let build_cache_size = if !build_cache_path.is_empty() {
        crate::provider::goenv::go_dir_size(&build_cache_path)
    } else {
        0
    };
    let mod_cache_size = if !mod_cache_path.is_empty() {
        crate::provider::goenv::go_dir_size(&mod_cache_path)
    } else {
        0
    };

    Ok(crate::provider::goenv::GoCacheInfo {
        build_cache_path,
        build_cache_size,
        build_cache_size_human: crate::provider::goenv::go_format_bytes(build_cache_size),
        mod_cache_path,
        mod_cache_size,
        mod_cache_size_human: crate::provider::goenv::go_format_bytes(mod_cache_size),
    })
}
