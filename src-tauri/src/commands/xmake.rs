use crate::error::{CogniaError, CogniaResult};
use crate::platform::process::{self, ProcessOptions};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::time::Duration;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct XmakeRepo {
    pub name: String,
    pub url: String,
    pub branch: Option<String>,
}

fn make_opts() -> ProcessOptions {
    ProcessOptions::new().with_timeout(Duration::from_secs(120))
}

fn make_long_opts() -> ProcessOptions {
    ProcessOptions::new().with_timeout(Duration::from_secs(300))
}

// ── Repository Management ──

#[tauri::command]
pub async fn xmake_list_repos() -> CogniaResult<Vec<XmakeRepo>> {
    let opts = make_opts();
    let out = process::execute("xrepo", &["list-repo"], Some(opts)).await?;
    let output = if out.stdout.is_empty() {
        out.stderr
    } else {
        out.stdout
    };

    let mut repos = Vec::new();
    for line in output.lines() {
        let trimmed = line.trim();
        if trimmed.is_empty()
            || trimmed.starts_with("WARN")
            || trimmed.starts_with("note:")
            || trimmed.starts_with("error:")
        {
            continue;
        }
        let parts: Vec<&str> = trimmed.split_whitespace().collect();
        if parts.len() >= 2 {
            repos.push(XmakeRepo {
                name: parts[0].to_string(),
                url: parts[1].to_string(),
                branch: parts.get(2).map(|s| s.to_string()),
            });
        }
    }
    Ok(repos)
}

#[tauri::command]
pub async fn xmake_add_repo(
    name: String,
    url: String,
    branch: Option<String>,
) -> CogniaResult<()> {
    let opts = make_opts();
    let mut args = vec!["add-repo", &name, &url];
    let branch_str;
    if let Some(ref b) = branch {
        branch_str = b.clone();
        args.push(&branch_str);
    }
    let out = process::execute("xrepo", &args, Some(opts)).await?;
    if out.success {
        Ok(())
    } else {
        Err(CogniaError::Provider(out.stderr))
    }
}

#[tauri::command]
pub async fn xmake_remove_repo(name: String) -> CogniaResult<()> {
    let opts = make_opts();
    let out = process::execute("xrepo", &["rm-repo", &name], Some(opts)).await?;
    if out.success {
        Ok(())
    } else {
        Err(CogniaError::Provider(out.stderr))
    }
}

#[tauri::command]
pub async fn xmake_update_repos() -> CogniaResult<()> {
    let opts = make_long_opts();
    let out = process::execute("xrepo", &["update-repo"], Some(opts)).await?;
    if out.success {
        Ok(())
    } else {
        Err(CogniaError::Provider(out.stderr))
    }
}

// ── Cache Management ──

#[tauri::command]
pub async fn xmake_clean_cache(
    packages: Option<Vec<String>>,
    cache_only: bool,
) -> CogniaResult<String> {
    let opts = make_long_opts();
    let mut args: Vec<String> = vec!["clean".to_string(), "-y".to_string()];
    if cache_only {
        args.push("--cache".to_string());
    }
    if let Some(ref pkgs) = packages {
        if !pkgs.is_empty() {
            args.push("--packages".to_string());
            args.push(pkgs.join(","));
        }
    }
    let args_ref: Vec<&str> = args.iter().map(|s| s.as_str()).collect();
    let out = process::execute("xrepo", &args_ref, Some(opts)).await?;
    let output = format!("{}\n{}", out.stdout, out.stderr);
    if out.success {
        Ok(output)
    } else {
        Err(CogniaError::Provider(output))
    }
}

// ── Virtual Environment ──

#[tauri::command]
pub async fn xmake_env_show(packages: Vec<String>) -> CogniaResult<HashMap<String, String>> {
    let pkg_list = packages.join(",");
    let opts = make_opts();
    let out = process::execute("xrepo", &["env", "--show", &pkg_list], Some(opts)).await?;
    let output = if out.stdout.is_empty() {
        out.stderr
    } else {
        out.stdout
    };

    // Parse Lua-table-like output: KEY = "VALUE" or KEY = VALUE
    let mut env_vars = HashMap::new();
    for line in output.lines() {
        let trimmed = line.trim().trim_end_matches(',');
        if trimmed.is_empty() || trimmed == "{" || trimmed == "}" {
            continue;
        }
        if let Some(eq_pos) = trimmed.find('=') {
            let key = trimmed[..eq_pos].trim().to_string();
            let val = trimmed[eq_pos + 1..]
                .trim()
                .trim_matches('"')
                .to_string();
            if !key.is_empty() {
                env_vars.insert(key, val);
            }
        }
    }
    Ok(env_vars)
}

#[tauri::command]
pub async fn xmake_env_list() -> CogniaResult<Vec<String>> {
    let opts = make_opts();
    let out = process::execute("xrepo", &["env", "--list"], Some(opts)).await?;
    let output = if out.stdout.is_empty() {
        out.stderr
    } else {
        out.stdout
    };

    let mut envs = Vec::new();
    for line in output.lines() {
        let trimmed = line.trim();
        if trimmed.is_empty() || trimmed.ends_with(':') || trimmed.starts_with("envs(") {
            continue;
        }
        // Lines like "  -base" → strip leading dash
        let name = trimmed.trim_start_matches('-').trim();
        if !name.is_empty() {
            envs.push(name.to_string());
        }
    }
    Ok(envs)
}

#[tauri::command]
pub async fn xmake_env_bind(
    name_or_packages: String,
    command: String,
) -> CogniaResult<String> {
    let opts = make_long_opts();
    let out = process::execute(
        "xrepo",
        &["env", "-b", &name_or_packages, &command],
        Some(opts),
    )
    .await?;
    let output = format!("{}\n{}", out.stdout, out.stderr);
    if out.success {
        Ok(output)
    } else {
        Err(CogniaError::Provider(output))
    }
}

// ── Export / Import / Download ──

#[tauri::command]
pub async fn xmake_export_package(name: String, output_dir: String) -> CogniaResult<()> {
    let opts = make_long_opts();
    let out =
        process::execute("xrepo", &["export", "-o", &output_dir, &name], Some(opts)).await?;
    if out.success {
        Ok(())
    } else {
        Err(CogniaError::Provider(out.stderr))
    }
}

#[tauri::command]
pub async fn xmake_import_package(input_dir: String) -> CogniaResult<()> {
    let opts = make_long_opts();
    let out = process::execute("xrepo", &["import", &input_dir], Some(opts)).await?;
    if out.success {
        Ok(())
    } else {
        Err(CogniaError::Provider(out.stderr))
    }
}

#[tauri::command]
pub async fn xmake_download_source(
    name: String,
    output_dir: Option<String>,
) -> CogniaResult<()> {
    let opts = make_long_opts();
    let mut args = vec!["download"];
    let output_dir_str;
    if let Some(ref dir) = output_dir {
        output_dir_str = dir.clone();
        args.push("-o");
        args.push(&output_dir_str);
    }
    args.push(&name);
    let out = process::execute("xrepo", &args, Some(opts)).await?;
    if out.success {
        Ok(())
    } else {
        Err(CogniaError::Provider(out.stderr))
    }
}
