#[cfg(not(test))]
use cognia_plugin_sdk::prelude::*;
#[cfg(not(test))]
use extism_pdk::plugin_fn;
use serde::{Deserialize, Serialize};
#[cfg(test)]
use std::collections::HashMap;

const PROFILE_DIR: &str = "profiles";
const ACTIVE_PROFILE_KEY: &str = "active_profile_id";

#[derive(Debug, Deserialize, Serialize)]
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

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct GuidedCapabilityDegradation {
    capability: &'static str,
    message: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct GuidedStreamEntry {
    level: &'static str,
    message: String,
}

#[derive(Debug)]
struct GuidedExecution {
    success: AssistantSuccess,
    degraded_capabilities: Vec<GuidedCapabilityDegradation>,
    stream: Vec<GuidedStreamEntry>,
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

#[cfg(not(test))]
#[plugin_fn]
pub fn file_config_assistant_guided(input: String) -> FnResult<String> {
    let mut runtime = HostRuntime;
    Ok(render_guided_with_runtime(&input, &mut runtime).to_string())
}

fn render_guided_with_runtime(raw: &str, runtime: &mut dyn RuntimeOps) -> serde_json::Value {
    let action = parse_guided_action(raw);

    if is_reset_action(action.as_ref()) {
        let input = parse_input("").expect("default guided input");
        return build_guided_response(
            &input,
            None,
            Some(("info", "Guided file workflow ready", "Choose an action and run the workflow.")),
            vec![GuidedStreamEntry {
                level: "info",
                message: "Waiting for guided file configuration input.".to_string(),
            }],
            None,
        );
    }

    let input = match resolve_guided_input(action.as_ref()) {
        Ok(input) => input,
        Err(error) => {
            let fallback_input = parse_input("").expect("default guided input");
            return build_guided_response(
                &fallback_input,
                None,
                Some(("error", "File configuration workflow blocked", error.message.as_str())),
                vec![GuidedStreamEntry {
                    level: "error",
                    message: error.message.clone(),
                }],
                Some((&error.code, &error.recommendations)),
            );
        }
    };

    if action.is_none() || (!is_form_submit(action.as_ref()) && !is_rerun_action(action.as_ref())) {
        return build_guided_response(
            &input,
            None,
            Some(("info", "Guided file workflow ready", "Choose an action and run the workflow.")),
            vec![GuidedStreamEntry {
                level: "info",
                message: "Waiting for guided file configuration input.".to_string(),
            }],
            None,
        );
    }

    match run_guided_action_with_runtime(&input, runtime) {
        Ok(execution) => {
            let status = if execution.degraded_capabilities.is_empty() {
                "success"
            } else {
                "warning"
            };
            build_guided_response(
                &input,
                Some(&execution),
                Some((status, "File Config Assistant", execution.success.message.as_str())),
                execution.stream.clone(),
                None,
            )
        }
        Err(error) => build_guided_response(
            &input,
            None,
            Some(("error", "File configuration workflow blocked", error.message.as_str())),
            vec![GuidedStreamEntry {
                level: "error",
                message: error.message.clone(),
            }],
            Some((&error.code, &error.recommendations)),
        ),
    }
}

fn parse_guided_action(raw: &str) -> Option<serde_json::Value> {
    if raw.trim().is_empty() {
        return None;
    }

    let parsed: serde_json::Value = serde_json::from_str(raw).ok()?;
    if parsed.get("action").and_then(serde_json::Value::as_str).is_some() {
        Some(parsed)
    } else {
        None
    }
}

fn resolve_guided_input(action: Option<&serde_json::Value>) -> Result<AssistantInput, PluginError> {
    let Some(action) = action else {
        return parse_input("");
    };

    if is_rerun_action(Some(action)) {
        return match action.get("state").and_then(|state| state.get("lastInput")) {
            Some(value) => parse_assistant_input_from_value(value),
            None => parse_input(""),
        };
    }

    if is_form_submit(Some(action)) {
        return match action.get("formData") {
            Some(value) => parse_assistant_input_from_value(value),
            None => parse_input(""),
        };
    }

    parse_input("")
}

fn parse_assistant_input_from_value(value: &serde_json::Value) -> Result<AssistantInput, PluginError> {
    let raw = serde_json::to_string(value).map_err(|error| {
        PluginError::new(
            "INVALID_INPUT",
            format!("Failed to serialize guided input: {}", error),
            vec!["Retry the workflow with a valid form payload.".to_string()],
        )
    })?;
    parse_input(&raw)
}

fn is_form_submit(action: Option<&serde_json::Value>) -> bool {
    action
        .and_then(|value| value.get("action"))
        .and_then(serde_json::Value::as_str)
        == Some("form_submit")
}

fn is_rerun_action(action: Option<&serde_json::Value>) -> bool {
    action
        .and_then(|value| value.get("action"))
        .and_then(serde_json::Value::as_str)
        == Some("button_click")
        && action
            .and_then(|value| value.get("buttonId"))
            .and_then(serde_json::Value::as_str)
            == Some("rerun-last-file-config-action")
}

fn is_reset_action(action: Option<&serde_json::Value>) -> bool {
    action
        .and_then(|value| value.get("action"))
        .and_then(serde_json::Value::as_str)
        == Some("button_click")
        && action
            .and_then(|value| value.get("buttonId"))
            .and_then(serde_json::Value::as_str)
            == Some("reset-file-config-action")
}

fn build_guided_response(
    input: &AssistantInput,
    execution: Option<&GuidedExecution>,
    summary: Option<(&str, &str, &str)>,
    stream: Vec<GuidedStreamEntry>,
    failure_details: Option<(&str, &Vec<String>)>,
) -> serde_json::Value {
    let mut ui = vec![
        serde_json::json!({
            "type": "heading",
            "content": "File Config Assistant Workflow",
            "level": 1
        }),
        serde_json::json!({
            "type": "text",
            "content": "Run profile file actions with guided defaults, structured outputs, and staged recovery hints.",
            "variant": "muted"
        }),
        build_guided_form(input),
    ];

    if let Some((code, recommendations)) = failure_details {
        ui.push(serde_json::json!({
            "type": "alert",
            "title": "Workflow blocked",
            "message": format!("{}: {}", code, recommendations.join(" ")),
            "variant": "destructive"
        }));
    }

    if let Some(execution) = execution {
        if !execution.degraded_capabilities.is_empty() {
            ui.push(serde_json::json!({
                "type": "alert",
                "title": "Partial follow-up degradation",
                "message": execution
                    .degraded_capabilities
                    .iter()
                    .map(|item| format!("{}: {}", item.capability, item.message))
                    .collect::<Vec<String>>()
                    .join(" | ")
            }));
        }

        ui.push(serde_json::json!({
            "type": "result",
            "title": "Action result",
            "message": execution.success.message,
            "status": if execution.degraded_capabilities.is_empty() { "success" } else { "warning" }
        }));
        ui.push(serde_json::json!({
            "type": "key-value",
            "items": [
                { "key": "Action", "value": execution.success.action },
                { "key": "Profile", "value": execution.success.profile_id.clone().unwrap_or_else(|| "none".to_string()) },
                { "key": "Active Profile", "value": execution.success.active_profile_id.clone().unwrap_or_else(|| "none".to_string()) }
            ]
        }));

        if let Some(profiles) = &execution.success.profiles {
            ui.push(serde_json::json!({
                "type": "table",
                "headers": ["Profile"],
                "rows": profiles.iter().map(|profile| vec![profile.clone()]).collect::<Vec<Vec<String>>>()
            }));
        }

        if let Some(content) = &execution.success.content {
            ui.push(serde_json::json!({
                "type": "code",
                "language": "json",
                "code": content
            }));
        }

        ui.push(serde_json::json!({
            "type": "markdown",
            "content": execution
                .success
                .recommendations
                .iter()
                .map(|item| format!("- {}", item))
                .collect::<Vec<String>>()
                .join("\n")
        }));
        ui.push(serde_json::json!({
            "type": "actions",
            "buttons": [
                { "id": "rerun-last-file-config-action", "label": "Run Previous Input", "variant": "default" },
                { "id": "reset-file-config-action", "label": "Reset", "variant": "outline" }
            ]
        }));
    }

    let artifacts = execution.map(build_guided_artifacts).unwrap_or_default();

    serde_json::json!({
        "ui": ui,
        "state": {
            "lastInput": input,
            "lastSuccess": execution.map(|item| serde_json::to_value(&item.success).expect("assistant success json")),
            "degradedCapabilities": execution.map(|item| serde_json::to_value(&item.degraded_capabilities).expect("degradations json")).unwrap_or_else(|| serde_json::json!([]))
        },
        "outputChannels": {
            "summary": summary.map(|(status, title, message)| serde_json::json!({
                "status": status,
                "title": title,
                "message": message
            })),
            "stream": stream,
            "artifacts": artifacts
        }
    })
}

fn build_guided_form(input: &AssistantInput) -> serde_json::Value {
    serde_json::json!({
        "type": "form",
        "id": "file-config-assistant-guided-form",
        "submitLabel": "Run Action",
        "fields": [
            {
                "type": "select",
                "id": "action",
                "label": "Action",
                "options": [
                    { "label": "List Profiles", "value": "list_profiles" },
                    { "label": "Read Profile", "value": "read_profile" },
                    { "label": "Write Profile", "value": "write_profile" },
                    { "label": "Delete Profile", "value": "delete_profile" },
                    { "label": "Set Active Profile", "value": "set_active_profile" },
                    { "label": "Get Active Profile", "value": "get_active_profile" }
                ],
                "defaultValue": input.action
            },
            {
                "type": "input",
                "id": "profileId",
                "label": "Profile ID",
                "defaultValue": input.profile_id.clone().unwrap_or_default(),
                "placeholder": "default"
            },
            {
                "type": "textarea",
                "id": "content",
                "label": "Profile Content",
                "rows": 8,
                "placeholder": "{\"region\":\"us\"}"
            },
            {
                "type": "switch",
                "id": "setActive",
                "label": "Set as active profile after write",
                "defaultChecked": input.set_active.unwrap_or(false)
            }
        ]
    })
}

fn build_guided_artifacts(execution: &GuidedExecution) -> Vec<serde_json::Value> {
    let mut artifacts = vec![serde_json::json!({
        "id": "file-config-result",
        "label": "Copy action result JSON",
        "action": "copy",
        "content": serde_json::to_string_pretty(&execution.success).expect("assistant success string")
    })];

    if let Some(content) = &execution.success.content {
        artifacts.push(serde_json::json!({
            "id": "file-config-content",
            "label": "Copy profile content",
            "action": "copy",
            "content": content
        }));
    }

    if let Some(active_profile_id) = &execution.success.active_profile_id {
        artifacts.push(serde_json::json!({
            "id": "file-config-active-profile",
            "label": "Copy active profile id",
            "action": "copy",
            "content": active_profile_id
        }));
    }

    artifacts
}

fn run_guided_action_with_runtime(
    input: &AssistantInput,
    runtime: &mut dyn RuntimeOps,
) -> Result<GuidedExecution, PluginError> {
    match input.action.as_str() {
        "write_profile" => guided_write_profile(runtime, input),
        "delete_profile" => guided_delete_profile(runtime, input),
        "list_profiles" => {
            let success = list_profiles(runtime)?;
            Ok(GuidedExecution {
                stream: vec![GuidedStreamEntry {
                    level: "info",
                    message: "Listed available profiles.".to_string(),
                }],
                success,
                degraded_capabilities: vec![],
            })
        }
        "read_profile" => {
            let success = read_profile(runtime, input.profile_id.clone())?;
            Ok(GuidedExecution {
                stream: vec![GuidedStreamEntry {
                    level: "info",
                    message: "Read profile content.".to_string(),
                }],
                success,
                degraded_capabilities: vec![],
            })
        }
        "set_active_profile" => {
            let success = set_active_profile(runtime, input.profile_id.clone())?;
            Ok(GuidedExecution {
                stream: vec![GuidedStreamEntry {
                    level: "info",
                    message: "Updated the active profile pointer.".to_string(),
                }],
                success,
                degraded_capabilities: vec![],
            })
        }
        "get_active_profile" => {
            let success = get_active_profile(runtime)?;
            Ok(GuidedExecution {
                stream: vec![GuidedStreamEntry {
                    level: "info",
                    message: "Read the active profile pointer.".to_string(),
                }],
                success,
                degraded_capabilities: vec![],
            })
        }
        _ => {
            let success = run_with_runtime(&serde_json::to_string(input).expect("assistant input"), runtime)?;
            Ok(GuidedExecution {
                stream: vec![GuidedStreamEntry {
                    level: "info",
                    message: format!("Completed {}.", success.action),
                }],
                success,
                degraded_capabilities: vec![],
            })
        }
    }
}

fn guided_write_profile(
    runtime: &mut dyn RuntimeOps,
    input: &AssistantInput,
) -> Result<GuidedExecution, PluginError> {
    let profile_id = require_profile_id(input.profile_id.clone())?;
    let content = input.content.clone().unwrap_or_default();
    let set_active = input.set_active.unwrap_or(false);

    ensure_profile_dir(runtime)?;
    runtime
        .fs_write(&profile_path(&profile_id), &content)
        .map_err(|e| host_error("Failed to write profile content.", e))?;

    let mut degraded_capabilities = vec![];
    let mut stream = vec![GuidedStreamEntry {
        level: "info",
        message: format!("Profile '{}' content written.", profile_id),
    }];
    let mut message = "Profile write completed.".to_string();
    let mut recommendations = vec![
        "Use read_profile to verify persisted content.".to_string(),
        "Use list_profiles to inspect the full profile inventory.".to_string(),
    ];
    let mut active_profile_id = None;

    if set_active {
        match runtime.config_set(ACTIVE_PROFILE_KEY, &profile_id) {
            Ok(()) => {
                active_profile_id = Some(profile_id.clone());
                stream.push(GuidedStreamEntry {
                    level: "info",
                    message: "Active profile pointer updated.".to_string(),
                });
            }
            Err(error) => {
                degraded_capabilities.push(GuidedCapabilityDegradation {
                    capability: "config",
                    message: error.clone(),
                });
                stream.push(GuidedStreamEntry {
                    level: "warning",
                    message: format!("config follow-up degraded: {}", error),
                });
                message = "Profile write completed, but activating it was blocked.".to_string();
                recommendations.push(
                    "Retry set_active_profile after restoring config_write access.".to_string(),
                );
            }
        }
    }

    Ok(GuidedExecution {
        success: AssistantSuccess {
            ok: true,
            action: "write_profile".to_string(),
            profile_id: Some(profile_id),
            profiles: None,
            content: None,
            active_profile_id,
            message,
            recommendations,
        },
        degraded_capabilities,
        stream,
    })
}

fn guided_delete_profile(
    runtime: &mut dyn RuntimeOps,
    input: &AssistantInput,
) -> Result<GuidedExecution, PluginError> {
    let profile_id = require_profile_id(input.profile_id.clone())?;
    let profile_path = profile_path(&profile_id);
    ensure_profile_exists(runtime, &profile_id, &profile_path)?;

    runtime
        .fs_delete(&profile_path)
        .map_err(|e| host_error("Failed to delete profile file.", e))?;

    let mut degraded_capabilities = vec![];
    let mut stream = vec![GuidedStreamEntry {
        level: "info",
        message: format!("Deleted profile '{}'.", profile_id),
    }];
    let mut active_profile_id = None;
    let mut message = "Profile delete completed.".to_string();
    let mut recommendations = vec![
        "Use set_active_profile to point to another profile if needed.".to_string(),
    ];

    match runtime.config_get(ACTIVE_PROFILE_KEY) {
        Ok(current_active_profile) => {
            let normalized = normalize_optional(current_active_profile);
            if normalized.as_deref() == Some(profile_id.as_str()) {
                match runtime.config_set(ACTIVE_PROFILE_KEY, "") {
                    Ok(()) => {
                        stream.push(GuidedStreamEntry {
                            level: "info",
                            message: "Cleared the active profile pointer.".to_string(),
                        });
                    }
                    Err(error) => {
                        active_profile_id = Some(profile_id.clone());
                        degraded_capabilities.push(GuidedCapabilityDegradation {
                            capability: "config",
                            message: error.clone(),
                        });
                        stream.push(GuidedStreamEntry {
                            level: "warning",
                            message: format!("config follow-up degraded: {}", error),
                        });
                        message = "Profile delete completed, but clearing the active pointer was blocked.".to_string();
                        recommendations.push(
                            "Retry set_active_profile or clear the pointer after restoring config_write access.".to_string(),
                        );
                    }
                }
            }
        }
        Err(error) => {
            degraded_capabilities.push(GuidedCapabilityDegradation {
                capability: "config",
                message: error.clone(),
            });
            stream.push(GuidedStreamEntry {
                level: "warning",
                message: format!("config follow-up degraded: {}", error),
            });
            message = "Profile delete completed, but reading active pointer state was blocked.".to_string();
            recommendations.push(
                "Retry get_active_profile after restoring config_read access.".to_string(),
            );
        }
    }

    Ok(GuidedExecution {
        success: AssistantSuccess {
            ok: true,
            action: "delete_profile".to_string(),
            profile_id: Some(profile_id),
            profiles: None,
            content: None,
            active_profile_id,
            message,
            recommendations,
        },
        degraded_capabilities,
        stream,
    })
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
    fail_config_set: bool,
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
        if self.fail_config_set {
            return Err("config_write permission denied".to_string());
        }
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

    #[test]
    fn guided_workflow_renders_initial_form() {
        let mut runtime = MockRuntime::default();
        let response = render_guided_with_runtime("", &mut runtime);

        let ui = response["ui"].as_array().expect("guided ui array");
        assert!(ui.iter().any(|block| block["type"] == "heading"));
        assert!(ui.iter().any(|block| block["type"] == "form"));
        assert_eq!(response["outputChannels"]["summary"]["status"], "info");
        assert_eq!(response["state"]["lastInput"]["action"], "list_profiles");
    }

    #[test]
    fn guided_workflow_preserves_written_profile_when_active_pointer_update_fails() {
        let mut runtime = MockRuntime::default();
        runtime.fail_config_set = true;

        let raw = serde_json::json!({
            "action": "form_submit",
            "formId": "file-config-assistant-guided-form",
            "formData": {
                "action": "write_profile",
                "profileId": "default",
                "content": "{\"region\":\"us\"}",
                "setActive": true
            }
        })
        .to_string();

        let response = render_guided_with_runtime(&raw, &mut runtime);

        assert_eq!(
            runtime.files.get("profiles/default.json").map(String::as_str),
            Some("{\"region\":\"us\"}"),
        );
        assert_eq!(response["outputChannels"]["summary"]["status"], "warning");
        assert_eq!(
            response["state"]["degradedCapabilities"][0]["capability"],
            "config"
        );
        assert_eq!(response["state"]["lastSuccess"]["action"], "write_profile");
        assert_eq!(
            response["outputChannels"]["artifacts"][0]["action"],
            "copy"
        );
    }
}
