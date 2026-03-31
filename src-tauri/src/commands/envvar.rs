use std::collections::{HashMap, HashSet};
use std::path::{Path, PathBuf};

use chrono::Utc;
use serde::{Deserialize, Serialize};
use tauri::State;

use crate::config::Settings;
use crate::core::backup::{BackupDeleteResult, BackupManifest};
use crate::error::CogniaError;
use crate::platform::env::{
    self, EnvFileFormat, EnvVarScope, EnvVarSensitivityReason, EnvVarValueSummary, ShellProfileInfo,
};
use crate::platform::fs;
use crate::SharedSettings;

// ============================================================================
// Types
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PathEntryInfo {
    pub path: String,
    pub exists: bool,
    pub is_directory: bool,
    pub is_duplicate: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EnvVarImportResult {
    pub imported: usize,
    pub skipped: usize,
    pub errors: Vec<String>,
    pub scope: EnvVarScope,
    pub recovery_action: Option<String>,
    pub protection_state: Option<String>,
    pub success: bool,
    pub verified: bool,
    pub status: String,
    pub reason_code: Option<String>,
    pub message: Option<String>,
    pub primary_shell_target: Option<String>,
    pub shell_guidance: Vec<EnvVarShellGuidance>,
    pub snapshot: Option<EnvVarSnapshotInfo>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PersistentEnvVar {
    pub key: String,
    pub value: String,
    pub reg_type: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EnvVarConflict {
    pub key: String,
    pub user_value: String,
    pub system_value: String,
    pub effective_value: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EnvVarOverview {
    pub total_vars: usize,
    pub process_count: usize,
    pub user_count: usize,
    pub system_count: usize,
    pub conflict_count: usize,
    pub path_issue_count: usize,
    pub latest_snapshot_at: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EnvVarImportPreviewItem {
    pub key: String,
    pub value: String,
    pub action: String,
    pub reason: Option<String>,
    pub is_sensitive: bool,
    pub sensitivity_reason: Option<EnvVarSensitivityReason>,
    pub redacted: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EnvVarShellGuidance {
    pub shell: String,
    pub config_path: String,
    pub command: String,
    pub auto_applied: bool,
    pub contains_sensitive_value: bool,
    pub redacted: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EnvVarImportPreview {
    pub scope: EnvVarScope,
    pub fingerprint: String,
    pub additions: usize,
    pub updates: usize,
    pub noops: usize,
    pub invalid: usize,
    pub skipped: usize,
    pub items: Vec<EnvVarImportPreviewItem>,
    pub primary_shell_target: Option<String>,
    pub shell_guidance: Vec<EnvVarShellGuidance>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EnvVarPathRepairPreview {
    pub scope: EnvVarScope,
    pub fingerprint: String,
    pub current_entries: Vec<String>,
    pub repaired_entries: Vec<String>,
    pub duplicate_count: usize,
    pub missing_count: usize,
    pub removed_count: usize,
    pub primary_shell_target: Option<String>,
    pub shell_guidance: Vec<EnvVarShellGuidance>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EnvVarConflictResolutionResult {
    pub key: String,
    pub source_scope: EnvVarScope,
    pub target_scope: EnvVarScope,
    pub applied_value: String,
    pub applied_value_summary: EnvVarValueSummary,
    pub recovery_action: Option<String>,
    pub protection_state: Option<String>,
    pub success: bool,
    pub verified: bool,
    pub status: String,
    pub reason_code: Option<String>,
    pub message: Option<String>,
    pub primary_shell_target: Option<String>,
    pub shell_guidance: Vec<EnvVarShellGuidance>,
    pub snapshot: Option<EnvVarSnapshotInfo>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EnvVarSummary {
    pub key: String,
    pub scope: EnvVarScope,
    pub value: EnvVarValueSummary,
    pub reg_type: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EnvVarRevealResult {
    pub key: String,
    pub scope: EnvVarScope,
    pub value: Option<String>,
    pub is_sensitive: bool,
    pub sensitivity_reason: Option<EnvVarSensitivityReason>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EnvVarShellProfileReadResult {
    pub path: String,
    pub content: String,
    pub redacted_count: usize,
    pub contains_sensitive: bool,
    pub revealed: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EnvVarExportResult {
    pub scope: EnvVarScope,
    pub format: EnvFileFormat,
    pub content: String,
    pub redacted: bool,
    pub sensitive_count: usize,
    pub variable_count: usize,
    pub revealed: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EnvVarActionSupport {
    pub action: String,
    pub scope: Option<EnvVarScope>,
    pub supported: bool,
    pub state: String,
    pub reason_code: String,
    pub reason: String,
    pub next_steps: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EnvVarSupportSnapshot {
    pub state: String,
    pub reason_code: String,
    pub reason: String,
    pub platform: String,
    pub detected_shells: usize,
    pub primary_shell_target: Option<String>,
    pub actions: Vec<EnvVarActionSupport>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EnvVarMutationResult {
    pub operation: String,
    pub key: String,
    pub scope: EnvVarScope,
    pub recovery_action: Option<String>,
    pub protection_state: Option<String>,
    pub success: bool,
    pub verified: bool,
    pub status: String,
    pub reason_code: Option<String>,
    pub message: Option<String>,
    pub effective_value_summary: Option<EnvVarValueSummary>,
    pub primary_shell_target: Option<String>,
    pub shell_guidance: Vec<EnvVarShellGuidance>,
    pub snapshot: Option<EnvVarSnapshotInfo>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EnvVarPathMutationResult {
    pub operation: String,
    pub scope: EnvVarScope,
    pub recovery_action: Option<String>,
    pub protection_state: Option<String>,
    pub success: bool,
    pub verified: bool,
    pub status: String,
    pub reason_code: Option<String>,
    pub message: Option<String>,
    pub removed_count: usize,
    pub path_entries: Vec<PathEntryInfo>,
    pub primary_shell_target: Option<String>,
    pub shell_guidance: Vec<EnvVarShellGuidance>,
    pub snapshot: Option<EnvVarSnapshotInfo>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum EnvVarSnapshotCreationMode {
    Manual,
    Automatic,
}

impl EnvVarSnapshotCreationMode {
    pub fn as_str(&self) -> &'static str {
        match self {
            Self::Manual => "manual",
            Self::Automatic => "automatic",
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EnvVarSnapshotScopePayload {
    pub scope: EnvVarScope,
    pub variables: Vec<PersistentEnvVar>,
    pub path_entries: Vec<String>,
    pub variable_fingerprint: String,
    pub path_fingerprint: String,
    pub restorable: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EnvVarSnapshotPayload {
    pub format_version: u32,
    pub created_at: String,
    pub creation_mode: Option<EnvVarSnapshotCreationMode>,
    pub source_action: Option<String>,
    pub note: Option<String>,
    pub scopes: Vec<EnvVarSnapshotScopePayload>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EnvVarSnapshotInfo {
    pub path: String,
    pub name: String,
    pub created_at: String,
    pub creation_mode: EnvVarSnapshotCreationMode,
    pub source_action: Option<String>,
    pub note: Option<String>,
    pub scopes: Vec<EnvVarScope>,
    pub integrity_state: String,
    pub snapshot: EnvVarSnapshotPayload,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EnvVarBackupProtectionState {
    pub action: String,
    pub scope: EnvVarScope,
    pub state: String,
    pub reason_code: String,
    pub reason: String,
    pub next_steps: Vec<String>,
    pub snapshot: Option<EnvVarSnapshotInfo>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EnvVarSnapshotRestorePreviewSegment {
    pub scope: EnvVarScope,
    pub changed_variables: usize,
    pub added_variables: usize,
    pub removed_variables: usize,
    pub added_path_entries: usize,
    pub removed_path_entries: usize,
    pub skipped: bool,
    pub reason_code: Option<String>,
    pub reason: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EnvVarSnapshotRestorePreview {
    pub created_at: String,
    pub fingerprint: String,
    pub segments: Vec<EnvVarSnapshotRestorePreviewSegment>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EnvVarSnapshotCreateResult {
    pub success: bool,
    pub status: String,
    pub reason_code: Option<String>,
    pub message: Option<String>,
    pub snapshot: Option<EnvVarSnapshotInfo>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EnvVarSnapshotRestoreSkipped {
    pub scope: EnvVarScope,
    pub reason_code: Option<String>,
    pub reason: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EnvVarSnapshotRestoreResult {
    pub success: bool,
    pub verified: bool,
    pub status: String,
    pub reason_code: Option<String>,
    pub message: Option<String>,
    pub restored_scopes: Vec<EnvVarScope>,
    pub skipped: Vec<EnvVarSnapshotRestoreSkipped>,
    pub primary_shell_target: Option<String>,
    pub shell_guidance: Vec<EnvVarShellGuidance>,
}

fn build_action_support(action: &str, scope: Option<EnvVarScope>) -> EnvVarActionSupport {
    let readiness = env::evaluate_envvar_action_readiness(action, scope);
    EnvVarActionSupport {
        action: action.to_string(),
        scope,
        supported: readiness.supported,
        state: readiness.state,
        reason_code: readiness.reason_code,
        reason: readiness.reason,
        next_steps: readiness.next_steps,
    }
}

fn derive_support_snapshot_state(actions: &[EnvVarActionSupport]) -> (String, String, String) {
    if let Some(action) = actions.iter().find(|item| item.state == "blocked") {
        return (
            "degraded".to_string(),
            action.reason_code.clone(),
            action.reason.clone(),
        );
    }
    if let Some(action) = actions.iter().find(|item| item.state == "degraded") {
        return (
            "degraded".to_string(),
            action.reason_code.clone(),
            action.reason.clone(),
        );
    }
    if let Some(action) = actions.iter().find(|item| item.state == "unavailable") {
        return (
            "degraded".to_string(),
            action.reason_code.clone(),
            action.reason.clone(),
        );
    }

    (
        "ready".to_string(),
        "ready".to_string(),
        "Envvar workflows are ready.".to_string(),
    )
}

fn has_manual_followup(scope: EnvVarScope, shell_guidance: &[EnvVarShellGuidance]) -> bool {
    scope == EnvVarScope::User && shell_guidance.iter().any(|entry| !entry.auto_applied)
}

fn mutation_status_from_verification(
    verified: bool,
    scope: EnvVarScope,
    shell_guidance: &[EnvVarShellGuidance],
) -> (bool, bool, String, Option<String>, Option<String>) {
    if !verified {
        return (
            false,
            false,
            "verification_failed".to_string(),
            Some("post_mutation_verification_failed".to_string()),
            Some("The envvar mutation could not be verified from effective state.".to_string()),
        );
    }

    if has_manual_followup(scope, shell_guidance) {
        return (
            true,
            false,
            "manual_followup_required".to_string(),
            Some("shell_sync_required".to_string()),
            Some(
                "The change was persisted, but manual shell follow-up is still required."
                    .to_string(),
            ),
        );
    }

    (true, true, "verified".to_string(), None, None)
}

fn blocked_mutation_result(
    operation: &str,
    key: &str,
    scope: EnvVarScope,
    support: &EnvVarActionSupport,
) -> EnvVarMutationResult {
    EnvVarMutationResult {
        operation: operation.to_string(),
        key: key.to_string(),
        scope,
        recovery_action: Some(operation.to_string()),
        protection_state: Some("blocked".to_string()),
        success: false,
        verified: false,
        status: "blocked".to_string(),
        reason_code: Some(support.reason_code.clone()),
        message: Some(support.reason.clone()),
        effective_value_summary: None,
        primary_shell_target: None,
        shell_guidance: Vec::new(),
        snapshot: None,
    }
}

fn blocked_path_mutation_result(
    operation: &str,
    scope: EnvVarScope,
    support: &EnvVarActionSupport,
) -> EnvVarPathMutationResult {
    EnvVarPathMutationResult {
        operation: operation.to_string(),
        scope,
        recovery_action: Some(operation.to_string()),
        protection_state: Some("blocked".to_string()),
        success: false,
        verified: false,
        status: "blocked".to_string(),
        reason_code: Some(support.reason_code.clone()),
        message: Some(support.reason.clone()),
        removed_count: 0,
        path_entries: Vec::new(),
        primary_shell_target: None,
        shell_guidance: Vec::new(),
        snapshot: None,
    }
}

fn summarize_path_entries(entries: Vec<String>) -> Vec<PathEntryInfo> {
    let mut seen = HashSet::new();
    entries
        .into_iter()
        .map(|path| {
            let key = if cfg!(windows) {
                path.to_lowercase()
            } else {
                path.clone()
            };
            let exists = Path::new(&path).exists();
            let is_directory = Path::new(&path).is_dir();
            PathEntryInfo {
                path,
                exists,
                is_directory,
                is_duplicate: !seen.insert(key),
            }
        })
        .collect()
}

// ============================================================================
// Commands
// ============================================================================

#[tauri::command]
pub fn envvar_get_support_snapshot() -> Result<EnvVarSupportSnapshot, CogniaError> {
    let actions = vec![
        build_action_support("refresh", Some(EnvVarScope::Process)),
        build_action_support("refresh", Some(EnvVarScope::User)),
        build_action_support("refresh", Some(EnvVarScope::System)),
        build_action_support("set", Some(EnvVarScope::Process)),
        build_action_support("set", Some(EnvVarScope::User)),
        build_action_support("set", Some(EnvVarScope::System)),
        build_action_support("persistent_set", Some(EnvVarScope::User)),
        build_action_support("persistent_set", Some(EnvVarScope::System)),
        build_action_support("remove", Some(EnvVarScope::Process)),
        build_action_support("remove", Some(EnvVarScope::User)),
        build_action_support("remove", Some(EnvVarScope::System)),
        build_action_support("persistent_remove", Some(EnvVarScope::User)),
        build_action_support("persistent_remove", Some(EnvVarScope::System)),
        build_action_support("import", Some(EnvVarScope::Process)),
        build_action_support("import", Some(EnvVarScope::User)),
        build_action_support("import", Some(EnvVarScope::System)),
        build_action_support("import_apply", Some(EnvVarScope::User)),
        build_action_support("import_apply", Some(EnvVarScope::System)),
        build_action_support("export", Some(EnvVarScope::Process)),
        build_action_support("export", Some(EnvVarScope::User)),
        build_action_support("export", Some(EnvVarScope::System)),
        build_action_support("path_add", Some(EnvVarScope::Process)),
        build_action_support("path_add", Some(EnvVarScope::User)),
        build_action_support("path_add", Some(EnvVarScope::System)),
        build_action_support("path_remove", Some(EnvVarScope::Process)),
        build_action_support("path_remove", Some(EnvVarScope::User)),
        build_action_support("path_remove", Some(EnvVarScope::System)),
        build_action_support("path_reorder", Some(EnvVarScope::Process)),
        build_action_support("path_reorder", Some(EnvVarScope::User)),
        build_action_support("path_reorder", Some(EnvVarScope::System)),
        build_action_support("path_deduplicate", Some(EnvVarScope::Process)),
        build_action_support("path_deduplicate", Some(EnvVarScope::User)),
        build_action_support("path_deduplicate", Some(EnvVarScope::System)),
        build_action_support("path_repair_apply", Some(EnvVarScope::Process)),
        build_action_support("path_repair_apply", Some(EnvVarScope::User)),
        build_action_support("path_repair_apply", Some(EnvVarScope::System)),
        build_action_support("conflict_resolve", Some(EnvVarScope::User)),
        build_action_support("conflict_resolve", Some(EnvVarScope::System)),
        build_action_support("read_shell_profile", None),
        build_action_support("shell_guidance", None),
    ];
    let (state, reason_code, reason) = derive_support_snapshot_state(&actions);

    Ok(EnvVarSupportSnapshot {
        state,
        reason_code,
        reason,
        platform: env::current_platform().as_str().to_string(),
        detected_shells: env::list_shell_profiles().len(),
        primary_shell_target: primary_shell_target_for_scope(EnvVarScope::User),
        actions,
    })
}

#[tauri::command]
pub fn envvar_list_all() -> Result<HashMap<String, String>, CogniaError> {
    Ok(env::get_all_vars())
}

#[tauri::command]
pub async fn envvar_get_overview(
    settings: State<'_, SharedSettings>,
) -> Result<EnvVarOverview, CogniaError> {
    let process_count = envvar_list_process_summaries()?.len();
    let user_count = envvar_list_persistent_typed_summaries(EnvVarScope::User)
        .await?
        .len();
    let system_count = envvar_list_persistent_typed_summaries(EnvVarScope::System)
        .await?
        .len();
    let conflict_count = envvar_detect_conflicts().await?.len();

    let path_issue_count = envvar_get_path(EnvVarScope::User)
        .await?
        .into_iter()
        .chain(envvar_get_path(EnvVarScope::System).await?.into_iter())
        .filter(|entry| !entry.exists || entry.is_duplicate)
        .count();

    let settings = settings.read().await;
    let latest_snapshot_at = list_envvar_snapshot_bundles(&settings)
        .await?
        .into_iter()
        .map(|snapshot| snapshot.created_at)
        .max();

    Ok(EnvVarOverview {
        total_vars: process_count + user_count + system_count,
        process_count,
        user_count,
        system_count,
        conflict_count,
        path_issue_count,
        latest_snapshot_at,
    })
}

#[tauri::command]
pub fn envvar_list_process_summaries() -> Result<Vec<EnvVarSummary>, CogniaError> {
    let mut items = env::get_all_vars()
        .into_iter()
        .map(|(key, value)| EnvVarSummary {
            value: env::summarize_env_value(&key, &value),
            key,
            scope: EnvVarScope::Process,
            reg_type: None,
        })
        .collect::<Vec<_>>();
    items.sort_by(|a, b| a.key.cmp(&b.key));
    Ok(items)
}

#[tauri::command]
pub fn envvar_get(key: String) -> Result<Option<String>, CogniaError> {
    let key = env::normalize_env_var_key(&key)?;
    Ok(env::get_var(&key))
}

#[tauri::command]
pub async fn envvar_reveal_value(
    key: String,
    scope: EnvVarScope,
) -> Result<EnvVarRevealResult, CogniaError> {
    let key = env::normalize_env_var_key(&key)?;
    let value = env::get_persistent_var(&key, scope).await?;
    let (is_sensitive, sensitivity_reason) = value
        .as_deref()
        .map(|current| {
            let reason = env::classify_env_var_sensitivity(&key, current);
            (reason.is_some(), reason)
        })
        .unwrap_or((false, None));

    Ok(EnvVarRevealResult {
        key,
        scope,
        value,
        is_sensitive,
        sensitivity_reason,
    })
}

#[tauri::command]
pub async fn envvar_set_process(
    key: String,
    value: String,
) -> Result<EnvVarMutationResult, CogniaError> {
    let key = env::normalize_env_var_key(&key)?;
    let support = build_action_support("set", Some(EnvVarScope::Process));
    if !support.supported {
        return Ok(blocked_mutation_result(
            "set",
            &key,
            EnvVarScope::Process,
            &support,
        ));
    }

    env::set_var(&key, &value);
    let (verified, summary) =
        env::verify_envvar_value_state(&key, EnvVarScope::Process, Some(&value)).await?;
    let (success, verified_flag, status, reason_code, message) =
        mutation_status_from_verification(verified, EnvVarScope::Process, &[]);

    Ok(EnvVarMutationResult {
        operation: "set".to_string(),
        key,
        scope: EnvVarScope::Process,
        recovery_action: None,
        protection_state: None,
        success,
        verified: verified_flag,
        status,
        reason_code,
        message,
        effective_value_summary: summary,
        primary_shell_target: None,
        shell_guidance: Vec::new(),
        snapshot: None,
    })
}

#[tauri::command]
pub async fn envvar_remove_process(key: String) -> Result<EnvVarMutationResult, CogniaError> {
    let key = env::normalize_env_var_key(&key)?;
    let support = build_action_support("remove", Some(EnvVarScope::Process));
    if !support.supported {
        return Ok(blocked_mutation_result(
            "remove",
            &key,
            EnvVarScope::Process,
            &support,
        ));
    }

    env::remove_var(&key);
    let (verified, summary) =
        env::verify_envvar_value_state(&key, EnvVarScope::Process, None).await?;
    let (success, verified_flag, status, reason_code, message) =
        mutation_status_from_verification(verified, EnvVarScope::Process, &[]);

    Ok(EnvVarMutationResult {
        operation: "remove".to_string(),
        key,
        scope: EnvVarScope::Process,
        recovery_action: None,
        protection_state: None,
        success,
        verified: verified_flag,
        status,
        reason_code,
        message,
        effective_value_summary: summary,
        primary_shell_target: None,
        shell_guidance: Vec::new(),
        snapshot: None,
    })
}

#[tauri::command]
pub async fn envvar_get_persistent(
    key: String,
    scope: EnvVarScope,
) -> Result<Option<String>, CogniaError> {
    env::get_persistent_var(&key, scope).await
}

#[tauri::command]
pub async fn envvar_set_persistent(
    key: String,
    value: String,
    scope: EnvVarScope,
) -> Result<EnvVarMutationResult, CogniaError> {
    let key = env::normalize_env_var_key(&key)?;
    let support = build_action_support("persistent_set", Some(scope));
    if !support.supported {
        return Ok(blocked_mutation_result("persistent_set", &key, scope, &support));
    }

    env::set_persistent_var(&key, &value, scope).await?;
    let primary_shell_target = primary_shell_target_for_scope(scope);
    let shell_guidance = shell_guidance_for_pairs(
        &[(key.clone(), value.clone())],
        scope,
        auto_applied_shell_for_scope(scope).as_deref(),
        false,
    );
    let (verified, summary) = env::verify_envvar_value_state(&key, scope, Some(&value)).await?;
    let (success, verified_flag, status, reason_code, message) =
        mutation_status_from_verification(verified, scope, &shell_guidance);

    Ok(EnvVarMutationResult {
        operation: "persistent_set".to_string(),
        key,
        scope,
        recovery_action: Some("persistent_set".to_string()),
        protection_state: None,
        success,
        verified: verified_flag,
        status,
        reason_code,
        message,
        effective_value_summary: summary,
        primary_shell_target,
        shell_guidance,
        snapshot: None,
    })
}

#[tauri::command]
pub async fn envvar_remove_persistent(
    key: String,
    scope: EnvVarScope,
) -> Result<EnvVarMutationResult, CogniaError> {
    let key = env::normalize_env_var_key(&key)?;
    let support = build_action_support("persistent_remove", Some(scope));
    if !support.supported {
        return Ok(blocked_mutation_result("persistent_remove", &key, scope, &support));
    }

    env::remove_persistent_var(&key, scope).await?;
    let primary_shell_target = primary_shell_target_for_scope(scope);
    let shell_guidance = Vec::new();
    let (verified, summary) = env::verify_envvar_value_state(&key, scope, None).await?;
    let (success, verified_flag, status, reason_code, message) =
        mutation_status_from_verification(verified, scope, &shell_guidance);

    Ok(EnvVarMutationResult {
        operation: "persistent_remove".to_string(),
        key,
        scope,
        recovery_action: Some("persistent_remove".to_string()),
        protection_state: None,
        success,
        verified: verified_flag,
        status,
        reason_code,
        message,
        effective_value_summary: summary,
        primary_shell_target,
        shell_guidance,
        snapshot: None,
    })
}

#[tauri::command]
pub async fn envvar_get_path(scope: EnvVarScope) -> Result<Vec<PathEntryInfo>, CogniaError> {
    let entries = env::get_persistent_path(scope).await?;
    let mut seen = HashSet::new();
    let result: Vec<PathEntryInfo> = entries
        .into_iter()
        .map(|path_str| {
            let p = Path::new(&path_str);
            let key = if cfg!(windows) {
                path_str.to_lowercase()
            } else {
                path_str.clone()
            };
            let is_duplicate = !seen.insert(key);
            PathEntryInfo {
                exists: p.exists(),
                is_directory: p.is_dir(),
                is_duplicate,
                path: path_str,
            }
        })
        .collect();
    Ok(result)
}

#[tauri::command]
pub async fn envvar_add_path_entry(
    path: String,
    scope: EnvVarScope,
    position: Option<usize>,
) -> Result<EnvVarPathMutationResult, CogniaError> {
    let support = build_action_support("path_add", Some(scope));
    if !support.supported {
        return Ok(blocked_path_mutation_result("path_add", scope, &support));
    }

    let mut entries = env::get_persistent_path(scope).await?;

    // Avoid duplicates
    if entries.iter().any(|e| e == &path) {
        let path_entries = summarize_path_entries(entries.clone());
        return Ok(EnvVarPathMutationResult {
            operation: "path_add".to_string(),
            scope,
            recovery_action: Some("path_add".to_string()),
            protection_state: None,
            success: true,
            verified: true,
            status: "verified".to_string(),
            reason_code: None,
            message: Some("The PATH entry already exists.".to_string()),
            removed_count: 0,
            path_entries,
            primary_shell_target: primary_shell_target_for_scope(scope),
            shell_guidance: shell_guidance_for_path(
                &entries,
                scope,
                auto_applied_shell_for_scope(scope).as_deref(),
                false,
            ),
            snapshot: None,
        });
    }

    match position {
        Some(pos) if pos < entries.len() => entries.insert(pos, path),
        _ => entries.push(path),
    }

    env::set_persistent_path(&entries, scope).await?;
    let shell_guidance = shell_guidance_for_path(
        &entries,
        scope,
        auto_applied_shell_for_scope(scope).as_deref(),
        false,
    );
    let (verified, actual_entries) = env::verify_envvar_path_state(scope, &entries).await?;
    let (success, verified_flag, status, reason_code, message) =
        mutation_status_from_verification(verified, scope, &shell_guidance);

    Ok(EnvVarPathMutationResult {
        operation: "path_add".to_string(),
        scope,
        recovery_action: Some("path_add".to_string()),
        protection_state: None,
        success,
        verified: verified_flag,
        status,
        reason_code,
        message,
        removed_count: 0,
        path_entries: summarize_path_entries(actual_entries),
        primary_shell_target: primary_shell_target_for_scope(scope),
        shell_guidance,
        snapshot: None,
    })
}

#[tauri::command]
pub async fn envvar_remove_path_entry(
    path: String,
    scope: EnvVarScope,
) -> Result<EnvVarPathMutationResult, CogniaError> {
    let support = build_action_support("path_remove", Some(scope));
    if !support.supported {
        return Ok(blocked_path_mutation_result("path_remove", scope, &support));
    }

    let entries: Vec<String> = env::get_persistent_path(scope)
        .await?
        .into_iter()
        .filter(|e| e != &path)
        .collect();
    env::set_persistent_path(&entries, scope).await?;
    let shell_guidance = shell_guidance_for_path(
        &entries,
        scope,
        auto_applied_shell_for_scope(scope).as_deref(),
        false,
    );
    let (verified, actual_entries) = env::verify_envvar_path_state(scope, &entries).await?;
    let (success, verified_flag, status, reason_code, message) =
        mutation_status_from_verification(verified, scope, &shell_guidance);

    Ok(EnvVarPathMutationResult {
        operation: "path_remove".to_string(),
        scope,
        recovery_action: Some("path_remove".to_string()),
        protection_state: None,
        success,
        verified: verified_flag,
        status,
        reason_code,
        message,
        removed_count: 0,
        path_entries: summarize_path_entries(actual_entries),
        primary_shell_target: primary_shell_target_for_scope(scope),
        shell_guidance,
        snapshot: None,
    })
}

#[tauri::command]
pub async fn envvar_reorder_path(
    entries: Vec<String>,
    scope: EnvVarScope,
) -> Result<EnvVarPathMutationResult, CogniaError> {
    let support = build_action_support("path_reorder", Some(scope));
    if !support.supported {
        return Ok(blocked_path_mutation_result(
            "path_reorder",
            scope,
            &support,
        ));
    }

    env::set_persistent_path(&entries, scope).await?;
    let shell_guidance = shell_guidance_for_path(
        &entries,
        scope,
        auto_applied_shell_for_scope(scope).as_deref(),
        false,
    );
    let (verified, actual_entries) = env::verify_envvar_path_state(scope, &entries).await?;
    let (success, verified_flag, status, reason_code, message) =
        mutation_status_from_verification(verified, scope, &shell_guidance);

    Ok(EnvVarPathMutationResult {
        operation: "path_reorder".to_string(),
        scope,
        recovery_action: Some("path_reorder".to_string()),
        protection_state: None,
        success,
        verified: verified_flag,
        status,
        reason_code,
        message,
        removed_count: 0,
        path_entries: summarize_path_entries(actual_entries),
        primary_shell_target: primary_shell_target_for_scope(scope),
        shell_guidance,
        snapshot: None,
    })
}

#[tauri::command]
pub fn envvar_list_shell_profiles() -> Result<Vec<ShellProfileInfo>, CogniaError> {
    Ok(env::list_shell_profiles())
}

#[tauri::command]
pub fn envvar_read_shell_profile(
    path: String,
    include_sensitive: Option<bool>,
) -> Result<EnvVarShellProfileReadResult, CogniaError> {
    let content = env::read_shell_profile(&path)?;
    let reveal = include_sensitive.unwrap_or(false);
    if reveal {
        let redaction = env::redact_shell_profile_content(&content);
        return Ok(EnvVarShellProfileReadResult {
            path,
            content,
            redacted_count: redaction.redacted_count,
            contains_sensitive: redaction.contains_sensitive,
            revealed: true,
        });
    }

    let redaction = env::redact_shell_profile_content(&content);
    Ok(EnvVarShellProfileReadResult {
        path,
        content: redaction.content,
        redacted_count: redaction.redacted_count,
        contains_sensitive: redaction.contains_sensitive,
        revealed: false,
    })
}

#[tauri::command]
pub async fn envvar_import_env_file(
    content: String,
    scope: EnvVarScope,
) -> Result<EnvVarImportResult, CogniaError> {
    let support = build_action_support("import", Some(scope));
    if !support.supported {
        return Ok(EnvVarImportResult {
            imported: 0,
            skipped: 0,
            errors: Vec::new(),
            scope,
            recovery_action: Some("import_apply".to_string()),
            protection_state: Some("blocked".to_string()),
            success: false,
            verified: false,
            status: "blocked".to_string(),
            reason_code: Some(support.reason_code),
            message: Some(support.reason),
            primary_shell_target: None,
            shell_guidance: Vec::new(),
            snapshot: None,
        });
    }

    let parsed = env::parse_env_file(&content);
    let mut imported = 0usize;
    let mut skipped = 0usize;
    let mut errors = Vec::new();

    for (raw_key, value) in parsed {
        let key = match env::normalize_env_var_key(&raw_key) {
            Ok(normalized) => normalized,
            Err(error) => {
                skipped += 1;
                errors.push(format_import_error(&raw_key, &error));
                continue;
            }
        };

        match env::set_persistent_var(&key, &value, scope).await {
            Ok(()) => imported += 1,
            Err(error) => {
                skipped += 1;
                errors.push(format_import_error(&key, &error));
            }
        }
    }

    Ok(EnvVarImportResult {
        imported,
        skipped,
        errors,
        scope,
        recovery_action: Some("import_apply".to_string()),
        protection_state: Some("unprotected".to_string()),
        success: true,
        verified: true,
        status: "verified".to_string(),
        reason_code: None,
        message: None,
        primary_shell_target: primary_shell_target_for_scope(scope),
        shell_guidance: shell_guidance_for_pairs(
            &[],
            scope,
            auto_applied_shell_for_scope(scope).as_deref(),
            false,
        ),
        snapshot: None,
    })
}

#[tauri::command]
pub async fn envvar_preview_import_env_file(
    content: String,
    scope: EnvVarScope,
) -> Result<EnvVarImportPreview, CogniaError> {
    build_import_preview(&content, scope).await
}

#[tauri::command]
pub async fn envvar_apply_import_preview(
    content: String,
    scope: EnvVarScope,
    fingerprint: String,
) -> Result<EnvVarImportResult, CogniaError> {
    let support = build_action_support("import", Some(scope));
    if !support.supported {
        return Ok(EnvVarImportResult {
            imported: 0,
            skipped: 0,
            errors: Vec::new(),
            scope,
            recovery_action: Some("import_apply".to_string()),
            protection_state: Some("blocked".to_string()),
            success: false,
            verified: false,
            status: "blocked".to_string(),
            reason_code: Some(support.reason_code),
            message: Some(support.reason),
            primary_shell_target: None,
            shell_guidance: Vec::new(),
            snapshot: None,
        });
    }

    let build = build_import_preview_internal(&content, scope).await?;
    ensure_preview_fingerprint(&build.preview.fingerprint, &fingerprint)?;

    let mut imported = 0usize;
    let mut skipped = 0usize;
    let mut errors = Vec::new();

    for item in &build.apply_items {
        match item.action.as_str() {
            "add" | "update" => {
                match env::set_persistent_var(&item.key, &item.raw_value, scope).await {
                    Ok(()) => imported += 1,
                    Err(error) => {
                        skipped += 1;
                        errors.push(format_import_error(&item.key, &error));
                    }
                }
            }
            "invalid" | "skipped" => {
                skipped += 1;
                if let Some(reason) = &item.reason {
                    errors.push(format!("{} [{}]: {}", item.key, item.action, reason));
                }
            }
            "noop" => skipped += 1,
            _ => skipped += 1,
        }
    }

    Ok(EnvVarImportResult {
        imported,
        skipped,
        errors,
        scope,
        recovery_action: Some("import_apply".to_string()),
        protection_state: Some("unprotected".to_string()),
        success: true,
        verified: true,
        status: "verified".to_string(),
        reason_code: None,
        message: None,
        primary_shell_target: build.preview.primary_shell_target,
        shell_guidance: build.preview.shell_guidance,
        snapshot: None,
    })
}

#[tauri::command]
pub async fn envvar_export_env_file(
    scope: EnvVarScope,
    format: EnvFileFormat,
    include_sensitive: Option<bool>,
) -> Result<EnvVarExportResult, CogniaError> {
    let vars: Vec<(String, String)> = match scope {
        EnvVarScope::Process => {
            let mut v: Vec<(String, String)> = env::get_all_vars().into_iter().collect();
            v.sort_by(|a, b| a.0.cmp(&b.0));
            v
        }
        _ => env::list_persistent_vars(scope).await?,
    };

    let reveal = include_sensitive.unwrap_or(false);
    let sensitive_count = vars
        .iter()
        .filter(|(key, value)| env::classify_env_var_sensitivity(key, value).is_some())
        .count();
    let export_vars = if reveal {
        vars.clone()
    } else {
        vars.iter()
            .map(|(key, value)| {
                if env::classify_env_var_sensitivity(key, value).is_some() {
                    (key.clone(), env::mask_sensitive_value(value))
                } else {
                    (key.clone(), value.clone())
                }
            })
            .collect::<Vec<_>>()
    };

    Ok(EnvVarExportResult {
        scope,
        format,
        content: env::generate_env_file(&export_vars, format),
        redacted: !reveal && sensitive_count > 0,
        sensitive_count,
        variable_count: vars.len(),
        revealed: reveal,
    })
}

// ============================================================================
// New commands
// ============================================================================

#[tauri::command]
pub async fn envvar_list_persistent(
    scope: EnvVarScope,
) -> Result<Vec<(String, String)>, CogniaError> {
    env::list_persistent_vars(scope).await
}

#[tauri::command]
pub async fn envvar_list_persistent_typed(
    scope: EnvVarScope,
) -> Result<Vec<PersistentEnvVar>, CogniaError> {
    #[cfg(windows)]
    {
        let items = env::list_persistent_vars_with_type(scope).await?;
        Ok(items
            .into_iter()
            .map(|(key, value, reg_type)| PersistentEnvVar {
                key,
                value,
                reg_type: if reg_type.is_empty() {
                    None
                } else {
                    Some(reg_type)
                },
            })
            .collect())
    }
    #[cfg(not(windows))]
    {
        let items = env::list_persistent_vars(scope).await?;
        Ok(items
            .into_iter()
            .map(|(key, value)| PersistentEnvVar {
                key,
                value,
                reg_type: None,
            })
            .collect())
    }
}

#[tauri::command]
pub async fn envvar_list_persistent_typed_summaries(
    scope: EnvVarScope,
) -> Result<Vec<EnvVarSummary>, CogniaError> {
    #[cfg(windows)]
    {
        let items = env::list_persistent_vars_with_type(scope).await?;
        Ok(items
            .into_iter()
            .map(|(key, value, reg_type)| EnvVarSummary {
                value: env::summarize_env_value(&key, &value),
                key,
                scope,
                reg_type: if reg_type.is_empty() {
                    None
                } else {
                    Some(reg_type)
                },
            })
            .collect())
    }
    #[cfg(not(windows))]
    {
        let items = env::list_persistent_vars(scope).await?;
        Ok(items
            .into_iter()
            .map(|(key, value)| EnvVarSummary {
                value: env::summarize_env_value(&key, &value),
                key,
                scope,
                reg_type: None,
            })
            .collect())
    }
}

#[tauri::command]
pub async fn envvar_detect_conflicts() -> Result<Vec<EnvVarConflict>, CogniaError> {
    let user_vars = env::list_persistent_vars(EnvVarScope::User).await?;
    let system_vars = env::list_persistent_vars(EnvVarScope::System).await?;

    let system_map: HashMap<String, String> = system_vars.into_iter().collect();
    let mut conflicts = Vec::new();

    for (key, user_value) in &user_vars {
        let lookup_key = if cfg!(windows) {
            // Windows env var names are case-insensitive
            system_map
                .iter()
                .find(|(k, _)| k.eq_ignore_ascii_case(key))
                .map(|(k, v)| (k.clone(), v.clone()))
        } else {
            system_map.get(key).map(|v| (key.clone(), v.clone()))
        };

        if let Some((sys_key, system_value)) = lookup_key {
            if *user_value != system_value {
                let effective = env::get_var(key)
                    .or_else(|| env::get_var(&sys_key))
                    .unwrap_or_default();
                conflicts.push(EnvVarConflict {
                    key: key.clone(),
                    user_value: user_value.clone(),
                    system_value,
                    effective_value: effective,
                });
            }
        }
    }

    Ok(conflicts)
}

#[tauri::command]
pub async fn envvar_resolve_conflict(
    key: String,
    source_scope: EnvVarScope,
    target_scope: EnvVarScope,
) -> Result<EnvVarConflictResolutionResult, CogniaError> {
    let key = env::normalize_env_var_key(&key)?;
    let support = build_action_support("conflict_resolve", Some(target_scope));
    if !support.supported {
        return Ok(EnvVarConflictResolutionResult {
            key,
            source_scope,
            target_scope,
            applied_value: String::new(),
            applied_value_summary: env::summarize_env_value("UNAVAILABLE", ""),
            recovery_action: Some("conflict_resolve".to_string()),
            protection_state: Some("blocked".to_string()),
            success: false,
            verified: false,
            status: "blocked".to_string(),
            reason_code: Some(support.reason_code),
            message: Some(support.reason),
            primary_shell_target: None,
            shell_guidance: Vec::new(),
            snapshot: None,
        });
    }
    let value = env::get_persistent_var(&key, source_scope)
        .await?
        .ok_or_else(|| CogniaError::Config(format!("missing_source_value:{key}")))?;

    env::set_persistent_var(&key, &value, target_scope).await?;

    let primary_shell_target = primary_shell_target_for_scope(target_scope);
    let shell_guidance = shell_guidance_for_pairs(
        &[(key.clone(), value.clone())],
        target_scope,
        auto_applied_shell_for_scope(target_scope).as_deref(),
        false,
    );
    let applied_value_summary = env::summarize_env_value(&key, &value);

    Ok(EnvVarConflictResolutionResult {
        key,
        source_scope,
        target_scope,
        applied_value_summary,
        applied_value: value,
        recovery_action: Some("conflict_resolve".to_string()),
        protection_state: Some("unprotected".to_string()),
        success: true,
        verified: true,
        status: "verified".to_string(),
        reason_code: None,
        message: None,
        primary_shell_target,
        shell_guidance,
        snapshot: None,
    })
}

#[tauri::command]
pub fn envvar_expand(path: String) -> Result<String, CogniaError> {
    Ok(env::expand_path(&path))
}

#[tauri::command]
pub async fn envvar_preview_path_repair(
    scope: EnvVarScope,
) -> Result<EnvVarPathRepairPreview, CogniaError> {
    build_path_repair_preview(scope).await
}

#[tauri::command]
pub async fn envvar_apply_path_repair(
    scope: EnvVarScope,
    fingerprint: String,
) -> Result<EnvVarPathMutationResult, CogniaError> {
    let support = build_action_support("path_repair_apply", Some(scope));
    if !support.supported {
        return Ok(blocked_path_mutation_result("path_repair_apply", scope, &support));
    }

    let preview = build_path_repair_preview(scope).await?;
    ensure_preview_fingerprint(&preview.fingerprint, &fingerprint)?;

    if preview.current_entries != preview.repaired_entries {
        env::set_persistent_path(&preview.repaired_entries, scope).await?;
    }

    Ok(EnvVarPathMutationResult {
        operation: "path_repair_apply".to_string(),
        scope,
        recovery_action: Some("path_repair_apply".to_string()),
        protection_state: None,
        success: true,
        verified: true,
        status: "verified".to_string(),
        reason_code: None,
        message: None,
        removed_count: preview.removed_count,
        path_entries: summarize_path_entries(preview.repaired_entries),
        primary_shell_target: preview.primary_shell_target,
        shell_guidance: preview.shell_guidance,
        snapshot: None,
    })
}

#[tauri::command]
pub fn envvar_generate_shell_guidance(
    key: Option<String>,
    value: Option<String>,
    path_entries: Option<Vec<String>>,
    auto_applied_shell: Option<String>,
    include_sensitive: Option<bool>,
) -> Result<Vec<EnvVarShellGuidance>, CogniaError> {
    let reveal = include_sensitive.unwrap_or(false);
    if let Some(entries) = path_entries {
        return Ok(shell_guidance_for_path(
            &entries,
            EnvVarScope::User,
            auto_applied_shell.as_deref(),
            reveal,
        ));
    }

    match (key, value) {
        (Some(key), Some(value)) => {
            let key = env::normalize_env_var_key(&key)?;
            Ok(shell_guidance_for_pairs(
                &[(key, value)],
                EnvVarScope::User,
                auto_applied_shell.as_deref(),
                reveal,
            ))
        }
        _ => Err(CogniaError::Config(
            "shell_guidance_requires_key_value_or_path_entries".into(),
        )),
    }
}

#[tauri::command]
pub async fn envvar_deduplicate_path(
    scope: EnvVarScope,
) -> Result<EnvVarPathMutationResult, CogniaError> {
    let support = build_action_support("path_deduplicate", Some(scope));
    if !support.supported {
        return Ok(blocked_path_mutation_result(
            "path_deduplicate",
            scope,
            &support,
        ));
    }

    let entries = env::get_persistent_path(scope).await?;
    let original_count = entries.len();
    let mut seen = HashSet::new();
    let deduped: Vec<String> = entries
        .iter()
        .filter(|e| {
            let key = if cfg!(windows) {
                e.to_lowercase()
            } else {
                (*e).clone()
            };
            seen.insert(key)
        })
        .cloned()
        .collect();
    let removed = original_count - deduped.len();
    if removed > 0 {
        env::set_persistent_path(&deduped, scope).await?;
    }
    Ok(EnvVarPathMutationResult {
        operation: "path_deduplicate".to_string(),
        scope,
        recovery_action: Some("path_deduplicate".to_string()),
        protection_state: None,
        success: true,
        verified: true,
        status: "verified".to_string(),
        reason_code: None,
        message: None,
        removed_count: removed,
        path_entries: summarize_path_entries(deduped),
        primary_shell_target: primary_shell_target_for_scope(scope),
        shell_guidance: shell_guidance_for_path(
            &entries,
            scope,
            auto_applied_shell_for_scope(scope).as_deref(),
            false,
        ),
        snapshot: None,
    })
}

// ============================================================================
// Helpers
// ============================================================================

fn format_import_error(key: &str, error: &CogniaError) -> String {
    format!(
        "{} [{}]: {}",
        import_key_label(key),
        import_error_kind(error),
        error
    )
}

#[derive(Debug, Clone)]
struct ImportPreviewApplyItem {
    key: String,
    raw_value: String,
    action: String,
    reason: Option<String>,
}

#[derive(Debug, Clone)]
struct ImportPreviewBuild {
    preview: EnvVarImportPreview,
    apply_items: Vec<ImportPreviewApplyItem>,
}

async fn build_import_preview(
    content: &str,
    scope: EnvVarScope,
) -> Result<EnvVarImportPreview, CogniaError> {
    Ok(build_import_preview_internal(content, scope).await?.preview)
}

async fn build_import_preview_internal(
    content: &str,
    scope: EnvVarScope,
) -> Result<ImportPreviewBuild, CogniaError> {
    let current_vars = list_scope_vars(scope).await?;
    let current_map: HashMap<String, String> = current_vars
        .iter()
        .map(|(key, value)| (scope_key_signature(key), value.clone()))
        .collect();
    let parsed = env::parse_env_file(content);
    let skipped_indexes = find_later_duplicate_indexes(&parsed);

    let mut additions = 0usize;
    let mut updates = 0usize;
    let mut noops = 0usize;
    let mut invalid = 0usize;
    let mut skipped = 0usize;
    let mut items = Vec::new();
    let mut guidance_pairs = Vec::new();
    let mut apply_items = Vec::new();

    for (index, (raw_key, value)) in parsed.iter().enumerate() {
        match env::normalize_env_var_key(raw_key) {
            Err(error) => {
                invalid += 1;
                items.push(EnvVarImportPreviewItem {
                    key: import_key_label(raw_key),
                    value: env::mask_sensitive_value(value),
                    action: "invalid".to_string(),
                    reason: Some(error.to_string()),
                    is_sensitive: false,
                    sensitivity_reason: None,
                    redacted: false,
                });
            }
            Ok(key) => {
                let sensitivity_reason = env::classify_env_var_sensitivity(&key, value);
                let is_sensitive = sensitivity_reason.is_some();
                let display_value = if is_sensitive {
                    env::mask_sensitive_value(value)
                } else {
                    value.clone()
                };
                if skipped_indexes.contains(&index) {
                    skipped += 1;
                    items.push(EnvVarImportPreviewItem {
                        key,
                        value: display_value,
                        action: "skipped".to_string(),
                        reason: Some("overridden_by_later_entry".to_string()),
                        is_sensitive,
                        sensitivity_reason,
                        redacted: is_sensitive,
                    });
                    continue;
                }

                let action = match current_map.get(&scope_key_signature(&key)) {
                    Some(current) if current == value => {
                        noops += 1;
                        "noop"
                    }
                    Some(_) => {
                        updates += 1;
                        guidance_pairs.push((key.clone(), value.clone()));
                        "update"
                    }
                    None => {
                        additions += 1;
                        guidance_pairs.push((key.clone(), value.clone()));
                        "add"
                    }
                };

                items.push(EnvVarImportPreviewItem {
                    key: key.clone(),
                    value: display_value,
                    action: action.to_string(),
                    reason: None,
                    is_sensitive,
                    sensitivity_reason,
                    redacted: is_sensitive,
                });
                apply_items.push(ImportPreviewApplyItem {
                    key,
                    raw_value: value.clone(),
                    action: action.to_string(),
                    reason: None,
                });
            }
        }
    }

    Ok(ImportPreviewBuild {
        preview: EnvVarImportPreview {
            scope,
            fingerprint: scope_snapshot_fingerprint(scope).await?,
            additions,
            updates,
            noops,
            invalid,
            skipped,
            items,
            primary_shell_target: primary_shell_target_for_scope(scope),
            shell_guidance: shell_guidance_for_pairs(
                &guidance_pairs,
                scope,
                auto_applied_shell_for_scope(scope).as_deref(),
                false,
            ),
        },
        apply_items,
    })
}

async fn build_path_repair_preview(
    scope: EnvVarScope,
) -> Result<EnvVarPathRepairPreview, CogniaError> {
    let current_entries = env::get_persistent_path(scope).await?;
    let mut duplicate_count = 0usize;
    let mut missing_count = 0usize;
    let mut seen = HashSet::new();
    let mut repaired_entries = Vec::new();

    for entry in &current_entries {
        let key = scope_key_signature(entry);
        let exists = Path::new(entry).exists();
        if !exists {
            missing_count += 1;
        }
        if !seen.insert(key) {
            duplicate_count += 1;
            continue;
        }
        if exists {
            repaired_entries.push(entry.clone());
        }
    }

    let removed_count = current_entries.len().saturating_sub(repaired_entries.len());

    Ok(EnvVarPathRepairPreview {
        scope,
        fingerprint: path_snapshot_fingerprint(scope).await?,
        current_entries,
        repaired_entries: repaired_entries.clone(),
        duplicate_count,
        missing_count,
        removed_count,
        primary_shell_target: primary_shell_target_for_scope(scope),
        shell_guidance: shell_guidance_for_path(
            &repaired_entries,
            scope,
            auto_applied_shell_for_scope(scope).as_deref(),
            false,
        ),
    })
}

async fn list_scope_vars(scope: EnvVarScope) -> Result<Vec<(String, String)>, CogniaError> {
    match scope {
        EnvVarScope::Process => {
            let mut values: Vec<(String, String)> = env::get_all_vars().into_iter().collect();
            values.sort_by(|a, b| a.0.cmp(&b.0));
            Ok(values)
        }
        _ => env::list_persistent_vars(scope).await,
    }
}

async fn scope_snapshot_fingerprint(scope: EnvVarScope) -> Result<String, CogniaError> {
    let values = list_scope_vars(scope).await?;
    let mut parts = vec![format!("scope:{}", scope_to_string(scope))];
    for (key, value) in values {
        parts.push(format!("{}={}", scope_key_signature(&key), value));
    }
    Ok(stable_fingerprint(&parts))
}

async fn path_snapshot_fingerprint(scope: EnvVarScope) -> Result<String, CogniaError> {
    let entries = env::get_persistent_path(scope).await?;
    let mut parts = vec![format!("scope:{}", scope_to_string(scope))];
    parts.extend(entries.into_iter().map(|entry| scope_key_signature(&entry)));
    Ok(stable_fingerprint(&parts))
}

fn stable_fingerprint(parts: &[String]) -> String {
    let mut hash: u64 = 0xcbf29ce484222325;
    for part in parts {
        for byte in part.as_bytes() {
            hash ^= u64::from(*byte);
            hash = hash.wrapping_mul(0x100000001b3);
        }
        hash ^= 0xff;
        hash = hash.wrapping_mul(0x100000001b3);
    }
    format!("{hash:016x}")
}

fn ensure_preview_fingerprint(actual: &str, expected: &str) -> Result<(), CogniaError> {
    if actual == expected {
        Ok(())
    } else {
        Err(CogniaError::Conflict(
            "stale_preview: state changed since preview was generated".into(),
        ))
    }
}

fn find_later_duplicate_indexes(parsed: &[(String, String)]) -> HashSet<usize> {
    let mut seen = HashSet::new();
    let mut skipped = HashSet::new();

    for (index, (raw_key, _)) in parsed.iter().enumerate().rev() {
        let Ok(normalized) = env::normalize_env_var_key(raw_key) else {
            continue;
        };
        let signature = scope_key_signature(&normalized);
        if !seen.insert(signature) {
            skipped.insert(index);
        }
    }

    skipped
}

fn scope_key_signature(value: &str) -> String {
    if cfg!(windows) {
        value.to_lowercase()
    } else {
        value.to_string()
    }
}

fn current_primary_shell_id() -> Option<String> {
    env::list_shell_profiles()
        .into_iter()
        .find(|profile| profile.is_current)
        .map(|profile| profile.shell)
}

fn primary_shell_target_for_scope(scope: EnvVarScope) -> Option<String> {
    if cfg!(windows) || scope != EnvVarScope::User {
        return None;
    }

    env::list_shell_profiles()
        .into_iter()
        .find(|profile| profile.is_current)
        .map(|profile| profile.config_path)
}

fn auto_applied_shell_for_scope(scope: EnvVarScope) -> Option<String> {
    if cfg!(windows) || scope != EnvVarScope::User {
        return None;
    }

    current_primary_shell_id()
}

fn shell_guidance_for_pairs(
    pairs: &[(String, String)],
    scope: EnvVarScope,
    auto_applied_shell: Option<&str>,
    include_sensitive: bool,
) -> Vec<EnvVarShellGuidance> {
    if pairs.is_empty() || scope != EnvVarScope::User {
        return Vec::new();
    }

    env::list_shell_profiles()
        .into_iter()
        .filter_map(|profile| {
            let has_sensitive_value = pairs
                .iter()
                .any(|(key, value)| env::classify_env_var_sensitivity(key, value).is_some());
            let commands = pairs
                .iter()
                .filter_map(|(key, value)| {
                    let render_value = if !include_sensitive
                        && env::classify_env_var_sensitivity(key, value).is_some()
                    {
                        env::mask_sensitive_value(value)
                    } else {
                        value.clone()
                    };
                    env::render_shell_variable_command(&profile.shell, key, &render_value)
                })
                .collect::<Vec<_>>();

            if commands.is_empty() {
                return None;
            }

            Some(EnvVarShellGuidance {
                shell: profile.shell.clone(),
                config_path: profile.config_path,
                command: commands.join("\n"),
                auto_applied: auto_applied_shell == Some(profile.shell.as_str()),
                contains_sensitive_value: has_sensitive_value,
                redacted: has_sensitive_value && !include_sensitive,
            })
        })
        .collect()
}

fn shell_guidance_for_path(
    entries: &[String],
    scope: EnvVarScope,
    auto_applied_shell: Option<&str>,
    _include_sensitive: bool,
) -> Vec<EnvVarShellGuidance> {
    if entries.is_empty() || scope != EnvVarScope::User {
        return Vec::new();
    }

    env::list_shell_profiles()
        .into_iter()
        .filter_map(|profile| {
            env::render_shell_path_command(&profile.shell, entries).map(|command| {
                EnvVarShellGuidance {
                    shell: profile.shell.clone(),
                    config_path: profile.config_path,
                    command,
                    auto_applied: auto_applied_shell == Some(profile.shell.as_str()),
                    contains_sensitive_value: false,
                    redacted: false,
                }
            })
        })
        .collect()
}

fn scope_to_string(scope: EnvVarScope) -> &'static str {
    match scope {
        EnvVarScope::Process => "process",
        EnvVarScope::User => "user",
        EnvVarScope::System => "system",
    }
}

fn import_key_label(key: &str) -> String {
    let trimmed = key.trim();
    if trimmed.is_empty() {
        "<empty>".to_string()
    } else {
        trimmed.to_string()
    }
}

fn import_error_kind(error: &CogniaError) -> &'static str {
    match error {
        CogniaError::Config(_) => "invalid_input",
        CogniaError::PermissionDenied(_) => "permission_denied",
        CogniaError::Io(_) => "io_error",
        CogniaError::Internal(_) => "platform_error",
        _ => "runtime_error",
    }
}

fn envvar_snapshot_dir(settings: &Settings) -> PathBuf {
    settings.get_state_dir().join("envvar-snapshots")
}

fn envvar_snapshot_payload_path(snapshot_dir: &Path) -> PathBuf {
    snapshot_dir.join("envvar-snapshot.json")
}

fn envvar_snapshot_name_for(created_at: &str) -> String {
    let normalized = created_at
        .chars()
        .filter(|ch| ch.is_ascii_digit())
        .collect::<String>();
    format!("envvar-snapshot-{}", normalized)
}

fn snapshot_scope_signature(scope: &EnvVarSnapshotScopePayload) -> (&str, &str) {
    (&scope.variable_fingerprint, &scope.path_fingerprint)
}

fn build_snapshot_restore_preview_fingerprint(
    snapshot_path: &str,
    snapshot: &EnvVarSnapshotPayload,
    requested_scopes: &[EnvVarScope],
) -> String {
    let mut parts = vec![snapshot_path.to_string(), snapshot.created_at.clone()];
    let mut scope_parts = requested_scopes
        .iter()
        .map(|scope| format!("{scope:?}"))
        .collect::<Vec<_>>();
    scope_parts.sort();
    parts.extend(scope_parts);
    stable_fingerprint(&parts)
}

fn risky_envvar_action(action: &str, scope: EnvVarScope) -> bool {
    if scope == EnvVarScope::Process {
        return false;
    }

    matches!(
        action,
        "set"
            | "persistent_set"
            | "remove"
            | "persistent_remove"
            | "import_apply"
            | "path_add"
            | "path_remove"
            | "path_reorder"
            | "path_deduplicate"
            | "path_repair_apply"
            | "conflict_resolve"
    )
}

async fn write_backup_manifest(
    bundle_dir: &Path,
    manifest: &BackupManifest,
) -> Result<(), CogniaError> {
    let manifest_json = serde_json::to_string_pretty(manifest).map_err(|e| {
        CogniaError::Internal(format!("Failed to serialize snapshot manifest: {}", e))
    })?;
    fs::write_file_string(&bundle_dir.join("manifest.json"), &manifest_json).await?;
    Ok(())
}

async fn read_envvar_snapshot_payload(
    snapshot_dir: &Path,
) -> Result<EnvVarSnapshotPayload, CogniaError> {
    let payload_path = envvar_snapshot_payload_path(snapshot_dir);
    let content = fs::read_file_string(&payload_path).await?;
    serde_json::from_str(&content)
        .map_err(|e| CogniaError::Parse(format!("Failed to parse envvar snapshot payload: {}", e)))
}

fn materialize_snapshot_info(
    path: &Path,
    manifest: &BackupManifest,
    snapshot: EnvVarSnapshotPayload,
    integrity_state: &str,
) -> EnvVarSnapshotInfo {
    EnvVarSnapshotInfo {
        path: path.display().to_string(),
        name: path
            .file_name()
            .and_then(|value| value.to_str())
            .unwrap_or("envvar-snapshot")
            .to_string(),
        created_at: manifest.created_at.clone(),
        creation_mode: snapshot
            .creation_mode
            .unwrap_or(if manifest.auto_generated {
                EnvVarSnapshotCreationMode::Automatic
            } else {
                EnvVarSnapshotCreationMode::Manual
            }),
        source_action: snapshot.source_action.clone(),
        note: snapshot.note.clone().or_else(|| manifest.note.clone()),
        scopes: snapshot.scopes.iter().map(|scope| scope.scope).collect(),
        integrity_state: integrity_state.to_string(),
        snapshot,
    }
}

pub(crate) async fn write_envvar_snapshot_bundle(
    settings: &Settings,
    payload: &EnvVarSnapshotPayload,
    creation_mode: EnvVarSnapshotCreationMode,
    source_action: Option<&str>,
    note: Option<&str>,
    created_at_override: Option<&str>,
) -> Result<EnvVarSnapshotInfo, CogniaError> {
    let created_at = created_at_override
        .map(ToOwned::to_owned)
        .unwrap_or_else(|| Utc::now().to_rfc3339());
    let snapshot_base = envvar_snapshot_dir(settings);
    fs::create_dir_all(&snapshot_base).await?;

    let snapshot_name = envvar_snapshot_name_for(&created_at);
    let mut snapshot_dir = snapshot_base.join(&snapshot_name);
    if fs::exists(&snapshot_dir).await {
        let mut suffix = 1usize;
        loop {
            let candidate = snapshot_base.join(format!("{snapshot_name}-{suffix}"));
            if !fs::exists(&candidate).await {
                snapshot_dir = candidate;
                break;
            }
            suffix += 1;
        }
    }
    fs::create_dir_all(&snapshot_dir).await?;

    let mut materialized = payload.clone();
    materialized.created_at = created_at.clone();
    materialized.creation_mode = Some(creation_mode);
    materialized.source_action = source_action.map(|value| value.to_string());
    materialized.note = note.map(|value| value.to_string());

    let payload_json = serde_json::to_string_pretty(&materialized).map_err(|e| {
        CogniaError::Internal(format!(
            "Failed to serialize envvar snapshot payload: {}",
            e
        ))
    })?;
    let payload_path = envvar_snapshot_payload_path(&snapshot_dir);
    fs::write_file_string(&payload_path, &payload_json).await?;
    let payload_checksum = fs::calculate_sha256(&payload_path).await?;
    let payload_size = fs::file_size(&payload_path).await?;

    let mut file_checksums = HashMap::new();
    file_checksums.insert("envvar-snapshot.json".to_string(), payload_checksum);

    let manifest = BackupManifest {
        format_version: 1,
        app_version: env!("CARGO_PKG_VERSION").to_string(),
        created_at,
        platform: std::env::consts::OS.to_string(),
        hostname: sysinfo::System::host_name().unwrap_or_else(|| "unknown".to_string()),
        contents: vec![],
        file_checksums,
        total_size: payload_size,
        note: materialized.note.clone(),
        auto_generated: creation_mode == EnvVarSnapshotCreationMode::Automatic,
    };
    write_backup_manifest(&snapshot_dir, &manifest).await?;

    Ok(materialize_snapshot_info(
        &snapshot_dir,
        &manifest,
        materialized,
        "valid",
    ))
}

pub(crate) async fn list_envvar_snapshot_bundles(
    settings: &Settings,
) -> Result<Vec<EnvVarSnapshotInfo>, CogniaError> {
    let snapshot_base = envvar_snapshot_dir(settings);
    if !fs::exists(&snapshot_base).await {
        return Ok(Vec::new());
    }

    let mut snapshots = Vec::new();
    let mut entries = tokio::fs::read_dir(&snapshot_base)
        .await
        .map_err(CogniaError::Io)?;

    while let Some(entry) = entries.next_entry().await.map_err(CogniaError::Io)? {
        let path = entry.path();
        if !path.is_dir() {
            continue;
        }

        let validation = crate::core::backup::validate_backup(&path).await?;
        let Some(manifest) = validation.manifest else {
            continue;
        };
        let snapshot = match read_envvar_snapshot_payload(&path).await {
            Ok(snapshot) => snapshot,
            Err(_) => continue,
        };
        snapshots.push(materialize_snapshot_info(
            &path,
            &manifest,
            snapshot,
            if validation.valid { "valid" } else { "invalid" },
        ));
    }

    snapshots.sort_by(|left, right| right.created_at.cmp(&left.created_at));
    Ok(snapshots)
}

pub(crate) async fn create_envvar_snapshot_for_settings(
    settings: &Settings,
    scopes: &[EnvVarScope],
    creation_mode: EnvVarSnapshotCreationMode,
    source_action: Option<&str>,
    note: Option<&str>,
) -> Result<EnvVarSnapshotCreateResult, CogniaError> {
    let _gate = crate::core::backup::try_acquire_backup_mutation_gate("create")
        .map_err(CogniaError::Config)?;
    let payload = capture_envvar_snapshot_payload(scopes).await?;
    let snapshot = write_envvar_snapshot_bundle(
        settings,
        &payload,
        creation_mode,
        source_action,
        note,
        None,
    )
    .await?;

    Ok(EnvVarSnapshotCreateResult {
        success: true,
        status: "verified".to_string(),
        reason_code: None,
        message: None,
        snapshot: Some(snapshot),
    })
}

pub(crate) async fn cleanup_envvar_snapshot_bundles(
    settings: &Settings,
    max_count: u32,
    max_age_days: u32,
) -> Result<u32, CogniaError> {
    let mut deleted = 0u32;
    let mut snapshots = list_envvar_snapshot_bundles(settings).await?;

    if max_age_days > 0 {
        let cutoff = Utc::now() - chrono::Duration::days(max_age_days as i64);
        for snapshot in snapshots
            .iter()
            .filter(|item| item.creation_mode == EnvVarSnapshotCreationMode::Automatic)
            .filter(|item| item.created_at < cutoff.to_rfc3339())
        {
            if crate::core::backup::delete_backup(Path::new(&snapshot.path))
                .await
                .unwrap_or(false)
            {
                deleted += 1;
            }
        }
        snapshots = list_envvar_snapshot_bundles(settings).await?;
    }

    if max_count > 0 {
        let automatic = snapshots
            .iter()
            .filter(|item| item.creation_mode == EnvVarSnapshotCreationMode::Automatic)
            .collect::<Vec<_>>();
        if automatic.len() > max_count as usize {
            for snapshot in &automatic[max_count as usize..] {
                if crate::core::backup::delete_backup(Path::new(&snapshot.path))
                    .await
                    .unwrap_or(false)
                {
                    deleted += 1;
                }
            }
        }
    }

    Ok(deleted)
}

pub(crate) fn build_envvar_backup_protection_state(
    action: &str,
    scope: EnvVarScope,
    current_scope: &EnvVarSnapshotScopePayload,
    snapshots: &[EnvVarSnapshotInfo],
) -> EnvVarBackupProtectionState {
    if !risky_envvar_action(action, scope) {
        return EnvVarBackupProtectionState {
            action: action.to_string(),
            scope,
            state: "unprotected".to_string(),
            reason_code: "action_not_protected".to_string(),
            reason: "This envvar workflow does not require a safety snapshot.".to_string(),
            next_steps: Vec::new(),
            snapshot: None,
        };
    }

    if !current_scope.restorable {
        return EnvVarBackupProtectionState {
            action: action.to_string(),
            scope,
            state: "unprotected".to_string(),
            reason_code: "scope_not_persisted".to_string(),
            reason: "Process-scope envvar state is transient and cannot be restored as a durable snapshot.".to_string(),
            next_steps: vec![
                "Switch to a persistent scope if you need rollback protection.".to_string(),
            ],
            snapshot: None,
        };
    }

    let matching = snapshots
        .iter()
        .filter(|item| item.creation_mode == EnvVarSnapshotCreationMode::Automatic)
        .filter(|item| item.integrity_state == "valid")
        .filter(|item| item.source_action.as_deref() == Some(action))
        .find(|item| {
            item.snapshot.scopes.iter().any(|scope_payload| {
                scope_payload.scope == scope
                    && snapshot_scope_signature(scope_payload)
                        == snapshot_scope_signature(current_scope)
            })
        })
        .cloned();

    if let Some(snapshot) = matching {
        return EnvVarBackupProtectionState {
            action: action.to_string(),
            scope,
            state: "will_reuse".to_string(),
            reason_code: "compatible_snapshot_available".to_string(),
            reason: "A compatible automatic envvar snapshot already protects the current state."
                .to_string(),
            next_steps: Vec::new(),
            snapshot: Some(snapshot),
        };
    }

    EnvVarBackupProtectionState {
        action: action.to_string(),
        scope,
        state: "will_create".to_string(),
        reason_code: "new_snapshot_required".to_string(),
        reason: "A fresh envvar safety snapshot should be created before this mutation runs."
            .to_string(),
        next_steps: vec![
            "Create a safety snapshot before applying the risky envvar mutation.".to_string(),
        ],
        snapshot: None,
    }
}

pub(crate) fn build_envvar_snapshot_restore_preview(
    snapshot_path: &str,
    snapshot: &EnvVarSnapshotPayload,
    current_scopes: &[EnvVarSnapshotScopePayload],
    requested_scopes: &[EnvVarScope],
) -> EnvVarSnapshotRestorePreview {
    let mut segments = Vec::new();

    for scope in requested_scopes {
        let Some(target) = snapshot.scopes.iter().find(|item| item.scope == *scope) else {
            segments.push(EnvVarSnapshotRestorePreviewSegment {
                scope: *scope,
                changed_variables: 0,
                added_variables: 0,
                removed_variables: 0,
                added_path_entries: 0,
                removed_path_entries: 0,
                skipped: true,
                reason_code: Some("scope_not_in_snapshot".to_string()),
                reason: Some("The requested scope is not present in this snapshot.".to_string()),
            });
            continue;
        };

        if !target.restorable {
            segments.push(EnvVarSnapshotRestorePreviewSegment {
                scope: *scope,
                changed_variables: 0,
                added_variables: 0,
                removed_variables: 0,
                added_path_entries: 0,
                removed_path_entries: 0,
                skipped: true,
                reason_code: Some("scope_not_restorable".to_string()),
                reason: Some(
                    "This scope is stored for diagnostics only and is not restorable.".to_string(),
                ),
            });
            continue;
        }

        let current = current_scopes.iter().find(|item| item.scope == *scope);
        let current_var_map = current
            .map(|value| {
                value
                    .variables
                    .iter()
                    .map(|entry| (scope_key_signature(&entry.key), entry.value.clone()))
                    .collect::<HashMap<_, _>>()
            })
            .unwrap_or_default();
        let target_var_map = target
            .variables
            .iter()
            .map(|entry| (scope_key_signature(&entry.key), entry.value.clone()))
            .collect::<HashMap<_, _>>();

        let added_variables = target_var_map
            .keys()
            .filter(|key| !current_var_map.contains_key(*key))
            .count();
        let removed_variables = current_var_map
            .keys()
            .filter(|key| !target_var_map.contains_key(*key))
            .count();
        let changed_variables = target_var_map
            .iter()
            .filter(|(key, value)| {
                current_var_map
                    .get(*key)
                    .is_some_and(|current| current != *value)
            })
            .count();

        let current_paths = current
            .map(|value| value.path_entries.clone())
            .unwrap_or_default();
        let current_path_signatures = current_paths
            .iter()
            .map(|entry| scope_key_signature(entry))
            .collect::<HashSet<_>>();
        let target_path_signatures = target
            .path_entries
            .iter()
            .map(|entry| scope_key_signature(entry))
            .collect::<HashSet<_>>();
        let added_path_entries = target_path_signatures
            .iter()
            .filter(|entry| !current_path_signatures.contains(*entry))
            .count();
        let removed_path_entries = current_path_signatures
            .iter()
            .filter(|entry| !target_path_signatures.contains(*entry))
            .count();

        segments.push(EnvVarSnapshotRestorePreviewSegment {
            scope: *scope,
            changed_variables,
            added_variables,
            removed_variables,
            added_path_entries,
            removed_path_entries,
            skipped: false,
            reason_code: None,
            reason: None,
        });
    }

    EnvVarSnapshotRestorePreview {
        created_at: snapshot.created_at.clone(),
        fingerprint: build_snapshot_restore_preview_fingerprint(
            snapshot_path,
            snapshot,
            requested_scopes,
        ),
        segments,
    }
}

async fn capture_snapshot_scope_payload(
    scope: EnvVarScope,
) -> Result<EnvVarSnapshotScopePayload, CogniaError> {
    let variables = match scope {
        EnvVarScope::Process => {
            let mut values = env::get_all_vars()
                .into_iter()
                .map(|(key, value)| PersistentEnvVar {
                    key,
                    value,
                    reg_type: None,
                })
                .collect::<Vec<_>>();
            values.sort_by(|left, right| left.key.cmp(&right.key));
            values
        }
        EnvVarScope::User | EnvVarScope::System => envvar_list_persistent_typed(scope).await?,
    };

    let path_entries = env::get_persistent_path(scope).await?;

    Ok(EnvVarSnapshotScopePayload {
        scope,
        variables,
        path_entries,
        variable_fingerprint: scope_snapshot_fingerprint(scope).await?,
        path_fingerprint: path_snapshot_fingerprint(scope).await?,
        restorable: scope != EnvVarScope::Process,
    })
}

pub(crate) async fn capture_envvar_snapshot_payload(
    scopes: &[EnvVarScope],
) -> Result<EnvVarSnapshotPayload, CogniaError> {
    let mut requested = scopes.to_vec();
    if requested.is_empty() {
        requested = vec![EnvVarScope::User, EnvVarScope::System];
    }
    requested.sort_by_key(|scope| match scope {
        EnvVarScope::Process => 0,
        EnvVarScope::User => 1,
        EnvVarScope::System => 2,
    });
    requested.dedup();

    let mut captured = Vec::with_capacity(requested.len());
    for scope in requested {
        captured.push(capture_snapshot_scope_payload(scope).await?);
    }

    Ok(EnvVarSnapshotPayload {
        format_version: 1,
        created_at: Utc::now().to_rfc3339(),
        creation_mode: None,
        source_action: None,
        note: None,
        scopes: captured,
    })
}

pub(crate) async fn find_envvar_snapshot_by_path(
    settings: &Settings,
    snapshot_path: &str,
) -> Result<EnvVarSnapshotInfo, CogniaError> {
    let snapshots = list_envvar_snapshot_bundles(settings).await?;
    snapshots
        .into_iter()
        .find(|item| item.path == snapshot_path)
        .ok_or_else(|| CogniaError::Config(format!("envvar_snapshot_not_found:{snapshot_path}")))
}

pub(crate) async fn get_envvar_backup_protection_for_settings(
    settings: &Settings,
    action: &str,
    scope: EnvVarScope,
) -> Result<EnvVarBackupProtectionState, CogniaError> {
    let current_scope = capture_snapshot_scope_payload(scope).await?;
    let snapshots = list_envvar_snapshot_bundles(settings).await?;

    let state = build_envvar_backup_protection_state(action, scope, &current_scope, &snapshots);
    if state.state == "will_create" {
        fs::create_dir_all(&envvar_snapshot_dir(settings)).await?;
    }
    Ok(state)
}

pub(crate) async fn preview_envvar_snapshot_for_settings(
    settings: &Settings,
    snapshot_path: &str,
    scopes: &[EnvVarScope],
) -> Result<EnvVarSnapshotRestorePreview, CogniaError> {
    let snapshot = find_envvar_snapshot_by_path(settings, snapshot_path).await?;
    let requested_scopes = if scopes.is_empty() {
        snapshot.scopes.clone()
    } else {
        scopes.to_vec()
    };
    let current = capture_envvar_snapshot_payload(&requested_scopes).await?;
    Ok(build_envvar_snapshot_restore_preview(
        &snapshot.path,
        &snapshot.snapshot,
        &current.scopes,
        &requested_scopes,
    ))
}

pub(crate) async fn restore_envvar_snapshot_for_settings(
    settings: &Settings,
    snapshot_path: &str,
    scopes: &[EnvVarScope],
    preview_fingerprint: Option<&str>,
) -> Result<EnvVarSnapshotRestoreResult, CogniaError> {
    let _gate = crate::core::backup::try_acquire_backup_mutation_gate("restore")
        .map_err(CogniaError::Config)?;
    let snapshot = find_envvar_snapshot_by_path(settings, snapshot_path).await?;
    let requested_scopes = if scopes.is_empty() {
        snapshot.scopes.clone()
    } else {
        scopes.to_vec()
    };
    let expected_fingerprint = build_snapshot_restore_preview_fingerprint(
        &snapshot.path,
        &snapshot.snapshot,
        &requested_scopes,
    );
    let provided_fingerprint = preview_fingerprint.ok_or_else(|| {
        CogniaError::Conflict("stale_preview: restore preview is required before restore".into())
    })?;
    ensure_preview_fingerprint(&expected_fingerprint, provided_fingerprint)?;

    let mut restored_scopes = Vec::new();
    let mut skipped = Vec::new();
    let mut shell_guidance = Vec::new();
    let mut primary_shell_target = None;

    for scope in requested_scopes {
        let Some(scope_payload) = snapshot
            .snapshot
            .scopes
            .iter()
            .find(|item| item.scope == scope)
        else {
            skipped.push(EnvVarSnapshotRestoreSkipped {
                scope,
                reason_code: Some("scope_not_in_snapshot".to_string()),
                reason: "The requested scope is not present in this snapshot.".to_string(),
            });
            continue;
        };

        if !scope_payload.restorable {
            skipped.push(EnvVarSnapshotRestoreSkipped {
                scope,
                reason_code: Some("scope_not_restorable".to_string()),
                reason: "This scope is diagnostic-only and cannot be restored.".to_string(),
            });
            continue;
        }

        let current_vars = envvar_list_persistent_typed(scope).await?;
        let target_map = scope_payload
            .variables
            .iter()
            .map(|item| (scope_key_signature(&item.key), item.clone()))
            .collect::<HashMap<_, _>>();

        for current in current_vars {
            if !target_map.contains_key(&scope_key_signature(&current.key)) {
                env::remove_persistent_var(&current.key, scope).await?;
            }
        }

        for variable in &scope_payload.variables {
            env::set_persistent_var(&variable.key, &variable.value, scope).await?;
        }
        env::set_persistent_path(&scope_payload.path_entries, scope).await?;

        let mut scope_verified = true;
        for variable in &scope_payload.variables {
            let (verified, _) =
                env::verify_envvar_value_state(&variable.key, scope, Some(&variable.value)).await?;
            scope_verified &= verified;
        }
        let (path_verified, actual_path) =
            env::verify_envvar_path_state(scope, &scope_payload.path_entries).await?;
        scope_verified &= path_verified;

        if scope_verified {
            restored_scopes.push(scope);
        } else {
            skipped.push(EnvVarSnapshotRestoreSkipped {
                scope,
                reason_code: Some("post_restore_verification_failed".to_string()),
                reason: format!(
                    "Restored state could not be verified for {} (PATH entries: {}).",
                    scope_to_string(scope),
                    actual_path.len()
                ),
            });
        }

        if scope == EnvVarScope::User {
            primary_shell_target = primary_shell_target_for_scope(scope);
            let variable_pairs = scope_payload
                .variables
                .iter()
                .map(|item| (item.key.clone(), item.value.clone()))
                .collect::<Vec<_>>();
            shell_guidance.extend(shell_guidance_for_pairs(
                &variable_pairs,
                scope,
                auto_applied_shell_for_scope(scope).as_deref(),
                false,
            ));
            shell_guidance.extend(shell_guidance_for_path(
                &scope_payload.path_entries,
                scope,
                auto_applied_shell_for_scope(scope).as_deref(),
                false,
            ));
        }
    }

    let success = !restored_scopes.is_empty();
    let verified = success && skipped.is_empty();
    let status = if verified {
        "verified"
    } else if success {
        "partial"
    } else {
        "failed"
    };

    Ok(EnvVarSnapshotRestoreResult {
        success,
        verified,
        status: status.to_string(),
        reason_code: if verified {
            None
        } else if success {
            Some("partial_restore".to_string())
        } else {
            Some("restore_failed".to_string())
        },
        message: if skipped.is_empty() {
            None
        } else {
            Some("Some requested envvar scopes were skipped or could not be verified.".to_string())
        },
        restored_scopes,
        skipped,
        primary_shell_target,
        shell_guidance,
    })
}

#[tauri::command]
pub async fn envvar_list_snapshots(
    settings: State<'_, SharedSettings>,
) -> Result<Vec<EnvVarSnapshotInfo>, String> {
    let settings = settings.read().await;
    list_envvar_snapshot_bundles(&settings)
        .await
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub async fn envvar_create_snapshot(
    scopes: Vec<EnvVarScope>,
    creation_mode: Option<EnvVarSnapshotCreationMode>,
    source_action: Option<String>,
    note: Option<String>,
    settings: State<'_, SharedSettings>,
) -> Result<EnvVarSnapshotCreateResult, String> {
    let settings = settings.read().await;
    let creation_mode = creation_mode.unwrap_or(EnvVarSnapshotCreationMode::Manual);
    match create_envvar_snapshot_for_settings(
        &settings,
        &scopes,
        creation_mode,
        source_action.as_deref(),
        note.as_deref(),
    )
    .await
    {
        Ok(result) => Ok(result),
        Err(error) => Ok(EnvVarSnapshotCreateResult {
            success: false,
            status: "failed".to_string(),
            reason_code: Some("snapshot_create_failed".to_string()),
            message: Some(error.to_string()),
            snapshot: None,
        }),
    }
}

#[tauri::command]
pub async fn envvar_get_backup_protection(
    action: String,
    scope: EnvVarScope,
    settings: State<'_, SharedSettings>,
) -> Result<EnvVarBackupProtectionState, String> {
    let settings = settings.read().await;
    get_envvar_backup_protection_for_settings(&settings, &action, scope)
        .await
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub async fn envvar_preview_snapshot_restore(
    snapshot_path: String,
    scopes: Vec<EnvVarScope>,
    settings: State<'_, SharedSettings>,
) -> Result<EnvVarSnapshotRestorePreview, String> {
    let settings = settings.read().await;
    preview_envvar_snapshot_for_settings(&settings, &snapshot_path, &scopes)
        .await
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub async fn envvar_restore_snapshot(
    snapshot_path: String,
    scopes: Vec<EnvVarScope>,
    preview_fingerprint: Option<String>,
    settings: State<'_, SharedSettings>,
) -> Result<EnvVarSnapshotRestoreResult, String> {
    let settings = settings.read().await;
    restore_envvar_snapshot_for_settings(
        &settings,
        &snapshot_path,
        &scopes,
        preview_fingerprint.as_deref(),
    )
        .await
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub async fn envvar_delete_snapshot(snapshot_path: String) -> Result<BackupDeleteResult, String> {
    Ok(crate::core::backup::delete_backup_with_result(Path::new(&snapshot_path)).await)
}

#[cfg(test)]
mod tests {
    use super::*;
    use once_cell::sync::Lazy;
    use tempfile::tempdir;
    use tokio::sync::Mutex;

    static PROCESS_ENV_TEST_LOCK: Lazy<Mutex<()>> = Lazy::new(|| Mutex::new(()));

    fn snapshot_test_settings(root: &Path) -> crate::config::Settings {
        let mut settings = crate::config::Settings::default();
        settings.paths.root = Some(root.to_path_buf());
        settings
    }

    fn sample_snapshot_payload(
        scope: EnvVarScope,
        key: &str,
        value: &str,
    ) -> EnvVarSnapshotPayload {
        EnvVarSnapshotPayload {
            format_version: 1,
            created_at: "2026-03-19T00:00:00Z".to_string(),
            creation_mode: None,
            source_action: None,
            note: None,
            scopes: vec![EnvVarSnapshotScopePayload {
                scope,
                variables: vec![PersistentEnvVar {
                    key: key.to_string(),
                    value: value.to_string(),
                    reg_type: None,
                }],
                path_entries: vec!["/tmp/bin".to_string()],
                variable_fingerprint: format!("vars:{scope:?}:{key}:{value}"),
                path_fingerprint: format!("path:{scope:?}:/tmp/bin"),
                restorable: scope != EnvVarScope::Process,
            }],
        }
    }

    #[test]
    fn import_error_kind_maps_core_error_variants() {
        assert_eq!(
            import_error_kind(&CogniaError::Config("bad key".into())),
            "invalid_input"
        );
        assert_eq!(
            import_error_kind(&CogniaError::PermissionDenied("denied".into())),
            "permission_denied"
        );
        assert_eq!(
            import_error_kind(&CogniaError::Internal("broken".into())),
            "platform_error"
        );
    }

    #[test]
    fn format_import_error_uses_stable_shape() {
        let error = format_import_error("", &CogniaError::Config("bad".into()));
        assert!(error.contains("<empty> [invalid_input]:"));
    }

    #[tokio::test]
    async fn import_env_file_reports_invalid_key_as_skipped() {
        let _guard = PROCESS_ENV_TEST_LOCK.lock().await;
        let result = envvar_import_env_file("BAD KEY=1\nGOOD_KEY=2".into(), EnvVarScope::Process)
            .await
            .expect("import should not crash");
        assert_eq!(result.imported, 1);
        assert_eq!(result.skipped, 1);
        assert_eq!(result.errors.len(), 1);
        assert!(result.errors[0].contains("[invalid_input]"));

        env::remove_var("GOOD_KEY");
    }

    #[tokio::test]
    async fn process_summaries_mask_sensitive_values() {
        let _guard = PROCESS_ENV_TEST_LOCK.lock().await;
        env::set_var("COGNIA_MASKED_TOKEN", "ghp_super_secret_token");
        env::set_var("COGNIA_VISIBLE_MODE", "development");

        let summaries = envvar_list_process_summaries().expect("list summaries should succeed");

        let sensitive = summaries
            .iter()
            .find(|item| item.key == "COGNIA_MASKED_TOKEN")
            .expect("sensitive summary should exist");
        assert!(sensitive.value.is_sensitive);
        assert!(sensitive.value.masked);
        assert_ne!(sensitive.value.display_value, "ghp_super_secret_token");

        let normal = summaries
            .iter()
            .find(|item| item.key == "COGNIA_VISIBLE_MODE")
            .expect("non-sensitive summary should exist");
        assert!(!normal.value.is_sensitive);
        assert_eq!(normal.value.display_value, "development");

        env::remove_var("COGNIA_MASKED_TOKEN");
        env::remove_var("COGNIA_VISIBLE_MODE");
    }

    #[tokio::test]
    async fn export_redacts_sensitive_values_by_default() {
        let _guard = PROCESS_ENV_TEST_LOCK.lock().await;
        env::set_var("COGNIA_EXPORT_TOKEN", "glpat-secret-value");

        let result = envvar_export_env_file(EnvVarScope::Process, EnvFileFormat::Dotenv, None)
            .await
            .expect("export should succeed");

        assert!(result.redacted);
        assert!(result.sensitive_count >= 1);
        assert!(result.content.contains("COGNIA_EXPORT_TOKEN"));
        assert!(!result.content.contains("glpat-secret-value"));
        assert!(result.content.contains("[hidden:"));

        env::remove_var("COGNIA_EXPORT_TOKEN");
    }

    #[test]
    fn shell_profile_reads_redact_sensitive_values_by_default() {
        let dir = tempdir().expect("temp dir");
        let path = dir.path().join(".bashrc");
        std::fs::write(
            &path,
            "export GITHUB_TOKEN=\"ghp_secret\"\nexport NODE_ENV=\"development\"\n",
        )
        .expect("write shell profile");

        let result = envvar_read_shell_profile(path.display().to_string(), None)
            .expect("read shell profile should succeed");

        assert!(result.contains_sensitive);
        assert_eq!(result.redacted_count, 1);
        assert!(result.content.contains("[REDACTED]"));
        assert!(!result.content.contains("ghp_secret"));
        assert!(result.content.contains("NODE_ENV=\"development\""));
    }

    #[tokio::test]
    async fn deduplicate_path_is_idempotent() {
        let _guard = PROCESS_ENV_TEST_LOCK.lock().await;
        let original = env::get_persistent_path(EnvVarScope::Process)
            .await
            .expect("read original PATH");
        let test_entries = vec![
            "__COGNIA_PATH_TEST_A__".to_string(),
            "__COGNIA_PATH_TEST_A__".to_string(),
            "__COGNIA_PATH_TEST_B__".to_string(),
        ];

        env::set_persistent_path(&test_entries, EnvVarScope::Process)
            .await
            .expect("set temporary PATH");

        let removed_first = envvar_deduplicate_path(EnvVarScope::Process)
            .await
            .expect("first dedup");
        let removed_second = envvar_deduplicate_path(EnvVarScope::Process)
            .await
            .expect("second dedup");

        assert_eq!(removed_first.removed_count, 1);
        assert_eq!(removed_second.removed_count, 0);

        env::set_persistent_path(&original, EnvVarScope::Process)
            .await
            .expect("restore PATH");
    }

    #[tokio::test]
    async fn preview_import_classifies_add_update_noop_invalid_and_skipped_entries() {
        let _guard = PROCESS_ENV_TEST_LOCK.lock().await;
        env::set_var("ENVVAR_PREVIEW_EXISTING", "same");
        env::set_var("ENVVAR_PREVIEW_UPDATE", "before");

        let preview = envvar_preview_import_env_file(
            "ENVVAR_PREVIEW_NEW=created\nENVVAR_PREVIEW_EXISTING=same\nBAD KEY=oops\nENVVAR_PREVIEW_UPDATE=after\nENVVAR_PREVIEW_NEW=duplicate".into(),
            EnvVarScope::Process,
        )
        .await
        .expect("preview should succeed");

        assert_eq!(preview.additions, 1);
        assert_eq!(preview.updates, 1);
        assert_eq!(preview.noops, 1);
        assert_eq!(preview.invalid, 1);
        assert_eq!(preview.skipped, 1);
        assert!(!preview.fingerprint.is_empty());

        env::remove_var("ENVVAR_PREVIEW_EXISTING");
        env::remove_var("ENVVAR_PREVIEW_UPDATE");
        env::remove_var("ENVVAR_PREVIEW_NEW");
    }

    #[tokio::test]
    async fn apply_import_preview_rejects_stale_fingerprint() {
        let _guard = PROCESS_ENV_TEST_LOCK.lock().await;
        env::set_var("ENVVAR_STALE_IMPORT", "before");

        let preview = envvar_preview_import_env_file(
            "ENVVAR_STALE_IMPORT=after".into(),
            EnvVarScope::Process,
        )
        .await
        .expect("preview should succeed");

        env::set_var("ENVVAR_STALE_IMPORT", "changed-after-preview");

        let result = envvar_apply_import_preview(
            "ENVVAR_STALE_IMPORT=after".into(),
            EnvVarScope::Process,
            preview.fingerprint,
        )
        .await;

        assert!(
            matches!(result, Err(CogniaError::Conflict(message)) if message.contains("stale_preview"))
        );

        env::remove_var("ENVVAR_STALE_IMPORT");
    }

    #[tokio::test]
    async fn apply_import_preview_returns_verification_metadata() {
        let _guard = PROCESS_ENV_TEST_LOCK.lock().await;
        let result = envvar_apply_import_preview(
            "ENVVAR_IMPORT_VERIFY=after".into(),
            EnvVarScope::Process,
            envvar_preview_import_env_file(
                "ENVVAR_IMPORT_VERIFY=after".into(),
                EnvVarScope::Process,
            )
            .await
            .expect("preview should succeed")
            .fingerprint,
        )
        .await
        .expect("apply import preview should succeed");

        let json = serde_json::to_value(&result).expect("serialize result");
        assert_eq!(json["status"], "verified");
        assert_eq!(json["verified"], true);
        assert_eq!(json["scope"], "process");

        env::remove_var("ENVVAR_IMPORT_VERIFY");
    }

    #[tokio::test]
    async fn preview_path_repair_reports_missing_and_duplicate_entries() {
        let _guard = PROCESS_ENV_TEST_LOCK.lock().await;
        let original = env::get_persistent_path(EnvVarScope::Process)
            .await
            .expect("read original PATH");
        let existing_dir = tempdir().expect("temp dir for existing PATH entry");
        let existing_path = existing_dir.path().display().to_string();
        let test_entries = vec![
            existing_path.clone(),
            existing_path.clone(),
            "__COGNIA_PATH_MISSING__".to_string(),
        ];

        env::set_persistent_path(&test_entries, EnvVarScope::Process)
            .await
            .expect("set temporary PATH");

        let preview = envvar_preview_path_repair(EnvVarScope::Process)
            .await
            .expect("path preview should succeed");

        assert_eq!(preview.duplicate_count, 1);
        assert_eq!(preview.missing_count, 1);
        assert_eq!(preview.removed_count, 2);
        assert_eq!(preview.repaired_entries, vec![existing_path]);
        assert!(!preview.fingerprint.is_empty());

        env::set_persistent_path(&original, EnvVarScope::Process)
            .await
            .expect("restore PATH");
    }

    #[tokio::test]
    async fn apply_path_repair_rejects_stale_fingerprint() {
        let _guard = PROCESS_ENV_TEST_LOCK.lock().await;
        let original = env::get_persistent_path(EnvVarScope::Process)
            .await
            .expect("read original PATH");
        let test_entries = vec![
            "__COGNIA_PATH_STALE_A__".to_string(),
            "__COGNIA_PATH_STALE_A__".to_string(),
        ];

        env::set_persistent_path(&test_entries, EnvVarScope::Process)
            .await
            .expect("set temporary PATH");

        let preview = envvar_preview_path_repair(EnvVarScope::Process)
            .await
            .expect("path preview should succeed");

        env::set_persistent_path(
            &["__COGNIA_PATH_STALE_B__".to_string()],
            EnvVarScope::Process,
        )
        .await
        .expect("mutate PATH after preview");

        let result = envvar_apply_path_repair(EnvVarScope::Process, preview.fingerprint).await;
        assert!(
            matches!(result, Err(CogniaError::Conflict(message)) if message.contains("stale_preview"))
        );

        env::set_persistent_path(&original, EnvVarScope::Process)
            .await
            .expect("restore PATH");
    }

    #[tokio::test]
    async fn apply_path_repair_reports_canonical_operation_id() {
        let _guard = PROCESS_ENV_TEST_LOCK.lock().await;
        let original = env::get_persistent_path(EnvVarScope::Process)
            .await
            .expect("read original PATH");
        let existing_dir = tempdir().expect("temp dir for existing PATH entry");
        let existing_path = existing_dir.path().display().to_string();
        let test_entries = vec![
            existing_path.clone(),
            existing_path.clone(),
            "__COGNIA_PATH_MISSING_CANONICAL__".to_string(),
        ];

        env::set_persistent_path(&test_entries, EnvVarScope::Process)
            .await
            .expect("set temporary PATH");

        let preview = envvar_preview_path_repair(EnvVarScope::Process)
            .await
            .expect("path preview should succeed");
        let result = envvar_apply_path_repair(EnvVarScope::Process, preview.fingerprint)
            .await
            .expect("path repair should succeed");

        assert_eq!(result.operation, "path_repair_apply");

        env::set_persistent_path(&original, EnvVarScope::Process)
            .await
            .expect("restore PATH");
    }

    #[tokio::test]
    async fn resolve_conflict_copies_source_value_to_target_scope() {
        let _guard = PROCESS_ENV_TEST_LOCK.lock().await;
        env::set_var("ENVVAR_RESOLVE_KEY", "from-source");

        let result = envvar_resolve_conflict(
            "ENVVAR_RESOLVE_KEY".into(),
            EnvVarScope::Process,
            EnvVarScope::Process,
        )
        .await
        .expect("conflict resolution should succeed");

        assert_eq!(result.key, "ENVVAR_RESOLVE_KEY");
        assert_eq!(result.applied_value, "from-source");

        env::remove_var("ENVVAR_RESOLVE_KEY");
    }

    #[tokio::test]
    async fn resolve_conflict_returns_verification_metadata() {
        let _guard = PROCESS_ENV_TEST_LOCK.lock().await;
        env::set_var("ENVVAR_RESOLVE_VERIFY", "from-source");

        let result = envvar_resolve_conflict(
            "ENVVAR_RESOLVE_VERIFY".into(),
            EnvVarScope::Process,
            EnvVarScope::Process,
        )
        .await
        .expect("conflict resolution should succeed");

        let json = serde_json::to_value(&result).expect("serialize result");
        assert_eq!(json["status"], "verified");
        assert_eq!(json["verified"], true);
        assert_eq!(json["reasonCode"], serde_json::Value::Null);
        assert_eq!(json["recoveryAction"], "conflict_resolve");
        assert_eq!(json["protectionState"], "unprotected");

        env::remove_var("ENVVAR_RESOLVE_VERIFY");
    }

    #[test]
    fn shell_guidance_generates_shell_specific_commands() {
        let guidance = envvar_generate_shell_guidance(
            Some("ENVVAR_GUIDE_KEY".into()),
            Some("guide-value".into()),
            None,
            Some("bash".into()),
            Some(true),
        )
        .expect("guidance generation should succeed");

        assert!(!guidance.is_empty());
        assert!(guidance.iter().any(
            |entry| entry.shell == "bash" && entry.command.contains("export ENVVAR_GUIDE_KEY")
        ));
        assert!(guidance.iter().any(
            |entry| entry.shell == "fish" && entry.command.contains("set -gx ENVVAR_GUIDE_KEY")
        ));
        assert!(guidance
            .iter()
            .any(|entry| entry.shell == "powershell"
                && entry.command.contains("$env:ENVVAR_GUIDE_KEY")));
        assert!(guidance
            .iter()
            .any(|entry| entry.shell == "bash" && entry.auto_applied));
        assert!(guidance.iter().all(|entry| !entry.redacted));
    }

    #[cfg(not(windows))]
    #[test]
    fn support_snapshot_reports_blocked_user_mutation_without_shell_profile() {
        let dir = tempdir().expect("temp dir");
        let home_dir = dir.path().join("home");
        std::fs::create_dir_all(&home_dir).expect("home dir");
        crate::platform::env::configure_env_test_fixture(
            home_dir,
            crate::platform::env::ShellType::Bash,
            dir.path().join("etc-environment"),
        );

        let snapshot = envvar_get_support_snapshot().expect("support snapshot");
        let set_user = snapshot
            .actions
            .iter()
            .find(|item| item.action == "set" && item.scope == Some(EnvVarScope::User))
            .expect("user set support");

        assert_eq!(set_user.state, "blocked");
        assert_eq!(set_user.reason_code, "shell_profile_unavailable");

        crate::platform::env::reset_env_test_overrides();
    }

    #[cfg(not(windows))]
    #[test]
    fn support_snapshot_uses_exact_recovery_action_identity_for_risky_mutations() {
        let dir = tempdir().expect("temp dir");
        let home_dir = dir.path().join("home");
        let bashrc = home_dir.join(".bashrc");
        std::fs::create_dir_all(bashrc.parent().expect("bashrc parent")).expect("home tree");
        std::fs::write(&bashrc, "").expect("bashrc");
        crate::platform::env::configure_env_test_fixture(
            home_dir,
            crate::platform::env::ShellType::Bash,
            dir.path().join("etc-environment"),
        );

        let snapshot = envvar_get_support_snapshot().expect("support snapshot");

        assert!(snapshot
            .actions
            .iter()
            .any(|item| item.action == "persistent_set" && item.scope == Some(EnvVarScope::User)));
        assert!(snapshot
            .actions
            .iter()
            .any(|item| item.action == "import_apply" && item.scope == Some(EnvVarScope::User)));
        assert!(snapshot.actions.iter().any(
            |item| item.action == "path_repair_apply" && item.scope == Some(EnvVarScope::User)
        ));
        assert!(
            snapshot
                .actions
                .iter()
                .any(|item| item.action == "conflict_resolve"
                    && item.scope == Some(EnvVarScope::User))
        );

        crate::platform::env::reset_env_test_overrides();
    }

    #[cfg(not(windows))]
    #[tokio::test]
    async fn user_scope_set_returns_manual_followup_metadata() {
        let dir = tempdir().expect("temp dir");
        let home_dir = dir.path().join("home");
        let bashrc = home_dir.join(".bashrc");
        std::fs::create_dir_all(bashrc.parent().expect("bashrc parent")).expect("home tree");
        std::fs::write(&bashrc, "").expect("bashrc");
        crate::platform::env::configure_env_test_fixture(
            home_dir,
            crate::platform::env::ShellType::Bash,
            dir.path().join("etc-environment"),
        );

        let result = envvar_set_persistent(
            "COGNIA_USER_STATUS".into(),
            "value".into(),
            EnvVarScope::User,
        )
        .await
        .expect("set user persistent");

        assert_eq!(result.status, "manual_followup_required");
        assert!(result.success);
        assert!(!result.verified);
        assert_eq!(result.reason_code.as_deref(), Some("shell_sync_required"));
        assert_eq!(result.recovery_action.as_deref(), Some("persistent_set"));
        assert_eq!(result.protection_state, None);
        assert!(result.snapshot.is_none());

        crate::platform::env::reset_env_test_overrides();
    }

    #[tokio::test]
    async fn apply_import_preview_reports_recovery_contract_fields() {
        let _guard = PROCESS_ENV_TEST_LOCK.lock().await;
        env::remove_var("ENVVAR_IMPORT_CONTRACT");

        let preview = envvar_preview_import_env_file(
            "ENVVAR_IMPORT_CONTRACT=after".into(),
            EnvVarScope::Process,
        )
        .await
        .expect("preview should succeed");

        let result = envvar_apply_import_preview(
            "ENVVAR_IMPORT_CONTRACT=after".into(),
            EnvVarScope::Process,
            preview.fingerprint,
        )
        .await
        .expect("apply import preview should succeed");

        let json = serde_json::to_value(&result).expect("serialize result");
        assert_eq!(json["recoveryAction"], "import_apply");
        assert_eq!(json["protectionState"], "unprotected");
        assert!(json["snapshot"].is_null());

        env::remove_var("ENVVAR_IMPORT_CONTRACT");
    }

    #[tokio::test]
    async fn create_envvar_snapshot_reports_operation_in_progress_when_backup_gate_is_held() {
        let dir = tempdir().expect("temp dir");
        let settings = snapshot_test_settings(dir.path());
        let _gate = crate::core::backup::lock_backup_mutation_gate_for_test().await;

        let result = create_envvar_snapshot_for_settings(
            &settings,
            &[EnvVarScope::User],
            EnvVarSnapshotCreationMode::Manual,
            Some("manual_snapshot"),
            Some("blocked by gate"),
        )
        .await;

        assert!(matches!(result, Err(CogniaError::Config(message)) if message.contains("already running")));
    }

    #[cfg(not(windows))]
    #[tokio::test]
    async fn persistent_set_with_recovery_creates_automatic_snapshot_when_protection_requires_it() {
        let dir = tempdir().expect("temp dir");
        let settings = snapshot_test_settings(dir.path());
        let home_dir = dir.path().join("home");
        let bashrc = home_dir.join(".bashrc");
        std::fs::create_dir_all(bashrc.parent().expect("bashrc parent")).expect("home tree");
        std::fs::write(&bashrc, "").expect("bashrc");
        crate::platform::env::configure_env_test_fixture(
            home_dir,
            crate::platform::env::ShellType::Bash,
            dir.path().join("etc-environment"),
        );

        let result = envvar_set_persistent_for_settings(
            &settings,
            "COGNIA_RECOVERY_CREATE".into(),
            "after".into(),
            EnvVarScope::User,
        )
        .await
        .expect("protected set should succeed");

        assert_eq!(result.action.as_deref(), Some("persistent_set"));
        assert_eq!(result.protection_state.as_deref(), Some("will_create"));
        let snapshot = result
            .snapshot
            .as_ref()
            .expect("automatic snapshot reference");
        assert_eq!(
            snapshot.creation_mode,
            EnvVarSnapshotCreationMode::Automatic
        );
        assert_eq!(snapshot.source_action.as_deref(), Some("persistent_set"));

        let listed = list_envvar_snapshot_bundles(&settings)
            .await
            .expect("list snapshot bundles");
        assert_eq!(listed.len(), 1);
        assert_eq!(listed[0].path, snapshot.path);

        crate::platform::env::reset_env_test_overrides();
    }

    #[cfg(not(windows))]
    #[tokio::test]
    async fn persistent_set_with_recovery_reuses_matching_automatic_snapshot() {
        let dir = tempdir().expect("temp dir");
        let settings = snapshot_test_settings(dir.path());
        let home_dir = dir.path().join("home");
        let bashrc = home_dir.join(".bashrc");
        std::fs::create_dir_all(bashrc.parent().expect("bashrc parent")).expect("home tree");
        std::fs::write(&bashrc, "").expect("bashrc");
        crate::platform::env::configure_env_test_fixture(
            home_dir,
            crate::platform::env::ShellType::Bash,
            dir.path().join("etc-environment"),
        );

        env::set_persistent_var("COGNIA_RECOVERY_REUSE", "before", EnvVarScope::User)
            .await
            .expect("seed user var");
        let payload = capture_envvar_snapshot_payload(&[EnvVarScope::User])
            .await
            .expect("capture current snapshot payload");
        let existing = write_envvar_snapshot_bundle(
            &settings,
            &payload,
            EnvVarSnapshotCreationMode::Automatic,
            Some("persistent_set"),
            Some("existing auto snapshot"),
            None,
        )
        .await
        .expect("create reusable snapshot");

        let result = envvar_set_persistent_for_settings(
            &settings,
            "COGNIA_RECOVERY_REUSE".into(),
            "after".into(),
            EnvVarScope::User,
        )
        .await
        .expect("protected set should succeed");

        assert_eq!(result.action.as_deref(), Some("persistent_set"));
        assert_eq!(result.protection_state.as_deref(), Some("will_reuse"));
        assert_eq!(
            result.snapshot.as_ref().map(|item| item.path.as_str()),
            Some(existing.path.as_str())
        );

        let listed = list_envvar_snapshot_bundles(&settings)
            .await
            .expect("list snapshot bundles");
        assert_eq!(listed.len(), 1);

        crate::platform::env::reset_env_test_overrides();
    }

    #[tokio::test]
    async fn envvar_snapshot_bundle_roundtrip_preserves_manual_metadata() {
        let dir = tempdir().expect("tempdir");
        let settings = snapshot_test_settings(dir.path());
        let payload = sample_snapshot_payload(EnvVarScope::User, "API_TOKEN", "secret");

        let created = write_envvar_snapshot_bundle(
            &settings,
            &payload,
            EnvVarSnapshotCreationMode::Manual,
            Some("import_apply"),
            Some("before risky import"),
            None,
        )
        .await
        .expect("create snapshot bundle");

        let listed = list_envvar_snapshot_bundles(&settings)
            .await
            .expect("list snapshot bundles");

        assert_eq!(listed.len(), 1);
        assert_eq!(listed[0].path, created.path);
        assert_eq!(listed[0].creation_mode, EnvVarSnapshotCreationMode::Manual);
        assert_eq!(listed[0].source_action.as_deref(), Some("import_apply"));
        assert_eq!(listed[0].note.as_deref(), Some("before risky import"));
        assert_eq!(listed[0].scopes, vec![EnvVarScope::User]);
        assert_eq!(listed[0].integrity_state, "valid");
    }

    #[tokio::test]
    async fn envvar_snapshot_cleanup_preserves_manual_recovery_points() {
        let dir = tempdir().expect("tempdir");
        let settings = snapshot_test_settings(dir.path());

        let manual_payload = sample_snapshot_payload(EnvVarScope::User, "KEEP_ME", "1");
        let auto_old_payload = sample_snapshot_payload(EnvVarScope::User, "OLD_AUTO", "1");
        let auto_new_payload = sample_snapshot_payload(EnvVarScope::User, "NEW_AUTO", "1");

        let _manual = write_envvar_snapshot_bundle(
            &settings,
            &manual_payload,
            EnvVarSnapshotCreationMode::Manual,
            Some("set"),
            Some("manual restore point"),
            Some("2026-03-18T00:00:00Z"),
        )
        .await
        .expect("manual snapshot");
        let _old_auto = write_envvar_snapshot_bundle(
            &settings,
            &auto_old_payload,
            EnvVarSnapshotCreationMode::Automatic,
            Some("path_repair_apply"),
            Some("old auto"),
            Some("2026-03-10T00:00:00Z"),
        )
        .await
        .expect("old auto snapshot");
        let _new_auto = write_envvar_snapshot_bundle(
            &settings,
            &auto_new_payload,
            EnvVarSnapshotCreationMode::Automatic,
            Some("path_repair_apply"),
            Some("new auto"),
            Some("2026-03-19T00:00:00Z"),
        )
        .await
        .expect("new auto snapshot");

        let deleted = cleanup_envvar_snapshot_bundles(&settings, 1, 0)
            .await
            .expect("cleanup snapshots");
        assert_eq!(deleted, 1);

        let listed = list_envvar_snapshot_bundles(&settings)
            .await
            .expect("list snapshot bundles");
        assert_eq!(listed.len(), 2);
        assert!(listed
            .iter()
            .any(|item| item.creation_mode == EnvVarSnapshotCreationMode::Manual));
        assert!(listed
            .iter()
            .any(|item| item.note.as_deref() == Some("new auto")));
    }

    #[test]
    fn backup_protection_reuses_matching_automatic_snapshot() {
        let scope_payload = EnvVarSnapshotScopePayload {
            scope: EnvVarScope::User,
            variables: vec![PersistentEnvVar {
                key: "API_TOKEN".to_string(),
                value: "secret".to_string(),
                reg_type: None,
            }],
            path_entries: vec!["/tmp/bin".to_string()],
            variable_fingerprint: "vars:user:token".to_string(),
            path_fingerprint: "path:user:/tmp/bin".to_string(),
            restorable: true,
        };
        let snapshot = EnvVarSnapshotInfo {
            path: "D:/tmp/envvar-snapshot-1".to_string(),
            name: "envvar-snapshot-1".to_string(),
            created_at: "2026-03-19T00:00:00Z".to_string(),
            creation_mode: EnvVarSnapshotCreationMode::Automatic,
            source_action: Some("path_repair_apply".to_string()),
            note: Some("auto".to_string()),
            scopes: vec![EnvVarScope::User],
            integrity_state: "valid".to_string(),
            snapshot: EnvVarSnapshotPayload {
                format_version: 1,
                created_at: "2026-03-19T00:00:00Z".to_string(),
                creation_mode: Some(EnvVarSnapshotCreationMode::Automatic),
                source_action: Some("path_repair_apply".to_string()),
                note: Some("auto".to_string()),
                scopes: vec![scope_payload.clone()],
            },
        };

        let state = build_envvar_backup_protection_state(
            "path_repair_apply",
            EnvVarScope::User,
            &scope_payload,
            &[snapshot],
        );

        assert_eq!(state.state, "will_reuse");
        assert_eq!(state.reason_code, "compatible_snapshot_available");
        assert!(state.snapshot.is_some());
    }

    #[test]
    fn backup_protection_accepts_current_workflow_action_ids() {
        let scope_payload = EnvVarSnapshotScopePayload {
            scope: EnvVarScope::User,
            variables: vec![PersistentEnvVar {
                key: "API_TOKEN".to_string(),
                value: "secret".to_string(),
                reg_type: None,
            }],
            path_entries: vec!["/tmp/bin".to_string()],
            variable_fingerprint: "vars:user:token".to_string(),
            path_fingerprint: "path:user:/tmp/bin".to_string(),
            restorable: true,
        };

        for action in [
            "persistent_set",
            "persistent_remove",
            "path_repair_apply",
            "conflict_resolve",
        ] {
            let state = build_envvar_backup_protection_state(
                action,
                EnvVarScope::User,
                &scope_payload,
                &[],
            );

            assert_eq!(
                state.state, "will_create",
                "action {action} should request protection"
            );
            assert_eq!(state.reason_code, "new_snapshot_required");
        }
    }

    #[test]
    fn support_snapshot_exposes_current_recovery_action_ids() {
        let snapshot = envvar_get_support_snapshot().expect("support snapshot");

        assert!(snapshot
            .actions
            .iter()
            .any(|item| item.action == "persistent_set" && item.scope == Some(EnvVarScope::User)));
        assert!(snapshot
            .actions
            .iter()
            .any(|item| item.action == "persistent_remove" && item.scope == Some(EnvVarScope::User)));
        assert!(snapshot
            .actions
            .iter()
            .any(|item| item.action == "import_apply" && item.scope == Some(EnvVarScope::User)));
        assert!(snapshot.actions.iter().any(
            |item| item.action == "path_repair_apply" && item.scope == Some(EnvVarScope::User)
        ));
        assert!(
            snapshot
                .actions
                .iter()
                .any(|item| item.action == "conflict_resolve"
                    && item.scope == Some(EnvVarScope::User))
        );
    }

    #[test]
    fn blocked_mutation_result_exposes_recovery_metadata() {
        let support = EnvVarActionSupport {
            action: "persistent_remove".to_string(),
            scope: Some(EnvVarScope::User),
            supported: false,
            state: "blocked".to_string(),
            reason_code: "blocked".to_string(),
            reason: "blocked".to_string(),
            next_steps: vec![],
        };

        let result = blocked_mutation_result(
            "persistent_remove",
            "JAVA_HOME",
            EnvVarScope::User,
            &support,
        );

        assert_eq!(result.recovery_action.as_deref(), Some("persistent_remove"));
        assert_eq!(result.protection_state.as_deref(), Some("blocked"));
        assert!(result.snapshot.is_none());
    }

    #[tokio::test]
    async fn restore_envvar_snapshot_reports_operation_in_progress_when_backup_gate_is_held() {
        let dir = tempdir().expect("temp dir");
        let settings = snapshot_test_settings(dir.path());
        let payload = sample_snapshot_payload(EnvVarScope::User, "RESTORE_TOKEN", "before");
        let created = write_envvar_snapshot_bundle(
            &settings,
            &payload,
            EnvVarSnapshotCreationMode::Manual,
            Some("manual_snapshot"),
            Some("before restore"),
            None,
        )
        .await
        .expect("create snapshot bundle");
        let _gate = crate::core::backup::lock_backup_mutation_gate_for_test().await;

        let result =
            restore_envvar_snapshot_for_settings(&settings, &created.path, &[], Some("missing"))
                .await;

        assert!(matches!(result, Err(CogniaError::Config(message)) if message.contains("already running")));
    }

    #[test]
    fn restore_preview_marks_process_scope_as_unsupported() {
        let snapshot = EnvVarSnapshotPayload {
            format_version: 1,
            created_at: "2026-03-19T00:00:00Z".to_string(),
            creation_mode: None,
            source_action: None,
            note: None,
            scopes: vec![EnvVarSnapshotScopePayload {
                scope: EnvVarScope::Process,
                variables: vec![PersistentEnvVar {
                    key: "TMP_ONLY".to_string(),
                    value: "1".to_string(),
                    reg_type: None,
                }],
                path_entries: vec!["/tmp/process".to_string()],
                variable_fingerprint: "vars:process:tmp".to_string(),
                path_fingerprint: "path:process:/tmp/process".to_string(),
                restorable: false,
            }],
        };

        let preview = build_envvar_snapshot_restore_preview(
            "D:/snapshots/process-only",
            &snapshot,
            &[],
            &[EnvVarScope::Process],
        );
        assert_eq!(preview.segments.len(), 1);
        assert_eq!(preview.segments[0].scope, EnvVarScope::Process);
        assert!(preview.segments[0].skipped);
        assert_eq!(
            preview.segments[0].reason_code.as_deref(),
            Some("scope_not_restorable")
        );
    }

    #[tokio::test]
    async fn preview_snapshot_restore_returns_fingerprint_for_selected_scopes() {
        let dir = tempdir().expect("temp dir");
        let settings = snapshot_test_settings(dir.path());
        let payload = sample_snapshot_payload(EnvVarScope::User, "RESTORE_TOKEN", "before");
        let created = write_envvar_snapshot_bundle(
            &settings,
            &payload,
            EnvVarSnapshotCreationMode::Manual,
            Some("manual_snapshot"),
            Some("before restore"),
            None,
        )
        .await
        .expect("create snapshot bundle");

        let preview = preview_envvar_snapshot_for_settings(&settings, &created.path, &[EnvVarScope::User])
            .await
            .expect("preview snapshot restore");

        assert!(!preview.fingerprint.is_empty());
        assert_eq!(preview.segments.len(), 1);
        assert_eq!(preview.segments[0].scope, EnvVarScope::User);
    }

    #[tokio::test]
    async fn restore_snapshot_rejects_stale_preview_fingerprint() {
        let dir = tempdir().expect("temp dir");
        let settings = snapshot_test_settings(dir.path());
        let payload = sample_snapshot_payload(EnvVarScope::User, "RESTORE_TOKEN", "before");
        let created = write_envvar_snapshot_bundle(
            &settings,
            &payload,
            EnvVarSnapshotCreationMode::Manual,
            Some("manual_snapshot"),
            Some("before restore"),
            None,
        )
        .await
        .expect("create snapshot bundle");

        let preview = preview_envvar_snapshot_for_settings(&settings, &created.path, &[EnvVarScope::User])
            .await
            .expect("preview snapshot restore");

        let result = restore_envvar_snapshot_for_settings(
            &settings,
            &created.path,
            &[EnvVarScope::User],
            Some(&format!("{}-stale", preview.fingerprint)),
        )
        .await;

        assert!(
            matches!(result, Err(CogniaError::Conflict(message)) if message.contains("stale_preview"))
        );
    }
}
