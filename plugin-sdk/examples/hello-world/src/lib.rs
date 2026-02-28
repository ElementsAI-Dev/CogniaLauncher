use cognia_plugin_sdk::prelude::*;
use cognia_plugin_sdk::ui;

/// Tool: "hello" — Greets the user with platform and i18n info
#[plugin_fn]
pub fn hello(input: String) -> FnResult<String> {
    // Get platform info
    let platform = cognia::platform::info()?;
    cognia::log::info(&format!("Hello tool invoked on {} {}", platform.os, platform.arch))?;

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
        vec![
            "node".to_string(),
            "python".to_string(),
            "rust".to_string(),
        ]
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

    // Check if this is an action callback (button click / form submit)
    if let Some(action) = ui::parse_action(&input) {
        if action.action == "button_click" && action.button_id.as_deref() == Some("refresh") {
            cognia::log::info("Dashboard refresh requested")?;
            // Fall through to re-render
        }
    }

    let platform = cognia::platform::info()?;
    let env_types = ["node", "python", "rust"];

    let mut table_rows: Vec<Vec<String>> = Vec::new();
    let mut detected_count = 0u32;

    for env_type in &env_types {
        let detection = cognia::env::detect(env_type)?;
        let version = if detection.available {
            detected_count += 1;
            detection.current_version.unwrap_or_else(|| "unknown".to_string())
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

    let blocks = vec![
        ui::heading("Environment Dashboard", 1),
        ui::group("horizontal", Some(3), vec![
            ui::badge(&format!("OS: {}", platform.os), Some("outline")),
            ui::badge(&format!("Arch: {}", platform.arch), Some("outline")),
            ui::badge(&format!("{}/{} detected", detected_count, env_types.len()), Some("secondary")),
        ]),
        ui::divider(),
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
        ui::divider(),
        ui::actions(&[
            ui::button("refresh", "Refresh", Some("default"), Some("RefreshCw")),
        ]),
    ];

    Ok(ui::render(&blocks))
}
