use crate::platform::fs;
use std::env;
use std::path::{Component, Path, PathBuf};

const DEFAULT_MAX_READ_BYTES: u64 = 5 * 1024 * 1024;

fn contains_parent_traversal(path: &Path) -> bool {
    path.components()
        .any(|component| matches!(component, Component::ParentDir))
}

fn contains_dangerous_chars(raw: &str) -> bool {
    raw.contains('\0')
        || raw
            .chars()
            .any(|ch| ch.is_control() && !matches!(ch, '\n' | '\r' | '\t'))
}

fn expand_env_tokens(input: &str) -> String {
    let mut expanded = String::with_capacity(input.len());
    let chars: Vec<char> = input.chars().collect();
    let mut index = 0;

    while index < chars.len() {
        let current = chars[index];

        if current == '%' {
            if let Some(end) = chars[index + 1..].iter().position(|ch| *ch == '%') {
                let token_end = index + 1 + end;
                let name: String = chars[index + 1..token_end].iter().collect();
                if !name.is_empty() {
                    if let Ok(value) = env::var(&name) {
                        expanded.push_str(&value);
                        index = token_end + 1;
                        continue;
                    }
                }
            }
        }

        if current == '$' {
            if index + 1 < chars.len() && chars[index + 1] == '{' {
                if let Some(end) = chars[index + 2..].iter().position(|ch| *ch == '}') {
                    let token_end = index + 2 + end;
                    let name: String = chars[index + 2..token_end].iter().collect();
                    if !name.is_empty() {
                        if let Ok(value) = env::var(&name) {
                            expanded.push_str(&value);
                            index = token_end + 1;
                            continue;
                        }
                    }
                }
            } else {
                let mut token_end = index + 1;
                while token_end < chars.len()
                    && (chars[token_end].is_ascii_alphanumeric() || chars[token_end] == '_')
                {
                    token_end += 1;
                }
                if token_end > index + 1 {
                    let name: String = chars[index + 1..token_end].iter().collect();
                    if let Ok(value) = env::var(&name) {
                        expanded.push_str(&value);
                        index = token_end;
                        continue;
                    }
                }
            }
        }

        expanded.push(current);
        index += 1;
    }

    expanded
}

fn expand_home(input: &str) -> String {
    if input == "~" || input.starts_with("~/") || input.starts_with("~\\") {
        if let Some(home) = fs::get_home_dir() {
            let suffix = input.strip_prefix('~').unwrap_or_default();
            return format!("{}{}", home.display(), suffix);
        }
    }
    input.to_string()
}

fn normalize_path(path: &Path) -> PathBuf {
    if let Ok(canonical) = std::fs::canonicalize(path) {
        return canonical;
    }

    let mut existing = path.to_path_buf();
    let mut remaining = Vec::new();
    while !existing.exists() {
        if let Some(file_name) = existing.file_name() {
            remaining.push(file_name.to_owned());
        }
        if let Some(parent) = existing.parent() {
            existing = parent.to_path_buf();
        } else {
            break;
        }
    }

    if let Ok(canonical_base) = std::fs::canonicalize(&existing) {
        let mut result = canonical_base;
        for segment in remaining.into_iter().rev() {
            result.push(segment);
        }
        return result;
    }

    path.to_path_buf()
}

fn resolve_user_path(raw_path: &str) -> Result<PathBuf, String> {
    let trimmed = raw_path.trim();
    if trimmed.is_empty() {
        return Err("Path must not be empty".to_string());
    }
    if contains_dangerous_chars(trimmed) {
        return Err("Path contains unsupported characters".to_string());
    }

    let expanded = expand_env_tokens(&expand_home(trimmed));
    let candidate = PathBuf::from(expanded);
    if contains_parent_traversal(&candidate) {
        return Err("Path traversal segments are not allowed".to_string());
    }

    let absolute = if candidate.is_absolute() {
        candidate
    } else {
        env::current_dir()
            .map_err(|error| format!("Failed to resolve current directory: {error}"))?
            .join(candidate)
    };

    Ok(normalize_path(&absolute))
}

fn normalize_checksum_algorithm(algorithm: &str) -> Result<&'static str, String> {
    match algorithm.trim().to_ascii_lowercase().as_str() {
        "md5" => Ok("md5"),
        "sha1" | "sha-1" => Ok("sha1"),
        "sha256" | "sha-256" => Ok("sha256"),
        "sha512" | "sha-512" => Ok("sha512"),
        other => Err(format!("Unsupported hash algorithm: {other}")),
    }
}

fn ensure_regular_file(path: &Path) -> Result<(), String> {
    if !path.exists() {
        return Err(format!("File not found: {}", path.display()));
    }
    if path.is_dir() {
        return Err(format!(
            "Expected a file path, got directory: {}",
            path.display()
        ));
    }
    Ok(())
}

#[tauri::command]
pub async fn toolbox_hash_file(file_path: String, algorithm: String) -> Result<String, String> {
    let resolved_path = resolve_user_path(&file_path)?;
    ensure_regular_file(&resolved_path)?;
    let normalized_algorithm = normalize_checksum_algorithm(&algorithm)?;

    fs::calculate_checksum(&resolved_path, normalized_algorithm)
        .await
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub async fn toolbox_read_file_for_tool(
    file_path: String,
    max_size: Option<u64>,
) -> Result<String, String> {
    let resolved_path = resolve_user_path(&file_path)?;
    ensure_regular_file(&resolved_path)?;

    let size_limit = max_size.unwrap_or(DEFAULT_MAX_READ_BYTES);
    let metadata = tokio::fs::metadata(&resolved_path)
        .await
        .map_err(|error| format!("Failed to read file metadata: {error}"))?;
    if metadata.len() > size_limit {
        return Err(format!(
            "File exceeds maximum allowed size of {} bytes",
            size_limit
        ));
    }

    fs::read_file_string(&resolved_path)
        .await
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub async fn toolbox_write_tool_output(
    file_path: String,
    content: String,
) -> Result<String, String> {
    let resolved_path = resolve_user_path(&file_path)?;
    if resolved_path.is_dir() {
        return Err(format!(
            "Expected a file path, got directory: {}",
            resolved_path.display()
        ));
    }

    fs::write_file_string(&resolved_path, &content)
        .await
        .map_err(|error| error.to_string())?;

    Ok(normalize_path(&resolved_path).display().to_string())
}

#[tauri::command]
pub async fn toolbox_resolve_path(path: String) -> Result<String, String> {
    let resolved_path = resolve_user_path(&path)?;
    Ok(resolved_path.display().to_string())
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    #[tokio::test]
    async fn toolbox_hash_file_returns_expected_sha256() {
        let dir = tempdir().expect("tempdir");
        let file_path = dir.path().join("hash.txt");
        fs::write_file_string(&file_path, "hello")
            .await
            .expect("write test file");

        let hash = toolbox_hash_file(file_path.display().to_string(), "sha256".to_string())
            .await
            .expect("hash result");

        assert_eq!(
            hash,
            "2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824"
        );
    }

    #[tokio::test]
    async fn toolbox_read_file_for_tool_rejects_parent_traversal() {
        let error = toolbox_read_file_for_tool("../secrets.txt".to_string(), None)
            .await
            .expect_err("traversal should fail");

        assert!(error.contains("Path traversal"));
    }

    #[tokio::test]
    async fn toolbox_read_file_for_tool_enforces_size_limit() {
        let dir = tempdir().expect("tempdir");
        let file_path = dir.path().join("large.txt");
        fs::write_file_string(&file_path, "0123456789")
            .await
            .expect("write large test file");

        let error = toolbox_read_file_for_tool(file_path.display().to_string(), Some(4))
            .await
            .expect_err("size limit should fail");

        assert!(error.contains("maximum allowed size"));
    }

    #[tokio::test]
    async fn toolbox_write_tool_output_persists_content() {
        let dir = tempdir().expect("tempdir");
        let file_path = dir.path().join("nested").join("output.txt");

        let written_path =
            toolbox_write_tool_output(file_path.display().to_string(), "tool output".to_string())
                .await
                .expect("write succeeds");
        let content = fs::read_file_string(&file_path)
            .await
            .expect("read written file");

        assert_eq!(content, "tool output");
        assert_eq!(
            written_path,
            normalize_path(&file_path).display().to_string()
        );
    }

    #[test]
    fn toolbox_resolve_path_expands_home_marker() {
        let home = fs::get_home_dir().expect("home dir");
        let resolved = resolve_user_path("~/Documents").expect("resolved path");
        let expected = normalize_path(&home.join("Documents"));

        assert_eq!(resolved, expected);
    }

    #[test]
    fn toolbox_resolve_path_expands_environment_variable_tokens() {
        let temp_dir = env::temp_dir().join("cognia_toolbox_env_test");
        let temp_dir_str = temp_dir.display().to_string();
        env::set_var("COGNIA_TOOLBOX_TEST_DIR", &temp_dir_str);

        let resolved =
            resolve_user_path("%COGNIA_TOOLBOX_TEST_DIR%\\demo.txt").expect("resolved env path");
        let expected = normalize_path(&temp_dir.join("demo.txt"));

        assert_eq!(resolved, expected);
        env::remove_var("COGNIA_TOOLBOX_TEST_DIR");
    }
}
