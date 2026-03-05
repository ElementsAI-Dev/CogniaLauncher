use cognia_plugin_sdk::prelude::*;
use cognia_plugin_sdk::ui;

/// Tool: "hello" — Greets the user with platform and i18n info
#[plugin_fn]
pub fn hello(input: String) -> FnResult<String> {
    // Get platform info
    let platform = cognia::platform::info()?;
    cognia::log::info(&format!(
        "Hello tool invoked on {} {}",
        platform.os, platform.arch
    ))?;

    // Determine user name from input or hostname
    let name = if input.trim().is_empty() {
        platform.hostname.clone()
    } else {
        input.trim().to_string()
    };

    // Translate greeting using plugin's locale data
    let greeting = cognia::i18n::translate("greeting", &[("name", &name)])?;

    // Get plugin ID
    let plugin_id = cognia::event::get_plugin_id()?;

    // Emit an event
    cognia::event::emit_str("hello-invoked", &name)?;

    Ok(serde_json::json!({
        "greeting": greeting,
        "pluginId": plugin_id,
        "platform": {
            "os": platform.os,
            "arch": platform.arch,
            "osVersion": platform.os_version,
        },
    })
    .to_string())
}

/// Tool: "env-check" — Check installed development environments
#[plugin_fn]
pub fn env_check(input: String) -> FnResult<String> {
    cognia::log::info("Environment check tool invoked")?;

    // Parse which environments to check from input, or use defaults
    let env_types: Vec<String> = if input.trim().is_empty() {
        vec!["node".to_string(), "python".to_string(), "rust".to_string()]
    } else {
        serde_json::from_str(&input).unwrap_or_else(|_| {
            input
                .split(',')
                .map(|s| s.trim().to_string())
                .filter(|s| !s.is_empty())
                .collect()
        })
    };

    let mut results = Vec::new();

    for env_type in &env_types {
        let detection = cognia::env::detect(env_type)?;

        let message = if detection.available {
            let version = detection.current_version.as_deref().unwrap_or("unknown");
            cognia::i18n::translate("envAvailable", &[("env", env_type), ("version", version)])?
        } else {
            cognia::i18n::translate("envNotAvailable", &[("env", env_type)])?
        };

        results.push(serde_json::json!({
            "envType": env_type,
            "available": detection.available,
            "currentVersion": detection.current_version,
            "installedVersions": detection.installed_versions,
            "message": message,
        }));
    }

    Ok(serde_json::json!({
        "environments": results,
        "checkedCount": results.len(),
    })
    .to_string())
}

/// Tool: "env-dashboard" — Rich declarative UI dashboard for environments
#[plugin_fn]
pub fn env_dashboard(input: String) -> FnResult<String> {
    cognia::log::info("Environment dashboard invoked")?;

    let action = ui::parse_action(&input);
    if let Some(ref parsed_action) = action {
        if parsed_action.action == "button_click"
            && parsed_action.button_id.as_deref() == Some("refresh")
        {
            cognia::log::info("Dashboard refresh requested")?;
        }

        if parsed_action.action == "form_submit" {
            let form_types = parsed_action
                .form_data_types
                .as_ref()
                .map(|v| serde_json::to_string(v).unwrap_or_else(|_| "{}".to_string()))
                .unwrap_or_else(|| "{}".to_string());
            cognia::log::info(&format!(
                "Dashboard form submitted with fields: {}",
                form_types
            ))?;
        }
    }

    let platform = cognia::platform::info()?;
    let env_types = ["node", "python", "rust", "go"];

    let mut table_rows: Vec<Vec<String>> = Vec::new();
    let mut detected_count = 0u32;

    for env_type in &env_types {
        let detection = cognia::env::detect(env_type)?;
        let version = if detection.available {
            detected_count += 1;
            detection
                .current_version
                .unwrap_or_else(|| "unknown".to_string())
        } else {
            "Not installed".to_string()
        };
        let status = if detection.available { "✅" } else { "❌" };
        table_rows.push(vec![
            env_type.to_string(),
            version,
            status.to_string(),
            detection.installed_versions.len().to_string(),
        ]);
    }

    let active_targets: Vec<String> = action
        .as_ref()
        .and_then(|a| a.form_data.as_ref())
        .and_then(|data| data.get("targets"))
        .and_then(|targets| targets.as_array())
        .map(|items| {
            items
                .iter()
                .filter_map(|item| item.as_str().map(ToString::to_string))
                .collect::<Vec<String>>()
        })
        .filter(|items| !items.is_empty())
        .unwrap_or_else(|| env_types.iter().map(|v| (*v).to_string()).collect());

    let action_name = action
        .as_ref()
        .map(|a| a.action.clone())
        .unwrap_or_else(|| "initial_render".to_string());
    let source_type = action
        .as_ref()
        .and_then(|a| a.source_type.clone())
        .unwrap_or_else(|| "none".to_string());
    let version = action.as_ref().and_then(|a| a.version).unwrap_or(1);

    let summary = serde_json::json!({
        "action": action_name,
        "activeTargets": active_targets,
        "sourceType": source_type,
        "version": version,
    });

    let readiness_message = if detected_count == env_types.len() as u32 {
        "All tracked environments are available."
    } else {
        "Some environments are missing."
    };
    let readiness_status = if detected_count == env_types.len() as u32 {
        Some("success")
    } else {
        Some("warning")
    };
    let readiness_details = format!("Detected {} out of {}.", detected_count, env_types.len());
    let detected_text = detected_count.to_string();
    let tracked_text = env_types.len().to_string();
    let selected_targets_text = summary["activeTargets"]
        .as_array()
        .map(|v| v.len().to_string())
        .unwrap_or_else(|| "0".to_string());
    let last_action_text = summary["action"]
        .as_str()
        .unwrap_or("initial_render")
        .to_string();

    let target_options = env_types
        .iter()
        .map(|env| ui::select_option(env, env))
        .collect::<Vec<ui::SelectOption>>();

    let blocks = vec![
        ui::heading("Environment Dashboard", 1),
        ui::group(
            "horizontal",
            Some(3),
            vec![
                ui::badge(&format!("OS: {}", platform.os), Some("outline")),
                ui::badge(&format!("Arch: {}", platform.arch), Some("outline")),
                ui::badge(
                    &format!("{}/{} detected", detected_count, env_types.len()),
                    Some("secondary"),
                ),
            ],
        ),
        ui::divider(),
        ui::result(
            readiness_message,
            readiness_status,
            Some("Environment readiness"),
            Some(&readiness_details),
        ),
        ui::progress(
            detected_count as f64,
            Some(env_types.len() as f64),
            Some("Detection progress"),
        ),
        ui::table(
            &["Environment", "Version", "Status", "Installed Versions"],
            &table_rows,
        ),
        ui::key_value(&[
            ("Hostname", &platform.hostname),
            ("OS Version", &platform.os_version),
        ]),
        ui::stat_cards(vec![
            ui::stat_card(
                "detected",
                "Detected",
                serde_json::json!(detected_text),
                None,
                Some("success"),
            ),
            ui::stat_card(
                "total",
                "Tracked",
                serde_json::json!(tracked_text),
                None,
                None,
            ),
            ui::stat_card(
                "targeted",
                "Selected Targets",
                serde_json::json!(selected_targets_text),
                None,
                None,
            ),
        ]),
        ui::description_list(&[
            ("Hostname", &platform.hostname),
            ("OS Version", &platform.os_version),
            ("Last Action", &last_action_text),
        ]),
        ui::json_view(&summary, Some("Action Payload Snapshot"), None),
        ui::form(
            "dashboard-controls",
            vec![
                ui::radio_group_field(
                    "channel",
                    "Channel",
                    vec![
                        ui::select_option("Stable", "stable"),
                        ui::select_option("Canary", "canary"),
                    ],
                    Some("stable"),
                    Some(true),
                ),
                ui::number_field(
                    "retryCount",
                    "Retry Count",
                    None,
                    Some(1.0),
                    Some(0.0),
                    Some(5.0),
                    Some(1.0),
                    Some(false),
                ),
                ui::switch_field("includePrerelease", "Include Pre-release", Some(false)),
                ui::multi_select_field(
                    "targets",
                    "Targets",
                    target_options,
                    Some(vec!["node".to_string(), "python".to_string()]),
                    Some(false),
                ),
                ui::date_time_field("scheduleAt", "Schedule At", None, None, None, None),
                ui::password_field(
                    "token",
                    "Access Token",
                    Some("Optional token"),
                    None,
                    Some(false),
                ),
            ],
            Some("Apply Filters"),
        ),
        ui::divider(),
        ui::actions(&[ui::button(
            "refresh",
            "Refresh",
            Some("default"),
            Some("RefreshCw"),
        )]),
    ];

    Ok(ui::render(&blocks))
}
