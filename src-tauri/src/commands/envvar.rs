use std::collections::HashMap;
use std::path::Path;

use serde::{Deserialize, Serialize};

use crate::error::{CogniaError, CogniaResult};
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
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EnvVarImportResult {
    pub imported: usize,
    pub skipped: usize,
    pub errors: Vec<String>,
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
    Ok(env::get_var(&key))
}

#[tauri::command]
pub fn envvar_set_process(key: String, value: String) -> Result<(), CogniaError> {
    env::set_var(&key, &value);
    Ok(())
}

#[tauri::command]
pub fn envvar_remove_process(key: String) -> Result<(), CogniaError> {
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
    validate_env_key(&key)?;
    env::set_persistent_var(&key, &value, scope).await
}

#[tauri::command]
pub async fn envvar_remove_persistent(key: String, scope: EnvVarScope) -> Result<(), CogniaError> {
    env::remove_persistent_var(&key, scope).await
}

#[tauri::command]
pub async fn envvar_get_path(scope: EnvVarScope) -> Result<Vec<PathEntryInfo>, CogniaError> {
    let entries = env::get_persistent_path(scope).await?;
    let result: Vec<PathEntryInfo> = entries
        .into_iter()
        .map(|path_str| {
            let p = Path::new(&path_str);
            PathEntryInfo {
                exists: p.exists(),
                is_directory: p.is_dir(),
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

    for (key, value) in parsed {
        if key.is_empty() {
            skipped += 1;
            continue;
        }
        match scope {
            EnvVarScope::Process => {
                env::set_var(&key, &value);
                imported += 1;
            }
            _ => match env::set_persistent_var(&key, &value, scope).await {
                Ok(()) => imported += 1,
                Err(e) => errors.push(format!("{}: {}", key, e)),
            },
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
        _ => {
            // For User/System, we can only reliably export what we can read.
            // Fall back to process vars as the best approximation.
            let mut v: Vec<(String, String)> = env::get_all_vars().into_iter().collect();
            v.sort_by(|a, b| a.0.cmp(&b.0));
            v
        }
    };

    Ok(env::generate_env_file(&vars, format))
}

// ============================================================================
// Helpers
// ============================================================================

fn validate_env_key(key: &str) -> CogniaResult<()> {
    if key.is_empty() {
        return Err(CogniaError::Config(
            "Environment variable key cannot be empty".into(),
        ));
    }
    if key.contains('=') || key.contains('\0') {
        return Err(CogniaError::Config(
            "Environment variable key contains invalid characters".into(),
        ));
    }
    Ok(())
}
