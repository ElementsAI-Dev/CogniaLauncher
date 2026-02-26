use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::PathBuf;
use tokio::fs;
use tokio::io::AsyncWriteExt;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ManifestInfo {
    pub project_name: Option<String>,
    pub project_version: Option<String>,
    pub environments: HashMap<String, String>,
    pub packages: Vec<String>,
    pub path: String,
}

#[derive(Debug, Serialize, Deserialize, Default)]
struct CogniaManifest {
    #[serde(default)]
    project: ProjectInfo,
    #[serde(default)]
    environments: HashMap<String, String>,
    #[serde(default)]
    packages: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize, Default)]
struct ProjectInfo {
    name: Option<String>,
    version: Option<String>,
}

const MANIFEST_FILE_NAME: &str = "cognia.toml";

/// Find manifest file by searching upward from the given path
async fn find_manifest(start_path: &std::path::Path) -> Option<PathBuf> {
    let mut current = start_path.to_path_buf();

    loop {
        let manifest_path = current.join(MANIFEST_FILE_NAME);
        if manifest_path.exists() {
            return Some(manifest_path);
        }

        if !current.pop() {
            return None;
        }
    }
}

/// Get the current working directory or a fallback path
fn get_default_project_path() -> PathBuf {
    // Try current directory first
    if let Ok(cwd) = std::env::current_dir() {
        return cwd;
    }

    // Fall back to home directory using std
    #[cfg(target_os = "windows")]
    {
        std::env::var("USERPROFILE")
            .map(PathBuf::from)
            .unwrap_or_else(|_| PathBuf::from("C:\\"))
    }
    #[cfg(not(target_os = "windows"))]
    {
        std::env::var("HOME")
            .map(PathBuf::from)
            .unwrap_or_else(|_| PathBuf::from("/tmp"))
    }
}

#[tauri::command]
pub async fn manifest_read(project_path: Option<String>) -> Result<Option<ManifestInfo>, String> {
    let search_path = match project_path {
        Some(path) => PathBuf::from(path),
        None => get_default_project_path(),
    };

    // Find manifest file
    let manifest_path = match find_manifest(&search_path).await {
        Some(path) => path,
        None => return Ok(None),
    };

    // Read and parse manifest
    let content = fs::read_to_string(&manifest_path)
        .await
        .map_err(|e| format!("Failed to read manifest: {}", e))?;

    let manifest: CogniaManifest =
        toml::from_str(&content).map_err(|e| format!("Failed to parse manifest: {}", e))?;

    Ok(Some(ManifestInfo {
        project_name: manifest.project.name,
        project_version: manifest.project.version,
        environments: manifest.environments,
        packages: manifest.packages,
        path: manifest_path.to_string_lossy().to_string(),
    }))
}

#[tauri::command]
pub async fn manifest_init(project_path: Option<String>) -> Result<(), String> {
    let target_path = match project_path {
        Some(path) => PathBuf::from(path),
        None => get_default_project_path(),
    };

    let manifest_path = target_path.join(MANIFEST_FILE_NAME);

    // Check if manifest already exists
    if manifest_path.exists() {
        return Err("Manifest file already exists".to_string());
    }

    // Create default manifest content
    let default_manifest = r#"# Cognia Project Manifest
# This file defines the project's environment and package dependencies

[project]
# name = "my-project"
# version = "0.1.0"

[environments]
# node = "20"
# python = "3.12"
# rust = "stable"

[packages]
# List packages to install
# packages = ["typescript", "eslint"]
"#;

    // Write manifest file
    let mut file = fs::File::create(&manifest_path)
        .await
        .map_err(|e| format!("Failed to create manifest: {}", e))?;

    file.write_all(default_manifest.as_bytes())
        .await
        .map_err(|e| format!("Failed to write manifest: {}", e))?;

    Ok(())
}
