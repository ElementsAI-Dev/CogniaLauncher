use std::collections::{HashMap, HashSet};
use std::path::Path;

use serde::{Deserialize, Serialize};

use crate::error::CogniaError;
use crate::platform::env::{self, EnvFileFormat, EnvVarScope, ShellProfileInfo};

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

// ============================================================================
// Commands
// ============================================================================

#[tauri::command]
pub fn envvar_list_all() -> Result<HashMap<String, String>, CogniaError> {
    Ok(env::get_all_vars())
}

#[tauri::command]
pub fn envvar_get(key: String) -> Result<Option<String>, CogniaError> {
    let key = env::normalize_env_var_key(&key)?;
    Ok(env::get_var(&key))
}

#[tauri::command]
pub fn envvar_set_process(key: String, value: String) -> Result<(), CogniaError> {
    let key = env::normalize_env_var_key(&key)?;
    env::set_var(&key, &value);
    Ok(())
}

#[tauri::command]
pub fn envvar_remove_process(key: String) -> Result<(), CogniaError> {
    let key = env::normalize_env_var_key(&key)?;
    env::remove_var(&key);
    Ok(())
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
) -> Result<(), CogniaError> {
    env::set_persistent_var(&key, &value, scope).await
}

#[tauri::command]
pub async fn envvar_remove_persistent(key: String, scope: EnvVarScope) -> Result<(), CogniaError> {
    env::remove_persistent_var(&key, scope).await
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
) -> Result<(), CogniaError> {
    let mut entries = env::get_persistent_path(scope).await?;

    // Avoid duplicates
    if entries.iter().any(|e| e == &path) {
        return Ok(());
    }

    match position {
        Some(pos) if pos < entries.len() => entries.insert(pos, path),
        _ => entries.push(path),
    }

    env::set_persistent_path(&entries, scope).await
}

#[tauri::command]
pub async fn envvar_remove_path_entry(path: String, scope: EnvVarScope) -> Result<(), CogniaError> {
    let entries: Vec<String> = env::get_persistent_path(scope)
        .await?
        .into_iter()
        .filter(|e| e != &path)
        .collect();
    env::set_persistent_path(&entries, scope).await
}

#[tauri::command]
pub async fn envvar_reorder_path(
    entries: Vec<String>,
    scope: EnvVarScope,
) -> Result<(), CogniaError> {
    env::set_persistent_path(&entries, scope).await
}

#[tauri::command]
pub fn envvar_list_shell_profiles() -> Result<Vec<ShellProfileInfo>, CogniaError> {
    Ok(env::list_shell_profiles())
}

#[tauri::command]
pub fn envvar_read_shell_profile(path: String) -> Result<String, CogniaError> {
    env::read_shell_profile(&path)
}

#[tauri::command]
pub async fn envvar_import_env_file(
    content: String,
    scope: EnvVarScope,
) -> Result<EnvVarImportResult, CogniaError> {
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
    })
}

#[tauri::command]
pub async fn envvar_export_env_file(
    scope: EnvVarScope,
    format: EnvFileFormat,
) -> Result<String, CogniaError> {
    let vars: Vec<(String, String)> = match scope {
        EnvVarScope::Process => {
            let mut v: Vec<(String, String)> = env::get_all_vars().into_iter().collect();
            v.sort_by(|a, b| a.0.cmp(&b.0));
            v
        }
        _ => env::list_persistent_vars(scope).await?,
    };

    Ok(env::generate_env_file(&vars, format))
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
pub fn envvar_expand(path: String) -> Result<String, CogniaError> {
    Ok(env::expand_path(&path))
}

#[tauri::command]
pub async fn envvar_deduplicate_path(scope: EnvVarScope) -> Result<usize, CogniaError> {
    let entries = env::get_persistent_path(scope).await?;
    let original_count = entries.len();
    let mut seen = HashSet::new();
    let deduped: Vec<String> = entries
        .into_iter()
        .filter(|e| {
            let key = if cfg!(windows) {
                e.to_lowercase()
            } else {
                e.clone()
            };
            seen.insert(key)
        })
        .collect();
    let removed = original_count - deduped.len();
    if removed > 0 {
        env::set_persistent_path(&deduped, scope).await?;
    }
    Ok(removed)
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

        assert_eq!(removed_first, 1);
        assert_eq!(removed_second, 0);

        env::set_persistent_path(&original, EnvVarScope::Process)
            .await
            .expect("restore PATH");
    }
}
