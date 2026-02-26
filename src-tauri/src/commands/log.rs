use chrono::{DateTime, NaiveDateTime, Utc};
use regex::Regex;
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use tauri::{AppHandle, Manager};
use tokio::fs;
use tokio::io::AsyncBufReadExt;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LogFileInfo {
    pub name: String,
    pub path: String,
    pub size: u64,
    pub modified: i64,
}

#[tauri::command]
pub async fn log_export(
    app: AppHandle,
    options: LogExportOptions,
) -> Result<LogExportResult, String> {
    let log_path = resolve_log_path(&app, &options.file_name).await?;

    if !log_path.exists() {
        return Err("Log file does not exist".to_string());
    }

    let file = fs::File::open(&log_path)
        .await
        .map_err(|e| format!("Failed to open log file: {}", e))?;

    let reader = tokio::io::BufReader::new(file);
    let mut lines = reader.lines();
    let mut entries: Vec<LogEntry> = Vec::new();
    let mut line_number = 0;

    let query_options = LogQueryOptions {
        file_name: options.file_name.clone(),
        level_filter: options.level_filter.clone(),
        search: options.search.clone(),
        use_regex: options.use_regex,
        start_time: options.start_time,
        end_time: options.end_time,
        limit: None,
        offset: None,
    };
    let regex = build_search_regex(
        &query_options.search,
        query_options.use_regex.unwrap_or(false),
    );

    while let Some(line) = lines
        .next_line()
        .await
        .map_err(|e| format!("Failed to read line: {}", e))?
    {
        line_number += 1;
        if let Some(entry) = parse_log_line(&line, line_number) {
            if matches_filters(&entry, &query_options, regex.as_ref()) {
                entries.push(entry);
            }
        }
    }

    let format = options
        .format
        .unwrap_or_else(|| "txt".to_string())
        .to_lowercase();
    let content = if format == "json" {
        serde_json::to_string_pretty(&entries)
            .map_err(|e| format!("Failed to serialize log export: {}", e))?
    } else {
        entries
            .iter()
            .map(|entry| {
                if entry.target.is_empty() {
                    format!(
                        "[{}][{}] {}",
                        entry.timestamp,
                        entry.level.to_uppercase(),
                        entry.message
                    )
                } else {
                    format!(
                        "[{}][{}][{}] {}",
                        entry.timestamp,
                        entry.level.to_uppercase(),
                        entry.target,
                        entry.message
                    )
                }
            })
            .collect::<Vec<String>>()
            .join("\n")
    };

    let base_name = options
        .file_name
        .clone()
        .unwrap_or_else(|| format!("cognia-logs-{}", Utc::now().format("%Y-%m-%d")));
    let extension = if format == "json" { "json" } else { "txt" };
    let file_name = if base_name.ends_with(&format!(".{extension}")) {
        base_name
    } else {
        format!("{base_name}.{extension}")
    };

    Ok(LogExportResult { content, file_name })
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LogEntry {
    pub timestamp: String,
    pub level: String,
    pub target: String,
    pub message: String,
    pub line_number: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LogQueryOptions {
    pub file_name: Option<String>,
    pub level_filter: Option<Vec<String>>,
    pub search: Option<String>,
    pub use_regex: Option<bool>,
    pub start_time: Option<i64>,
    pub end_time: Option<i64>,
    pub limit: Option<usize>,
    pub offset: Option<usize>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LogQueryResult {
    pub entries: Vec<LogEntry>,
    pub total_count: usize,
    pub has_more: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LogExportOptions {
    pub file_name: Option<String>,
    pub level_filter: Option<Vec<String>>,
    pub search: Option<String>,
    pub use_regex: Option<bool>,
    pub start_time: Option<i64>,
    pub end_time: Option<i64>,
    pub format: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LogExportResult {
    pub content: String,
    pub file_name: String,
}

fn get_log_dir(app: &AppHandle) -> Option<PathBuf> {
    app.path().app_log_dir().ok()
}

async fn resolve_log_path(app: &AppHandle, file_name: &Option<String>) -> Result<PathBuf, String> {
    let log_dir = get_log_dir(app).ok_or("Failed to get log directory")?;

    let log_path = if let Some(file_name) = file_name {
        log_dir.join(file_name)
    } else {
        let files = log_list_files(app.clone()).await?;
        if files.is_empty() {
            return Err("No log files available".to_string());
        }
        PathBuf::from(&files[0].path)
    };

    Ok(log_path)
}

fn parse_timestamp_ms(value: &str) -> Option<i64> {
    let trimmed = value.trim();
    if trimmed.is_empty() {
        return None;
    }

    if let Ok(ms) = trimmed.parse::<i64>() {
        if ms > 1_000_000_000 {
            return Some(ms);
        }
    }

    if let Ok(dt) = DateTime::parse_from_rfc3339(trimmed) {
        return Some(dt.timestamp_millis());
    }

    let formats = [
        "%Y-%m-%d %H:%M:%S%.f",
        "%Y-%m-%d %H:%M:%S",
        "%Y-%m-%dT%H:%M:%S%.f",
        "%Y-%m-%dT%H:%M:%S",
    ];

    for format in formats {
        if let Ok(dt) = NaiveDateTime::parse_from_str(trimmed, format) {
            return Some(dt.and_utc().timestamp_millis());
        }
    }

    None
}

fn build_search_regex(search: &Option<String>, use_regex: bool) -> Option<Regex> {
    if !use_regex {
        return None;
    }

    let pattern = search.as_ref()?;
    if pattern.is_empty() {
        return None;
    }

    Regex::new(pattern).ok()
}

fn matches_filters(entry: &LogEntry, options: &LogQueryOptions, regex: Option<&Regex>) -> bool {
    if let Some(ref level_filter) = options.level_filter {
        if !level_filter.is_empty() {
            let entry_level = entry.level.to_uppercase();
            if !level_filter.iter().any(|l| l.to_uppercase() == entry_level) {
                return false;
            }
        }
    }

    if let Some(ref search) = options.search {
        if !search.is_empty() {
            if let Some(regex) = regex {
                let matches = regex.is_match(&entry.message)
                    || (!entry.target.is_empty() && regex.is_match(&entry.target));
                if !matches {
                    return false;
                }
            } else {
                let search_lower = search.to_lowercase();
                let matches = entry.message.to_lowercase().contains(&search_lower)
                    || entry.target.to_lowercase().contains(&search_lower);
                if !matches {
                    return false;
                }
            }
        }
    }

    if options.start_time.is_some() || options.end_time.is_some() {
        if let Some(timestamp_ms) = parse_timestamp_ms(&entry.timestamp) {
            if let Some(start_time) = options.start_time {
                if timestamp_ms < start_time {
                    return false;
                }
            }
            if let Some(end_time) = options.end_time {
                if timestamp_ms > end_time {
                    return false;
                }
            }
        }
    }

    true
}

fn parse_log_line(line: &str, line_number: usize) -> Option<LogEntry> {
    // Parse structured log formats:
    // 1) [TIMESTAMP][LEVEL][TARGET] MESSAGE
    // 2) [DATE][TIME][TARGET][LEVEL] MESSAGE (legacy)
    //
    // Fallback for unknown lines: treat entire line as INFO message.
    let line = line.trim();
    if line.is_empty() {
        return None;
    }

    let mut parts: Vec<String> = Vec::new();
    let mut cursor = 0usize;

    while cursor < line.len() && line.as_bytes()[cursor] == b'[' {
        let remain = &line[cursor + 1..];
        let Some(close_rel) = remain.find(']') else {
            break;
        };
        let close_abs = cursor + 1 + close_rel;
        parts.push(line[cursor + 1..close_abs].to_string());
        cursor = close_abs + 1;
    }

    if parts.len() >= 3 {
        let message = line[cursor..].trim().to_string();

        // Format 1: [timestamp][level][target] message
        if is_known_level(&parts[1]) {
            return Some(LogEntry {
                timestamp: parts[0].clone(),
                level: normalize_level(&parts[1]),
                target: parts[2].clone(),
                message,
                line_number,
            });
        }

        // Format 2: [date][time][target][level] message (legacy plugin format)
        if parts.len() >= 4 && is_known_level(&parts[3]) {
            let timestamp = format!("{} {}", parts[0], parts[1]);
            return Some(LogEntry {
                timestamp,
                level: normalize_level(&parts[3]),
                target: parts[2].clone(),
                message,
                line_number,
            });
        }

        // Additional compatibility: [timestamp][target][level] message
        if parts.len() >= 3 && is_known_level(&parts[2]) {
            return Some(LogEntry {
                timestamp: parts[0].clone(),
                level: normalize_level(&parts[2]),
                target: parts[1].clone(),
                message,
                line_number,
            });
        }
    }

    // Fallback: treat entire line as message
    Some(LogEntry {
        timestamp: String::new(),
        level: "INFO".to_string(),
        target: String::new(),
        message: line.to_string(),
        line_number,
    })
}

fn is_known_level(value: &str) -> bool {
    matches!(
        value.to_uppercase().as_str(),
        "TRACE" | "DEBUG" | "INFO" | "WARN" | "ERROR"
    )
}

fn normalize_level(value: &str) -> String {
    value.to_uppercase()
}

#[tauri::command]
pub async fn log_list_files(app: AppHandle) -> Result<Vec<LogFileInfo>, String> {
    let log_dir = get_log_dir(&app).ok_or("Failed to get log directory")?;

    if !log_dir.exists() {
        return Ok(Vec::new());
    }

    let mut files = Vec::new();
    let mut entries = fs::read_dir(&log_dir)
        .await
        .map_err(|e| format!("Failed to read log directory: {}", e))?;

    while let Some(entry) = entries
        .next_entry()
        .await
        .map_err(|e| format!("Failed to read entry: {}", e))?
    {
        let path = entry.path();
        if path.extension().is_some_and(|ext| ext == "log") {
            if let Ok(metadata) = entry.metadata().await {
                let modified = metadata
                    .modified()
                    .ok()
                    .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
                    .map(|d| d.as_secs() as i64)
                    .unwrap_or(0);

                files.push(LogFileInfo {
                    name: path
                        .file_name()
                        .unwrap_or_default()
                        .to_string_lossy()
                        .to_string(),
                    path: path.to_string_lossy().to_string(),
                    size: metadata.len(),
                    modified,
                });
            }
        }
    }

    // Sort by modified time, newest first
    files.sort_by(|a, b| b.modified.cmp(&a.modified));

    Ok(files)
}

#[tauri::command]
pub async fn log_query(app: AppHandle, options: LogQueryOptions) -> Result<LogQueryResult, String> {
    let log_path = match resolve_log_path(&app, &options.file_name).await {
        Ok(path) => path,
        Err(_) => {
            return Ok(LogQueryResult {
                entries: Vec::new(),
                total_count: 0,
                has_more: false,
            });
        }
    };

    if !log_path.exists() {
        return Ok(LogQueryResult {
            entries: Vec::new(),
            total_count: 0,
            has_more: false,
        });
    }

    // Read and parse log file
    let file = fs::File::open(&log_path)
        .await
        .map_err(|e| format!("Failed to open log file: {}", e))?;

    let reader = tokio::io::BufReader::new(file);
    let mut lines = reader.lines();
    let mut all_entries = Vec::new();
    let mut line_number = 0;

    let regex = build_search_regex(&options.search, options.use_regex.unwrap_or(false));

    while let Some(line) = lines
        .next_line()
        .await
        .map_err(|e| format!("Failed to read line: {}", e))?
    {
        line_number += 1;

        if let Some(entry) = parse_log_line(&line, line_number) {
            if matches_filters(&entry, &options, regex.as_ref()) {
                all_entries.push(entry);
            }
        }
    }

    let total_count = all_entries.len();
    let offset = options.offset.unwrap_or(0);
    let limit = options.limit.unwrap_or(100);

    // Apply pagination (from end, since logs are chronological)
    let start = if total_count > offset + limit {
        total_count - offset - limit
    } else if total_count > offset {
        0
    } else {
        return Ok(LogQueryResult {
            entries: Vec::new(),
            total_count,
            has_more: false,
        });
    };

    let end = total_count.saturating_sub(offset);

    let entries: Vec<LogEntry> = all_entries[start..end].to_vec();
    let has_more = start > 0;

    Ok(LogQueryResult {
        entries,
        total_count,
        has_more,
    })
}

#[tauri::command]
pub async fn log_clear(app: AppHandle, file_name: Option<String>) -> Result<(), String> {
    let log_dir = get_log_dir(&app).ok_or("Failed to get log directory")?;

    if let Some(file_name) = file_name {
        // Clear specific file
        let log_path = log_dir.join(&file_name);
        if log_path.exists() {
            fs::remove_file(&log_path)
                .await
                .map_err(|e| format!("Failed to delete log file: {}", e))?;
        }
    } else {
        // Clear all log files except the current one
        let files = log_list_files(app.clone()).await?;
        for file in files.iter().skip(1) {
            // Skip the first (current) log file
            let path = PathBuf::from(&file.path);
            if path.exists() {
                let _ = fs::remove_file(&path).await;
            }
        }
    }

    Ok(())
}

#[tauri::command]
pub fn log_get_dir(app: AppHandle) -> Result<String, String> {
    get_log_dir(&app)
        .map(|p| p.to_string_lossy().to_string())
        .ok_or_else(|| "Failed to get log directory".to_string())
}

#[tauri::command]
pub async fn log_get_total_size(app: AppHandle) -> Result<u64, String> {
    let files = log_list_files(app).await?;
    Ok(files.iter().map(|f| f.size).sum())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parse_new_structured_log_line() {
        let line = "[2026-02-25 20:33:49.472][DEBUG][sqlx::query] query finished";
        let parsed = parse_log_line(line, 42).expect("expected parsed log line");

        assert_eq!(parsed.timestamp, "2026-02-25 20:33:49.472");
        assert_eq!(parsed.level, "DEBUG");
        assert_eq!(parsed.target, "sqlx::query");
        assert_eq!(parsed.message, "query finished");
        assert_eq!(parsed.line_number, 42);
    }

    #[test]
    fn parse_legacy_structured_log_line() {
        let line = "[2026-01-12][16:35:12][app_lib][INFO] Settings loaded successfully";
        let parsed = parse_log_line(line, 8).expect("expected parsed log line");

        assert_eq!(parsed.timestamp, "2026-01-12 16:35:12");
        assert_eq!(parsed.level, "INFO");
        assert_eq!(parsed.target, "app_lib");
        assert_eq!(parsed.message, "Settings loaded successfully");
    }

    #[test]
    fn legacy_timestamp_is_time_filterable() {
        let line = "[2026-01-12][16:35:12][app_lib][INFO] Settings loaded successfully";
        let entry = parse_log_line(line, 1).expect("expected parsed log line");
        let ts = parse_timestamp_ms(&entry.timestamp);
        assert!(ts.is_some(), "legacy timestamp should be parseable");

        let start = parse_timestamp_ms("2026-01-12 16:35:11").expect("start parse");
        let end = parse_timestamp_ms("2026-01-12 16:35:13").expect("end parse");

        let options = LogQueryOptions {
            file_name: None,
            level_filter: Some(vec!["INFO".to_string()]),
            search: None,
            use_regex: Some(false),
            start_time: Some(start),
            end_time: Some(end),
            limit: None,
            offset: None,
        };

        assert!(
            matches_filters(&entry, &options, None),
            "entry should match time and level filters"
        );
    }

    #[test]
    fn fallback_parse_for_unstructured_line() {
        let line = "plain message without brackets";
        let parsed = parse_log_line(line, 3).expect("expected fallback parsed line");

        assert_eq!(parsed.timestamp, "");
        assert_eq!(parsed.level, "INFO");
        assert_eq!(parsed.target, "");
        assert_eq!(parsed.message, line);
    }
}
