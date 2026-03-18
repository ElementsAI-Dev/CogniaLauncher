use std::collections::{HashMap, HashSet};
use std::path::Path;

use serde::{Deserialize, Serialize};

use crate::error::CogniaError;
use crate::platform::env::{
    self, EnvFileFormat, EnvVarScope, EnvVarSensitivityReason, EnvVarValueSummary,
    ShellProfileInfo,
};

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
    pub success: bool,
    pub verified: bool,
    pub status: String,
    pub reason_code: Option<String>,
    pub message: Option<String>,
    pub primary_shell_target: Option<String>,
    pub shell_guidance: Vec<EnvVarShellGuidance>,
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
    pub success: bool,
    pub verified: bool,
    pub status: String,
    pub reason_code: Option<String>,
    pub message: Option<String>,
    pub primary_shell_target: Option<String>,
    pub shell_guidance: Vec<EnvVarShellGuidance>,
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
    pub success: bool,
    pub verified: bool,
    pub status: String,
    pub reason_code: Option<String>,
    pub message: Option<String>,
    pub effective_value_summary: Option<EnvVarValueSummary>,
    pub primary_shell_target: Option<String>,
    pub shell_guidance: Vec<EnvVarShellGuidance>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EnvVarPathMutationResult {
    pub operation: String,
    pub scope: EnvVarScope,
    pub success: bool,
    pub verified: bool,
    pub status: String,
    pub reason_code: Option<String>,
    pub message: Option<String>,
    pub removed_count: usize,
    pub path_entries: Vec<PathEntryInfo>,
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

fn derive_support_snapshot_state(
    actions: &[EnvVarActionSupport],
) -> (String, String, String) {
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
                "The change was persisted, but manual shell follow-up is still required.".to_string(),
            ),
        );
    }

    (
        true,
        true,
        "verified".to_string(),
        None,
        None,
    )
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
        success: false,
        verified: false,
        status: "blocked".to_string(),
        reason_code: Some(support.reason_code.clone()),
        message: Some(support.reason.clone()),
        effective_value_summary: None,
        primary_shell_target: None,
        shell_guidance: Vec::new(),
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
        success: false,
        verified: false,
        status: "blocked".to_string(),
        reason_code: Some(support.reason_code.clone()),
        message: Some(support.reason.clone()),
        removed_count: 0,
        path_entries: Vec::new(),
        primary_shell_target: None,
        shell_guidance: Vec::new(),
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
        build_action_support("remove", Some(EnvVarScope::Process)),
        build_action_support("remove", Some(EnvVarScope::User)),
        build_action_support("remove", Some(EnvVarScope::System)),
        build_action_support("import", Some(EnvVarScope::Process)),
        build_action_support("import", Some(EnvVarScope::User)),
        build_action_support("import", Some(EnvVarScope::System)),
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
        build_action_support("path_repair", Some(EnvVarScope::Process)),
        build_action_support("path_repair", Some(EnvVarScope::User)),
        build_action_support("path_repair", Some(EnvVarScope::System)),
        build_action_support("resolve_conflict", Some(EnvVarScope::User)),
        build_action_support("resolve_conflict", Some(EnvVarScope::System)),
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
        return Ok(blocked_mutation_result("set", &key, EnvVarScope::Process, &support));
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
        success,
        verified: verified_flag,
        status,
        reason_code,
        message,
        effective_value_summary: summary,
        primary_shell_target: None,
        shell_guidance: Vec::new(),
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
    let (verified, summary) = env::verify_envvar_value_state(&key, EnvVarScope::Process, None).await?;
    let (success, verified_flag, status, reason_code, message) =
        mutation_status_from_verification(verified, EnvVarScope::Process, &[]);

    Ok(EnvVarMutationResult {
        operation: "remove".to_string(),
        key,
        scope: EnvVarScope::Process,
        success,
        verified: verified_flag,
        status,
        reason_code,
        message,
        effective_value_summary: summary,
        primary_shell_target: None,
        shell_guidance: Vec::new(),
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
    let support = build_action_support("set", Some(scope));
    if !support.supported {
        return Ok(blocked_mutation_result("set", &key, scope, &support));
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
        operation: "set".to_string(),
        key,
        scope,
        success,
        verified: verified_flag,
        status,
        reason_code,
        message,
        effective_value_summary: summary,
        primary_shell_target,
        shell_guidance,
    })
}

#[tauri::command]
pub async fn envvar_remove_persistent(
    key: String,
    scope: EnvVarScope,
) -> Result<EnvVarMutationResult, CogniaError> {
    let key = env::normalize_env_var_key(&key)?;
    let support = build_action_support("remove", Some(scope));
    if !support.supported {
        return Ok(blocked_mutation_result("remove", &key, scope, &support));
    }

    env::remove_persistent_var(&key, scope).await?;
    let primary_shell_target = primary_shell_target_for_scope(scope);
    let shell_guidance = Vec::new();
    let (verified, summary) = env::verify_envvar_value_state(&key, scope, None).await?;
    let (success, verified_flag, status, reason_code, message) =
        mutation_status_from_verification(verified, scope, &shell_guidance);

    Ok(EnvVarMutationResult {
        operation: "remove".to_string(),
        key,
        scope,
        success,
        verified: verified_flag,
        status,
        reason_code,
        message,
        effective_value_summary: summary,
        primary_shell_target,
        shell_guidance,
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
        success,
        verified: verified_flag,
        status,
        reason_code,
        message,
        removed_count: 0,
        path_entries: summarize_path_entries(actual_entries),
        primary_shell_target: primary_shell_target_for_scope(scope),
        shell_guidance,
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
        success,
        verified: verified_flag,
        status,
        reason_code,
        message,
        removed_count: 0,
        path_entries: summarize_path_entries(actual_entries),
        primary_shell_target: primary_shell_target_for_scope(scope),
        shell_guidance,
    })
}

#[tauri::command]
pub async fn envvar_reorder_path(
    entries: Vec<String>,
    scope: EnvVarScope,
) -> Result<EnvVarPathMutationResult, CogniaError> {
    let support = build_action_support("path_reorder", Some(scope));
    if !support.supported {
        return Ok(blocked_path_mutation_result("path_reorder", scope, &support));
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
        success,
        verified: verified_flag,
        status,
        reason_code,
        message,
        removed_count: 0,
        path_entries: summarize_path_entries(actual_entries),
        primary_shell_target: primary_shell_target_for_scope(scope),
        shell_guidance,
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
            success: false,
            verified: false,
            status: "blocked".to_string(),
            reason_code: Some(support.reason_code),
            message: Some(support.reason),
            primary_shell_target: None,
            shell_guidance: Vec::new(),
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
            success: false,
            verified: false,
            status: "blocked".to_string(),
            reason_code: Some(support.reason_code),
            message: Some(support.reason),
            primary_shell_target: None,
            shell_guidance: Vec::new(),
        });
    }

    let build = build_import_preview_internal(&content, scope).await?;
    ensure_preview_fingerprint(&build.preview.fingerprint, &fingerprint)?;

    let mut imported = 0usize;
    let mut skipped = 0usize;
    let mut errors = Vec::new();

    for item in &build.apply_items {
        match item.action.as_str() {
            "add" | "update" => match env::set_persistent_var(&item.key, &item.raw_value, scope).await {
                Ok(()) => imported += 1,
                Err(error) => {
                    skipped += 1;
                    errors.push(format_import_error(&item.key, &error));
                }
            },
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
        success: true,
        verified: true,
        status: "verified".to_string(),
        reason_code: None,
        message: None,
        primary_shell_target: build.preview.primary_shell_target,
        shell_guidance: build.preview.shell_guidance,
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
    let support = build_action_support("resolve_conflict", Some(target_scope));
    if !support.supported {
        return Ok(EnvVarConflictResolutionResult {
            key,
            source_scope,
            target_scope,
            applied_value: String::new(),
            applied_value_summary: env::summarize_env_value("UNAVAILABLE", ""),
            success: false,
            verified: false,
            status: "blocked".to_string(),
            reason_code: Some(support.reason_code),
            message: Some(support.reason),
            primary_shell_target: None,
            shell_guidance: Vec::new(),
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
        success: true,
        verified: true,
        status: "verified".to_string(),
        reason_code: None,
        message: None,
        primary_shell_target,
        shell_guidance,
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
    let support = build_action_support("path_repair", Some(scope));
    if !support.supported {
        return Ok(blocked_path_mutation_result("path_repair", scope, &support));
    }

    let preview = build_path_repair_preview(scope).await?;
    ensure_preview_fingerprint(&preview.fingerprint, &fingerprint)?;

    if preview.current_entries != preview.repaired_entries {
        env::set_persistent_path(&preview.repaired_entries, scope).await?;
    }

    Ok(EnvVarPathMutationResult {
        operation: "path_repair".to_string(),
        scope,
        success: true,
        verified: true,
        status: "verified".to_string(),
        reason_code: None,
        message: None,
        removed_count: preview.removed_count,
        path_entries: summarize_path_entries(preview.repaired_entries),
        primary_shell_target: preview.primary_shell_target,
        shell_guidance: preview.shell_guidance,
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

async fn build_path_repair_preview(scope: EnvVarScope) -> Result<EnvVarPathRepairPreview, CogniaError> {
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
            env::render_shell_path_command(&profile.shell, entries).map(|command| EnvVarShellGuidance {
                shell: profile.shell.clone(),
                config_path: profile.config_path,
                command,
                auto_applied: auto_applied_shell == Some(profile.shell.as_str()),
                contains_sensitive_value: false,
                redacted: false,
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

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

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
        env::set_var("COGNIA_MASKED_TOKEN", "ghp_super_secret_token");
        env::set_var("COGNIA_VISIBLE_MODE", "development");

        let summaries = envvar_list_process_summaries()
            .expect("list summaries should succeed");

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

        assert!(matches!(result, Err(CogniaError::Conflict(message)) if message.contains("stale_preview")));

        env::remove_var("ENVVAR_STALE_IMPORT");
    }

    #[tokio::test]
    async fn apply_import_preview_returns_verification_metadata() {
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

        env::set_persistent_path(&["__COGNIA_PATH_STALE_B__".to_string()], EnvVarScope::Process)
            .await
            .expect("mutate PATH after preview");

        let result = envvar_apply_path_repair(EnvVarScope::Process, preview.fingerprint).await;
        assert!(matches!(result, Err(CogniaError::Conflict(message)) if message.contains("stale_preview")));

        env::set_persistent_path(&original, EnvVarScope::Process)
            .await
            .expect("restore PATH");
    }

    #[tokio::test]
    async fn resolve_conflict_copies_source_value_to_target_scope() {
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
        assert!(guidance.iter().any(|entry| entry.shell == "bash" && entry.command.contains("export ENVVAR_GUIDE_KEY")));
        assert!(guidance.iter().any(|entry| entry.shell == "fish" && entry.command.contains("set -gx ENVVAR_GUIDE_KEY")));
        assert!(guidance.iter().any(|entry| entry.shell == "powershell" && entry.command.contains("$env:ENVVAR_GUIDE_KEY")));
        assert!(guidance.iter().any(|entry| entry.shell == "bash" && entry.auto_applied));
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

        crate::platform::env::reset_env_test_overrides();
    }
}
