#[cfg(not(test))]
use cognia_plugin_sdk::prelude::*;
#[cfg(not(test))]
use extism_pdk::plugin_fn;
use serde::{Deserialize, Serialize};
#[cfg(test)]
use std::collections::HashMap;

const PROFILE_DIR: &str = "profiles";
const ACTIVE_PROFILE_KEY: &str = "active_profile_id";

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct AssistantInput {
    action: String,
    profile_id: Option<String>,
    content: Option<String>,
    #[serde(default)]
    set_active: Option<bool>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct AssistantSuccess {
    ok: bool,
    action: String,
    profile_id: Option<String>,
    profiles: Option<Vec<String>>,
    content: Option<String>,
    active_profile_id: Option<String>,
    message: String,
    recommendations: Vec<String>,
}

#[cfg(not(test))]
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct AssistantFailure {
    ok: bool,
    error_code: String,
    message: String,
    recommendations: Vec<String>,
}

#[derive(Debug)]
struct PluginError {
    code: &'static str,
    message: String,
    #[cfg_attr(test, allow(dead_code))]
    recommendations: Vec<String>,
}

impl PluginError {
    fn new(code: &'static str, message: impl Into<String>, recommendations: Vec<String>) -> Self {
        Self {
            code,
            message: message.into(),
            recommendations,
        }
    }
}

trait RuntimeOps {
    fn fs_mkdir(&mut self, path: &str) -> Result<(), String>;
    fn fs_list_dir(&self, path: &str) -> Result<Vec<String>, String>;
    fn fs_exists(&self, path: &str) -> Result<(bool, bool), String>;
    fn fs_read(&self, path: &str) -> Result<String, String>;
    fn fs_write(&mut self, path: &str, content: &str) -> Result<(), String>;
    fn fs_delete(&mut self, path: &str) -> Result<(), String>;
    fn config_get(&self, key: &str) -> Result<Option<String>, String>;
    fn config_set(&mut self, key: &str, value: &str) -> Result<(), String>;
}

#[cfg(not(test))]
struct HostRuntime;

#[cfg(not(test))]
impl RuntimeOps for HostRuntime {
    fn fs_mkdir(&mut self, path: &str) -> Result<(), String> {
        cognia_plugin_sdk::cognia::fs::mkdir(path).map_err(|e| e.to_string())
    }

    fn fs_list_dir(&self, path: &str) -> Result<Vec<String>, String> {
        cognia_plugin_sdk::cognia::fs::list_dir(path)
            .map(|items| items.into_iter().map(|item| item.name).collect())
            .map_err(|e| e.to_string())
    }

    fn fs_exists(&self, path: &str) -> Result<(bool, bool), String> {
        cognia_plugin_sdk::cognia::fs::exists(path)
            .map(|result| (result.exists, result.is_dir))
            .map_err(|e| e.to_string())
    }

    fn fs_read(&self, path: &str) -> Result<String, String> {
        cognia_plugin_sdk::cognia::fs::read(path).map_err(|e| e.to_string())
    }

    fn fs_write(&mut self, path: &str, content: &str) -> Result<(), String> {
        cognia_plugin_sdk::cognia::fs::write(path, content).map_err(|e| e.to_string())
    }

    fn fs_delete(&mut self, path: &str) -> Result<(), String> {
        cognia_plugin_sdk::cognia::fs::delete(path).map_err(|e| e.to_string())
    }

    fn config_get(&self, key: &str) -> Result<Option<String>, String> {
        cognia_plugin_sdk::cognia::config::get(key).map_err(|e| e.to_string())
    }

    fn config_set(&mut self, key: &str, value: &str) -> Result<(), String> {
        cognia_plugin_sdk::cognia::config::set(key, value).map_err(|e| e.to_string())
    }
}

#[cfg(not(test))]
fn execute_file_config_assistant(raw: String) -> FnResult<String> {
    let mut runtime = HostRuntime;
    let output = match run_with_runtime(&raw, &mut runtime) {
        Ok(success) => serde_json::to_string(&success).unwrap_or_else(|_| {
            r#"{"ok":false,"errorCode":"SERIALIZE_ERROR","message":"Failed to serialize success payload.","recommendations":["Retry with smaller payload."]}"#.to_string()
        }),
        Err(error) => {
            let failure = AssistantFailure {
                ok: false,
                error_code: error.code.to_string(),
                message: error.message,
                recommendations: error.recommendations,
            };
            serde_json::to_string(&failure).unwrap_or_else(|_| {
                r#"{"ok":false,"errorCode":"SERIALIZE_ERROR","message":"Failed to serialize error payload.","recommendations":["Retry operation."]}"#.to_string()
            })
        }
    };

    Ok(output)
}

#[cfg(not(test))]
#[plugin_fn]
pub fn file_config_assistant(input: String) -> FnResult<String> {
    execute_file_config_assistant(input)
}

fn run_with_runtime(raw: &str, runtime: &mut dyn RuntimeOps) -> Result<AssistantSuccess, PluginError> {
    let input = parse_input(raw)?;
    match input.action.as_str() {
        "list_profiles" => list_profiles(runtime),
        "read_profile" => read_profile(runtime, input.profile_id),
        "write_profile" => write_profile(runtime, input.profile_id, input.content, input.set_active.unwrap_or(false)),
        "delete_profile" => delete_profile(runtime, input.profile_id),
        "set_active_profile" => set_active_profile(runtime, input.profile_id),
        "get_active_profile" => get_active_profile(runtime),
        _ => Err(PluginError::new(
            "UNSUPPORTED_ACTION",
            format!("Unsupported action: {}", input.action),
            vec![
                "Use one of list_profiles/read_profile/write_profile/delete_profile/set_active_profile/get_active_profile.".to_string(),
            ],
        )),
    }
}

fn parse_input(raw: &str) -> Result<AssistantInput, PluginError> {
    if raw.trim().is_empty() {
        return Ok(AssistantInput {
            action: "list_profiles".to_string(),
            profile_id: None,
            content: None,
            set_active: None,
        });
    }

    let parsed: AssistantInput = serde_json::from_str(raw).map_err(|_| {
        PluginError::new(
            "INVALID_INPUT",
            "Input must be JSON with an action field.",
            vec![
                "Provide JSON like {\"action\":\"list_profiles\"}.".to_string(),
                "For write_profile include profileId and content.".to_string(),
            ],
        )
    })?;

    if parsed.action.trim().is_empty() {
        return Err(PluginError::new(
            "INVALID_INPUT",
            "action cannot be empty.",
            vec!["Set action to a supported operation.".to_string()],
        ));
    }

    Ok(parsed)
}

fn list_profiles(runtime: &mut dyn RuntimeOps) -> Result<AssistantSuccess, PluginError> {
    ensure_profile_dir(runtime)?;
    let mut profiles = runtime
        .fs_list_dir(PROFILE_DIR)
        .map_err(|e| host_error("Failed to list profiles.", e))?
        .into_iter()
        .filter(|name| name.ends_with(".json"))
        .map(|name| name.trim_end_matches(".json").to_string())
        .collect::<Vec<_>>();
    profiles.sort();

    let active_profile_id = normalize_optional(runtime.config_get(ACTIVE_PROFILE_KEY).map_err(|e| {
        host_error("Failed to read active profile pointer.", e)
    })?);

    Ok(AssistantSuccess {
        ok: true,
        action: "list_profiles".to_string(),
        profile_id: None,
        profiles: Some(profiles),
        content: None,
        active_profile_id,
        message: "Profile listing completed.".to_string(),
        recommendations: vec![
            "Use write_profile to create or update profile content.".to_string(),
            "Use set_active_profile to update active pointer after verification.".to_string(),
        ],
    })
}

fn read_profile(runtime: &mut dyn RuntimeOps, profile_id: Option<String>) -> Result<AssistantSuccess, PluginError> {
    let profile_id = require_profile_id(profile_id)?;
    let profile_path = profile_path(&profile_id);
    ensure_profile_exists(runtime, &profile_id, &profile_path)?;

    let content = runtime
        .fs_read(&profile_path)
        .map_err(|e| host_error("Failed to read profile content.", e))?;
    let active_profile_id = normalize_optional(runtime.config_get(ACTIVE_PROFILE_KEY).map_err(|e| {
        host_error("Failed to read active profile pointer.", e)
    })?);

    Ok(AssistantSuccess {
        ok: true,
        action: "read_profile".to_string(),
        profile_id: Some(profile_id),
        profiles: None,
        content: Some(content),
        active_profile_id,
        message: "Profile read completed.".to_string(),
        recommendations: vec![
            "Validate profile schema before using it in automation chains.".to_string(),
        ],
    })
}

fn write_profile(
    runtime: &mut dyn RuntimeOps,
    profile_id: Option<String>,
    content: Option<String>,
    set_active: bool,
) -> Result<AssistantSuccess, PluginError> {
    let profile_id = require_profile_id(profile_id)?;
    let content = content.unwrap_or_default();
    ensure_profile_dir(runtime)?;

    runtime
        .fs_write(&profile_path(&profile_id), &content)
        .map_err(|e| host_error("Failed to write profile content.", e))?;

    if set_active {
        runtime
            .config_set(ACTIVE_PROFILE_KEY, &profile_id)
            .map_err(|e| host_error("Failed to update active profile pointer.", e))?;
    }

    Ok(AssistantSuccess {
        ok: true,
        action: "write_profile".to_string(),
        profile_id: Some(profile_id.clone()),
        profiles: None,
        content: None,
        active_profile_id: if set_active { Some(profile_id) } else { None },
        message: "Profile write completed.".to_string(),
        recommendations: vec![
            "Use read_profile to verify persisted content.".to_string(),
            "Use list_profiles to inspect the full profile inventory.".to_string(),
        ],
    })
}

fn delete_profile(runtime: &mut dyn RuntimeOps, profile_id: Option<String>) -> Result<AssistantSuccess, PluginError> {
    let profile_id = require_profile_id(profile_id)?;
    let profile_path = profile_path(&profile_id);
    ensure_profile_exists(runtime, &profile_id, &profile_path)?;

    runtime
        .fs_delete(&profile_path)
        .map_err(|e| host_error("Failed to delete profile file.", e))?;

    let active_profile_id = normalize_optional(runtime.config_get(ACTIVE_PROFILE_KEY).map_err(|e| {
        host_error("Failed to read active profile pointer.", e)
    })?);

    if active_profile_id.as_deref() == Some(profile_id.as_str()) {
        runtime
            .config_set(ACTIVE_PROFILE_KEY, "")
            .map_err(|e| host_error("Failed to clear active profile pointer.", e))?;
    }

    Ok(AssistantSuccess {
        ok: true,
        action: "delete_profile".to_string(),
        profile_id: Some(profile_id),
        profiles: None,
        content: None,
        active_profile_id: normalize_optional(runtime.config_get(ACTIVE_PROFILE_KEY).map_err(|e| {
            host_error("Failed to read active profile pointer.", e)
        })?),
        message: "Profile delete completed.".to_string(),
        recommendations: vec![
            "Use set_active_profile to point to another profile if needed.".to_string(),
        ],
    })
}

fn set_active_profile(runtime: &mut dyn RuntimeOps, profile_id: Option<String>) -> Result<AssistantSuccess, PluginError> {
    let profile_id = require_profile_id(profile_id)?;
    let profile_path = profile_path(&profile_id);
    ensure_profile_exists(runtime, &profile_id, &profile_path)?;

    runtime
        .config_set(ACTIVE_PROFILE_KEY, &profile_id)
        .map_err(|e| host_error("Failed to set active profile.", e))?;

    Ok(AssistantSuccess {
        ok: true,
        action: "set_active_profile".to_string(),
        profile_id: Some(profile_id.clone()),
        profiles: None,
        content: None,
        active_profile_id: Some(profile_id),
        message: "Active profile updated.".to_string(),
        recommendations: vec![
            "Use get_active_profile to verify pointer state.".to_string(),
        ],
    })
}

fn get_active_profile(runtime: &mut dyn RuntimeOps) -> Result<AssistantSuccess, PluginError> {
    let active_profile_id = normalize_optional(runtime.config_get(ACTIVE_PROFILE_KEY).map_err(|e| {
        host_error("Failed to read active profile.", e)
    })?);

    Ok(AssistantSuccess {
        ok: true,
        action: "get_active_profile".to_string(),
        profile_id: None,
        profiles: None,
        content: None,
        active_profile_id,
        message: "Active profile query completed.".to_string(),
        recommendations: vec![
            "Use set_active_profile to change pointer after validation.".to_string(),
        ],
    })
}

fn ensure_profile_dir(runtime: &mut dyn RuntimeOps) -> Result<(), PluginError> {
    let (exists, is_dir) = runtime
        .fs_exists(PROFILE_DIR)
        .map_err(|e| host_error("Failed to inspect profile directory.", e))?;
    if exists && is_dir {
        return Ok(());
    }

    runtime
        .fs_mkdir(PROFILE_DIR)
        .map_err(|e| host_error("Failed to create profile directory.", e))
}

fn ensure_profile_exists(
    runtime: &mut dyn RuntimeOps,
    profile_id: &str,
    path: &str,
) -> Result<(), PluginError> {
    let (exists, _) = runtime
        .fs_exists(path)
        .map_err(|e| host_error("Failed to inspect profile file.", e))?;
    if exists {
        return Ok(());
    }

    Err(PluginError::new(
        "PROFILE_NOT_FOUND",
        format!("Profile '{}' was not found.", profile_id),
        vec![
            "Use write_profile to create the profile before reading or activating it.".to_string(),
        ],
    ))
}

fn require_profile_id(profile_id: Option<String>) -> Result<String, PluginError> {
    let candidate = profile_id
        .map(|v| v.trim().to_string())
        .filter(|v| !v.is_empty())
        .ok_or_else(|| {
            PluginError::new(
                "INVALID_PROFILE_ID",
                "profileId is required for this action.",
                vec!["Provide profileId with letters, numbers, '-', '_', or '.'.".to_string()],
            )
        })?;

    validate_profile_id(&candidate)?;
    Ok(candidate)
}

fn validate_profile_id(profile_id: &str) -> Result<(), PluginError> {
    if profile_id
        .chars()
        .all(|ch| ch.is_ascii_alphanumeric() || ch == '-' || ch == '_' || ch == '.')
    {
        return Ok(());
    }

    Err(PluginError::new(
        "INVALID_PROFILE_ID",
        "profileId contains unsupported characters.",
        vec![
            "Use only letters, numbers, '-', '_', and '.'.".to_string(),
        ],
    ))
}

fn profile_path(profile_id: &str) -> String {
    format!("{}/{}.json", PROFILE_DIR, profile_id)
}

fn normalize_optional(value: Option<String>) -> Option<String> {
    value.and_then(|v| {
        let trimmed = v.trim();
        if trimmed.is_empty() {
            None
        } else {
            Some(trimmed.to_string())
        }
    })
}

fn host_error(prefix: &str, error: String) -> PluginError {
    PluginError::new(
        "HOST_CALL_FAILED",
        format!("{} {}", prefix, error),
        vec![
            "Verify plugin permissions and host runtime readiness, then retry.".to_string(),
        ],
    )
}

#[cfg(test)]
#[derive(Default)]
struct MockRuntime {
    files: HashMap<String, String>,
    dirs: HashMap<String, bool>,
    config: HashMap<String, String>,
}

#[cfg(test)]
impl RuntimeOps for MockRuntime {
    fn fs_mkdir(&mut self, path: &str) -> Result<(), String> {
        self.dirs.insert(path.to_string(), true);
        Ok(())
    }

    fn fs_list_dir(&self, path: &str) -> Result<Vec<String>, String> {
        if !self.dirs.contains_key(path) {
            return Ok(vec![]);
        }
        let prefix = format!("{}/", path);
        let mut names = vec![];
        for key in self.files.keys() {
            if let Some(rest) = key.strip_prefix(&prefix) {
                names.push(rest.to_string());
            }
        }
        Ok(names)
    }

    fn fs_exists(&self, path: &str) -> Result<(bool, bool), String> {
        if self.dirs.contains_key(path) {
            return Ok((true, true));
        }
        if self.files.contains_key(path) {
            return Ok((true, false));
        }
        Ok((false, false))
    }

    fn fs_read(&self, path: &str) -> Result<String, String> {
        self.files
            .get(path)
            .cloned()
            .ok_or_else(|| format!("missing file: {}", path))
    }

    fn fs_write(&mut self, path: &str, content: &str) -> Result<(), String> {
        self.files.insert(path.to_string(), content.to_string());
        Ok(())
    }

    fn fs_delete(&mut self, path: &str) -> Result<(), String> {
        self.files.remove(path);
        Ok(())
    }

    fn config_get(&self, key: &str) -> Result<Option<String>, String> {
        Ok(self.config.get(key).cloned())
    }

    fn config_set(&mut self, key: &str, value: &str) -> Result<(), String> {
        self.config.insert(key.to_string(), value.to_string());
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn write_profile_sets_active_pointer_when_requested() {
        let mut runtime = MockRuntime::default();
        let raw = r#"{"action":"write_profile","profileId":"default","content":"{\"region\":\"us\"}","setActive":true}"#;

        let result = run_with_runtime(raw, &mut runtime).expect("expected success");
        assert!(result.ok);
        assert_eq!(result.action, "write_profile");
        assert_eq!(runtime.config.get(ACTIVE_PROFILE_KEY).map(String::as_str), Some("default"));
        assert_eq!(
            runtime.files.get("profiles/default.json").map(String::as_str),
            Some("{\"region\":\"us\"}"),
        );
    }

    #[test]
    fn read_profile_returns_not_found_error_for_missing_profile() {
        let mut runtime = MockRuntime::default();
        runtime.dirs.insert(PROFILE_DIR.to_string(), true);

        let raw = r#"{"action":"read_profile","profileId":"missing"}"#;
        let err = run_with_runtime(raw, &mut runtime).expect_err("expected failure");

        assert_eq!(err.code, "PROFILE_NOT_FOUND");
        assert!(err.message.contains("missing"));
    }
}
