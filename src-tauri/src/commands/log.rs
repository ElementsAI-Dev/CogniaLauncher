use crate::SharedSettings;
use chrono::{DateTime, NaiveDateTime, Utc};
use flate2::read::GzDecoder;
use flate2::write::GzEncoder;
use flate2::Compression;
use regex::Regex;
use serde::{Deserialize, Serialize};
use std::collections::VecDeque;
use std::io::{BufRead, Write};
use std::path::PathBuf;
use tauri::{AppHandle, Manager};
use tokio::fs;
use tokio::io::AsyncBufReadExt;

const MAX_SCAN_LINES_LIMIT: usize = 200_000;

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
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

    let mut line_number = 0;

    let query_options = LogQueryOptions {
        file_name: options.file_name.clone(),
        level_filter: options.level_filter.clone(),
        target: options.target.clone(),
        search: options.search.clone(),
        use_regex: options.use_regex,
        start_time: options.start_time,
        end_time: options.end_time,
        limit: None,
        offset: None,
        max_scan_lines: None,
    };
    let regex = build_search_regex(
        &query_options.search,
        query_options.use_regex.unwrap_or(false),
    );

    let format = options
        .format
        .as_deref()
        .map(|value| value.to_lowercase())
        .unwrap_or_else(|| "txt".to_string());
    let export_format = match format.as_str() {
        "json" => LogExportFormat::Json,
        "csv" => LogExportFormat::Csv,
        "txt" => LogExportFormat::Txt,
        other => return Err(format!("Unsupported log export format: {other}")),
    };
    let mut content = match export_format {
        LogExportFormat::Json => String::from("[\n"),
        LogExportFormat::Csv => String::from("timestamp,level,target,message"),
        LogExportFormat::Txt => String::new(),
    };
    let mut first = true;

    if is_gzip_log(&log_path) {
        for (idx, line) in read_gzip_lines(&log_path).await?.into_iter().enumerate() {
            line_number = idx + 1;
            if let Some(entry) = parse_log_line(&line, line_number) {
                if matches_filters(&entry, &query_options, regex.as_ref()) {
                    append_export_entry(&mut content, &entry, export_format, &mut first);
                }
            }
        }
    } else {
        let file = fs::File::open(&log_path)
            .await
            .map_err(|e| format!("Failed to open log file: {}", e))?;
        let reader = tokio::io::BufReader::new(file);
        let mut lines = reader.lines();

        while let Some(line) = lines
            .next_line()
            .await
            .map_err(|e| format!("Failed to read line: {}", e))?
        {
            line_number += 1;
            if let Some(entry) = parse_log_line(&line, line_number) {
                if matches_filters(&entry, &query_options, regex.as_ref()) {
                    append_export_entry(&mut content, &entry, export_format, &mut first);
                }
            }
        }
    }

    if export_format == LogExportFormat::Json {
        if first {
            content = "[]".to_string();
        } else {
            content.push('\n');
            content.push(']');
        }
    }

    let base_name = options
        .file_name
        .clone()
        .unwrap_or_else(|| format!("cognia-logs-{}", Utc::now().format("%Y-%m-%d")));
    let extension = match export_format {
        LogExportFormat::Json => "json",
        LogExportFormat::Csv => "csv",
        LogExportFormat::Txt => "txt",
    };
    let file_name = if base_name.ends_with(&format!(".{extension}")) {
        base_name
    } else {
        format!("{base_name}.{extension}")
    };

    let diagnostic_mode = options.diagnostic_mode.unwrap_or(false);
    let sanitize_sensitive = options.sanitize_sensitive.unwrap_or(diagnostic_mode);
    let (content, redacted_count) = if sanitize_sensitive {
        redact_sensitive_text(&content)
    } else {
        (content, 0)
    };

    Ok(LogExportResult {
        size_bytes: content.len(),
        status: if redacted_count > 0 {
            "partial_success".to_string()
        } else {
            "success".to_string()
        },
        redacted_count,
        sanitized: sanitize_sensitive,
        warnings: Vec::new(),
        content,
        file_name,
    })
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
    pub target: Option<String>,
    pub search: Option<String>,
    pub use_regex: Option<bool>,
    pub start_time: Option<i64>,
    pub end_time: Option<i64>,
    pub limit: Option<usize>,
    pub offset: Option<usize>,
    pub max_scan_lines: Option<usize>,
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
    pub target: Option<String>,
    pub search: Option<String>,
    pub use_regex: Option<bool>,
    pub start_time: Option<i64>,
    pub end_time: Option<i64>,
    pub format: Option<String>,
    pub diagnostic_mode: Option<bool>,
    pub sanitize_sensitive: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LogExportResult {
    pub size_bytes: usize,
    pub status: String,
    pub redacted_count: usize,
    pub sanitized: bool,
    pub warnings: Vec<String>,
    pub content: String,
    pub file_name: String,
}

fn is_gzip_log(path: &std::path::Path) -> bool {
    path.to_string_lossy().ends_with(".log.gz")
}

fn read_gzip_lines_sync(path: &std::path::Path) -> Result<Vec<String>, String> {
    let file = std::fs::File::open(path)
        .map_err(|e| format!("Failed to open compressed log file: {}", e))?;
    let decoder = GzDecoder::new(file);
    let reader = std::io::BufReader::new(decoder);

    reader
        .lines()
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| format!("Failed to read compressed log file: {}", e))
}

async fn read_gzip_lines(path: &std::path::Path) -> Result<Vec<String>, String> {
    let path = path.to_path_buf();
    tokio::task::spawn_blocking(move || read_gzip_lines_sync(&path))
        .await
        .map_err(|e| format!("Failed to join compressed log read task: {}", e))?
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum LogExportFormat {
    Txt,
    Json,
    Csv,
}

fn append_export_entry(
    content: &mut String,
    entry: &LogEntry,
    format: LogExportFormat,
    first: &mut bool,
) {
    if format == LogExportFormat::Json {
        if !*first {
            content.push_str(",\n");
        }
        content.push_str("  ");
        content.push_str(&serde_json::to_string(entry).unwrap_or_else(|_| "{}".to_string()));
        *first = false;
        return;
    }

    if format == LogExportFormat::Csv {
        content.push('\n');

        let timestamp = entry.timestamp.replace('"', "\"\"");
        let level = entry.level.to_uppercase().replace('"', "\"\"");
        let target = entry.target.replace('"', "\"\"");
        let message = entry.message.replace('"', "\"\"");

        content.push_str(&format!(
            "\"{}\",\"{}\",\"{}\",\"{}\"",
            timestamp, level, target, message
        ));
        *first = false;
        return;
    }

    if !*first {
        content.push('\n');
    }
    if entry.target.is_empty() {
        content.push_str(&format!(
            "[{}][{}] {}",
            entry.timestamp,
            entry.level.to_uppercase(),
            entry.message
        ));
    } else {
        content.push_str(&format!(
            "[{}][{}][{}] {}",
            entry.timestamp,
            entry.level.to_uppercase(),
            entry.target,
            entry.message
        ));
    }
    *first = false;
}

fn redact_sensitive_text(input: &str) -> (String, usize) {
    let mut result = input.to_string();
    let mut redacted_count = 0usize;

    if let Ok(key_value_regex) =
        Regex::new(r"(?i)\b(token|secret|api[_-]?key|password)\b\s*[:=]\s*([^\s,;]+)")
    {
        redacted_count += key_value_regex.find_iter(&result).count();
        result = key_value_regex
            .replace_all(&result, |caps: &regex::Captures| {
                format!("{}=<redacted>", &caps[1])
            })
            .to_string();
    }

    if let Ok(bearer_regex) = Regex::new(r"(?i)\bbearer\s+[A-Za-z0-9._\-]+") {
        redacted_count += bearer_regex.find_iter(&result).count();
        result = bearer_regex
            .replace_all(&result, "Bearer <redacted>")
            .to_string();
    }

    (result, redacted_count)
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

fn cap_max_scan_lines(max_scan_lines: Option<usize>) -> Option<usize> {
    max_scan_lines.map(|value| value.min(MAX_SCAN_LINES_LIMIT))
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

    if let Some(ref target) = options.target {
        if !target.is_empty() && !entry.target.contains(target) {
            return false;
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
        let is_log = path.extension().is_some_and(|ext| ext == "log");
        let is_gz = path.to_string_lossy().ends_with(".log.gz");
        if is_log || is_gz {
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

/// Check whether the query has any active filters (level, search, time).
fn has_active_filters(options: &LogQueryOptions) -> bool {
    if let Some(ref levels) = options.level_filter {
        if !levels.is_empty() {
            return true;
        }
    }
    if let Some(ref target) = options.target {
        if !target.is_empty() {
            return true;
        }
    }
    if let Some(ref search) = options.search {
        if !search.is_empty() {
            return true;
        }
    }
    if options.start_time.is_some() || options.end_time.is_some() {
        return true;
    }
    false
}

fn push_window_entry(window: &mut VecDeque<LogEntry>, need: usize, entry: LogEntry) {
    if need == 0 {
        return;
    }
    if window.len() == need {
        let _ = window.pop_front();
    }
    window.push_back(entry);
}

fn push_tail_line(
    tail: &mut VecDeque<(usize, String)>,
    max_scan_lines: usize,
    line_number: usize,
    line: String,
) {
    if max_scan_lines == 0 {
        return;
    }
    if tail.len() == max_scan_lines {
        let _ = tail.pop_front();
    }
    tail.push_back((line_number, line));
}

async fn collect_tail_lines_with_numbers(
    path: &std::path::Path,
    max_scan_lines: usize,
) -> Result<Vec<(usize, String)>, String> {
    if max_scan_lines == 0 {
        return Ok(Vec::new());
    }

    let file = fs::File::open(path)
        .await
        .map_err(|e| format!("Failed to open log file: {}", e))?;
    let reader = tokio::io::BufReader::new(file);
    let mut lines = reader.lines();
    let mut line_number = 0usize;
    let mut tail: VecDeque<(usize, String)> =
        VecDeque::with_capacity(max_scan_lines.saturating_add(1));

    while let Some(line) = lines
        .next_line()
        .await
        .map_err(|e| format!("Failed to read line: {}", e))?
    {
        line_number += 1;
        push_tail_line(&mut tail, max_scan_lines, line_number, line);
    }

    Ok(tail.into_iter().collect())
}

fn build_query_result_from_window(
    window: &VecDeque<LogEntry>,
    total_count: usize,
    offset: usize,
    limit: usize,
) -> LogQueryResult {
    if total_count <= offset {
        return LogQueryResult {
            entries: Vec::new(),
            total_count,
            has_more: false,
        };
    }

    let window_len = window.len();
    let end = window_len.saturating_sub(offset);
    let start = end.saturating_sub(limit);
    let entries = window
        .iter()
        .skip(start)
        .take(end.saturating_sub(start))
        .cloned()
        .collect::<Vec<_>>();
    let has_more = total_count > offset.saturating_add(limit);

    LogQueryResult {
        entries,
        total_count,
        has_more,
    }
}

fn query_from_cached_lines(
    lines: &[String],
    options: &LogQueryOptions,
    regex: Option<&Regex>,
    filtered: bool,
    offset: usize,
    limit: usize,
) -> LogQueryResult {
    let need = offset.saturating_add(limit);
    let mut window: VecDeque<LogEntry> = VecDeque::with_capacity(need.saturating_add(1));
    let mut total_count = 0usize;

    if filtered {
        let skip_lines = options
            .max_scan_lines
            .map(|max_scan| lines.len().saturating_sub(max_scan))
            .unwrap_or(0);

        for (idx, line) in lines.iter().enumerate().skip(skip_lines) {
            let line_number = idx + 1;
            if let Some(entry) = parse_log_line(line, line_number) {
                if matches_filters(&entry, options, regex) {
                    total_count += 1;
                    push_window_entry(&mut window, need, entry);
                }
            }
        }
    } else {
        for (idx, line) in lines.iter().enumerate() {
            let line_number = idx + 1;
            if let Some(entry) = parse_log_line(line, line_number) {
                total_count += 1;
                push_window_entry(&mut window, need, entry);
            }
        }
    }

    build_query_result_from_window(&window, total_count, offset, limit)
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

    let mut effective_options = options.clone();
    effective_options.max_scan_lines = cap_max_scan_lines(options.max_scan_lines);

    let offset = effective_options.offset.unwrap_or(0);
    let limit = effective_options.limit.unwrap_or(100);
    let regex = build_search_regex(
        &effective_options.search,
        effective_options.use_regex.unwrap_or(false),
    );
    let filtered = has_active_filters(&effective_options);

    if is_gzip_log(&log_path) {
        let lines = read_gzip_lines(&log_path).await?;
        return Ok(query_from_cached_lines(
            &lines,
            &effective_options,
            regex.as_ref(),
            filtered,
            offset,
            limit,
        ));
    }

    if filtered {
        // With filters + tail scan: keep only the newest max_scan_lines using a single pass,
        // then parse/filter just that tail window.
        if let Some(max_scan_lines) = effective_options.max_scan_lines {
            let need = offset.saturating_add(limit);
            let mut window: VecDeque<LogEntry> = VecDeque::with_capacity(need.saturating_add(1));
            let mut total_count = 0usize;
            let tail_lines = collect_tail_lines_with_numbers(&log_path, max_scan_lines).await?;

            for (line_number, line) in tail_lines {
                if let Some(entry) = parse_log_line(&line, line_number) {
                    if matches_filters(&entry, &effective_options, regex.as_ref()) {
                        total_count += 1;
                        push_window_entry(&mut window, need, entry);
                    }
                }
            }

            return Ok(build_query_result_from_window(
                &window,
                total_count,
                offset,
                limit,
            ));
        }

        let need = offset.saturating_add(limit);
        let mut window: VecDeque<LogEntry> = VecDeque::with_capacity(need.saturating_add(1));
        let mut total_count = 0usize;
        let file = fs::File::open(&log_path)
            .await
            .map_err(|e| format!("Failed to open log file: {}", e))?;
        let reader = tokio::io::BufReader::new(file);
        let mut lines = reader.lines();
        let mut line_number = 0usize;

        while let Some(line) = lines
            .next_line()
            .await
            .map_err(|e| format!("Failed to read line: {}", e))?
        {
            line_number += 1;
            if let Some(entry) = parse_log_line(&line, line_number) {
                if matches_filters(&entry, &effective_options, regex.as_ref()) {
                    total_count += 1;
                    push_window_entry(&mut window, need, entry);
                }
            }
        }

        Ok(build_query_result_from_window(
            &window,
            total_count,
            offset,
            limit,
        ))
    } else {
        // No filters: collect all parsed entries into a ring buffer of the last (offset + limit)
        // entries, avoiding storing the entire file in memory for large files.
        let need = offset.saturating_add(limit);
        let mut ring: VecDeque<LogEntry> = VecDeque::with_capacity(need.saturating_add(1));
        let mut total_count = 0usize;
        let file = fs::File::open(&log_path)
            .await
            .map_err(|e| format!("Failed to open log file: {}", e))?;
        let reader = tokio::io::BufReader::new(file);
        let mut lines = reader.lines();
        let mut line_number = 0usize;

        while let Some(line) = lines
            .next_line()
            .await
            .map_err(|e| format!("Failed to read line: {}", e))?
        {
            line_number += 1;
            if let Some(entry) = parse_log_line(&line, line_number) {
                total_count += 1;
                push_window_entry(&mut ring, need, entry);
            }
        }

        Ok(build_query_result_from_window(
            &ring,
            total_count,
            offset,
            limit,
        ))
    }
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

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LogCleanupResult {
    pub deleted_count: usize,
    pub freed_bytes: u64,
    pub status: String,
    pub warnings: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LogCleanupPreviewResult {
    pub deleted_count: usize,
    pub freed_bytes: u64,
    pub protected_count: usize,
    pub status: String,
    pub warnings: Vec<String>,
}

#[tauri::command]
pub async fn log_cleanup(
    app: AppHandle,
    settings: tauri::State<'_, SharedSettings>,
) -> Result<LogCleanupResult, String> {
    let settings_guard = settings.read().await;
    let max_retention_days = settings_guard.log.max_retention_days;
    let max_total_size_mb = settings_guard.log.max_total_size_mb;
    drop(settings_guard);

    cleanup_logs_with_policy(&app, max_retention_days, max_total_size_mb).await
}

#[tauri::command]
pub async fn log_cleanup_preview(
    app: AppHandle,
    settings: tauri::State<'_, SharedSettings>,
) -> Result<LogCleanupPreviewResult, String> {
    let settings_guard = settings.read().await;
    let max_retention_days = settings_guard.log.max_retention_days;
    let max_total_size_mb = settings_guard.log.max_total_size_mb;
    drop(settings_guard);

    cleanup_preview_with_policy(&app, max_retention_days, max_total_size_mb).await
}

#[tauri::command]
pub async fn log_delete_file(app: AppHandle, file_name: String) -> Result<(), String> {
    let log_dir = get_log_dir(&app).ok_or("Failed to get log directory")?;
    let log_path = log_dir.join(&file_name);

    if !log_path.exists() {
        return Err(format!("Log file does not exist: {}", file_name));
    }

    // Don't allow deleting the current session log (newest file)
    let files = log_list_files(app).await?;
    if let Some(first) = files.first() {
        if first.name == file_name {
            return Err("Cannot delete the current session log file".to_string());
        }
    }

    fs::remove_file(&log_path)
        .await
        .map_err(|e| format!("Failed to delete log file: {}", e))
}

#[tauri::command]
pub async fn log_delete_batch(
    app: AppHandle,
    file_names: Vec<String>,
) -> Result<LogCleanupResult, String> {
    let log_dir = get_log_dir(&app).ok_or("Failed to get log directory")?;

    // Get the current session log to protect it
    let files = log_list_files(app).await?;
    let current_log = files.first().map(|f| f.name.clone());

    let mut deleted_count = 0usize;
    let mut freed_bytes = 0u64;
    let mut warnings = Vec::new();

    for name in &file_names {
        if current_log.as_deref() == Some(name.as_str()) {
            warnings.push(format!(
                "Skipped current session log file: {}",
                name
            ));
            continue; // Skip current session log
        }
        let path = log_dir.join(name);
        if path.exists() {
            if let Ok(meta) = fs::metadata(&path).await {
                freed_bytes += meta.len();
            }
            match fs::remove_file(&path).await {
                Ok(()) => {
                    deleted_count += 1;
                }
                Err(err) => {
                    warnings.push(format!("Failed to delete {}: {}", name, err));
                }
            }
        }
    }

    Ok(LogCleanupResult {
        deleted_count,
        freed_bytes,
        status: if warnings.is_empty() {
            "success".to_string()
        } else if deleted_count > 0 {
            "partial_success".to_string()
        } else {
            "failed".to_string()
        },
        warnings,
    })
}

/// Compress a .log file to .log.gz synchronously, removing the original on success.
/// Returns the bytes saved (original_size - compressed_size), or 0 on failure.
fn compress_log_file(path: &std::path::Path) -> u64 {
    let original_size = match std::fs::metadata(path) {
        Ok(m) => m.len(),
        Err(_) => return 0,
    };

    let input = match std::fs::read(path) {
        Ok(data) => data,
        Err(_) => return 0,
    };

    let gz_path = path.with_extension("log.gz");
    let file = match std::fs::File::create(&gz_path) {
        Ok(f) => f,
        Err(_) => return 0,
    };

    let mut encoder = GzEncoder::new(file, Compression::default());
    if encoder.write_all(&input).is_err() {
        let _ = std::fs::remove_file(&gz_path);
        return 0;
    }
    if encoder.finish().is_err() {
        let _ = std::fs::remove_file(&gz_path);
        return 0;
    }

    let compressed_size = std::fs::metadata(&gz_path).map(|m| m.len()).unwrap_or(0);
    if compressed_size == 0 {
        let _ = std::fs::remove_file(&gz_path);
        return 0;
    }

    // Remove original .log file
    let _ = std::fs::remove_file(path);
    original_size.saturating_sub(compressed_size)
}

const COMPRESS_AFTER_DAYS: i64 = 7;

/// Run log cleanup based on retention policy. Called at startup and on demand.
/// Files older than 7 days are compressed to .log.gz before retention/size checks.
pub async fn cleanup_logs_with_policy(
    app: &AppHandle,
    max_retention_days: u32,
    max_total_size_mb: u32,
) -> Result<LogCleanupResult, String> {
    let files = log_list_files(app.clone()).await?;
    if files.len() <= 1 {
        return Ok(LogCleanupResult {
            deleted_count: 0,
            freed_bytes: 0,
            status: "success".to_string(),
            warnings: Vec::new(),
        });
    }

    let log_dir = get_log_dir(app).ok_or("Failed to get log directory")?;
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs() as i64;

    let mut deleted_count = 0usize;
    let mut freed_bytes = 0u64;
    let mut warnings = Vec::new();
    let mut remaining_size: u64 = files.iter().map(|f| f.size).sum();
    let max_total_bytes = (max_total_size_mb as u64) * 1024 * 1024;

    // Skip the first file (current session log, newest)
    for file in files.iter().skip(1).rev() {
        let age_days = (now - file.modified) / 86400;
        let path = log_dir.join(&file.name);

        // Compress uncompressed files older than COMPRESS_AFTER_DAYS
        if age_days > COMPRESS_AFTER_DAYS
            && file.name.ends_with(".log")
            && !file.name.ends_with(".log.gz")
        {
            let path_for_compress = path.clone();
            let saved = tokio::task::spawn_blocking(move || compress_log_file(&path_for_compress))
                .await
                .unwrap_or(0);
            if saved > 0 {
                freed_bytes += saved;
                remaining_size -= saved;
            }
            continue; // Don't delete right after compressing
        }

        let mut should_delete = false;

        // Check retention days (0 = unlimited)
        if max_retention_days > 0 && age_days > max_retention_days as i64 {
            should_delete = true;
        }

        // Check total size limit (0 = unlimited)
        if !should_delete && max_total_bytes > 0 && remaining_size > max_total_bytes {
            should_delete = true;
        }

        if should_delete {
            match fs::remove_file(&path).await {
                Ok(()) => {
                    deleted_count += 1;
                    freed_bytes += file.size;
                    remaining_size -= file.size;
                }
                Err(err) => {
                    warnings.push(format!("Failed to delete {}: {}", file.name, err));
                }
            }
        }
    }

    Ok(LogCleanupResult {
        deleted_count,
        freed_bytes,
        status: if warnings.is_empty() {
            "success".to_string()
        } else if deleted_count > 0 {
            "partial_success".to_string()
        } else {
            "failed".to_string()
        },
        warnings,
    })
}

fn preview_cleanup_from_files(
    files: &[LogFileInfo],
    now: i64,
    max_retention_days: u32,
    max_total_size_mb: u32,
) -> LogCleanupPreviewResult {
    if files.is_empty() {
        return LogCleanupPreviewResult {
            deleted_count: 0,
            freed_bytes: 0,
            protected_count: 0,
            status: "success".to_string(),
            warnings: Vec::new(),
        };
    }

    let mut deleted_count = 0usize;
    let mut freed_bytes = 0u64;
    let mut remaining_size: u64 = files.iter().map(|f| f.size).sum();
    let max_total_bytes = (max_total_size_mb as u64) * 1024 * 1024;

    // Skip the first file (current session log, newest)
    for file in files.iter().skip(1).rev() {
        let age_days = (now - file.modified) / 86400;
        let mut should_delete = false;

        if max_retention_days > 0 && age_days > max_retention_days as i64 {
            should_delete = true;
        }

        if !should_delete && max_total_bytes > 0 && remaining_size > max_total_bytes {
            should_delete = true;
        }

        if should_delete {
            deleted_count += 1;
            freed_bytes += file.size;
            remaining_size = remaining_size.saturating_sub(file.size);
        }
    }

    LogCleanupPreviewResult {
        deleted_count,
        freed_bytes,
        protected_count: 1,
        status: "success".to_string(),
        warnings: Vec::new(),
    }
}

pub async fn cleanup_preview_with_policy(
    app: &AppHandle,
    max_retention_days: u32,
    max_total_size_mb: u32,
) -> Result<LogCleanupPreviewResult, String> {
    let files = log_list_files(app.clone()).await?;
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs() as i64;
    Ok(preview_cleanup_from_files(
        &files,
        now,
        max_retention_days,
        max_total_size_mb,
    ))
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
            target: None,
            search: None,
            use_regex: Some(false),
            start_time: Some(start),
            end_time: Some(end),
            limit: None,
            offset: None,
            max_scan_lines: None,
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

    #[test]
    fn read_gzip_lines_sync_reads_lines() {
        let unique = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .expect("system time")
            .as_nanos();
        let path = std::env::temp_dir().join(format!("cognia-log-test-{unique}.log.gz"));

        let file = std::fs::File::create(&path).expect("create gzip test file");
        let mut encoder = GzEncoder::new(file, Compression::default());
        encoder
            .write_all(b"line-one\nline-two\n")
            .expect("write gzip payload");
        encoder.finish().expect("finalize gzip payload");

        let lines = read_gzip_lines_sync(&path).expect("read gzip lines");
        assert_eq!(lines, vec!["line-one".to_string(), "line-two".to_string()]);

        let _ = std::fs::remove_file(&path);
    }

    #[test]
    fn query_from_cached_lines_respects_window_and_tail_scan() {
        let lines = (1..=10)
            .map(|i| format!("[2026-03-04 08:00:{i:02}.000][INFO][app] msg-{i}"))
            .collect::<Vec<_>>();

        let options = LogQueryOptions {
            file_name: None,
            level_filter: Some(vec!["INFO".to_string()]),
            target: None,
            search: Some("msg-".to_string()),
            use_regex: Some(false),
            start_time: None,
            end_time: None,
            limit: Some(2),
            offset: Some(1),
            max_scan_lines: Some(5),
        };

        let result = query_from_cached_lines(&lines, &options, None, true, 1, 2);
        let messages = result
            .entries
            .iter()
            .map(|entry| entry.message.clone())
            .collect::<Vec<_>>();

        assert_eq!(result.total_count, 5);
        assert!(result.has_more);
        assert_eq!(messages, vec!["msg-8".to_string(), "msg-9".to_string()]);
    }

    #[test]
    fn push_tail_line_keeps_latest_window() {
        let mut tail: VecDeque<(usize, String)> = VecDeque::new();
        for i in 1..=5 {
            push_tail_line(&mut tail, 3, i, format!("line-{i}"));
        }

        let result = tail.into_iter().collect::<Vec<_>>();
        assert_eq!(
            result,
            vec![
                (3, "line-3".to_string()),
                (4, "line-4".to_string()),
                (5, "line-5".to_string()),
            ]
        );
    }

    #[test]
    fn push_tail_line_ignores_zero_max_scan() {
        let mut tail: VecDeque<(usize, String)> = VecDeque::new();
        push_tail_line(&mut tail, 0, 1, "line-1".to_string());
        assert!(tail.is_empty());
    }

    #[test]
    fn cap_max_scan_lines_enforces_upper_bound() {
        assert_eq!(cap_max_scan_lines(Some(MAX_SCAN_LINES_LIMIT + 123)), Some(MAX_SCAN_LINES_LIMIT));
        assert_eq!(cap_max_scan_lines(Some(10_000)), Some(10_000));
        assert_eq!(cap_max_scan_lines(None), None);
    }

    #[test]
    fn target_filter_matches_expected_entries() {
        let entry = parse_log_line(
            "[2026-03-01 10:00:00.000][INFO][network::http] request complete",
            1,
        )
        .expect("expected parsed log line");

        let matching_options = LogQueryOptions {
            file_name: None,
            level_filter: Some(vec!["INFO".to_string()]),
            target: Some("network".to_string()),
            search: None,
            use_regex: Some(false),
            start_time: None,
            end_time: None,
            limit: None,
            offset: None,
            max_scan_lines: None,
        };
        assert!(matches_filters(&entry, &matching_options, None));

        let mismatching_options = LogQueryOptions {
            target: Some("database".to_string()),
            ..matching_options
        };
        assert!(!matches_filters(&entry, &mismatching_options, None));
    }

    #[test]
    fn csv_export_rows_escape_quotes_and_include_header() {
        let entry = LogEntry {
            timestamp: "2026-03-01T10:00:00.000Z".to_string(),
            level: "info".to_string(),
            target: "service\"core".to_string(),
            message: "hello,\"world\"".to_string(),
            line_number: 1,
        };

        let mut content = "timestamp,level,target,message".to_string();
        let mut first = true;
        append_export_entry(&mut content, &entry, LogExportFormat::Csv, &mut first);

        assert_eq!(
            content,
            "timestamp,level,target,message\n\"2026-03-01T10:00:00.000Z\",\"INFO\",\"service\"\"core\",\"hello,\"\"world\"\"\""
        );
    }

    #[test]
    fn cleanup_preview_is_non_mutating_and_protects_current_session() {
        let now = 1_800_000_000i64;
        let files = vec![
            LogFileInfo {
                name: "current.log".to_string(),
                path: "/tmp/current.log".to_string(),
                size: 400,
                modified: now,
            },
            LogFileInfo {
                name: "old.log".to_string(),
                path: "/tmp/old.log".to_string(),
                size: 600,
                modified: now - 40 * 86_400,
            },
        ];
        let snapshot = files.clone();

        let preview = preview_cleanup_from_files(&files, now, 7, 0);
        assert_eq!(preview.deleted_count, 1);
        assert_eq!(preview.freed_bytes, 600);
        assert_eq!(preview.protected_count, 1);
        assert_eq!(preview.status, "success");

        // Ensure preview path does not mutate source file metadata.
        assert_eq!(files, snapshot);
    }

    #[test]
    fn diagnostic_redaction_summary_metadata_is_emitted() {
        let input = "token=abc123\nAuthorization: Bearer my-secret-token";
        let (sanitized, redacted_count) = redact_sensitive_text(input);
        assert!(redacted_count >= 2);
        assert!(sanitized.contains("token=<redacted>"));
        assert!(sanitized.contains("Bearer <redacted>"));

        let payload = serde_json::to_value(LogExportResult {
            size_bytes: sanitized.len(),
            status: "partial_success".to_string(),
            redacted_count,
            sanitized: true,
            warnings: Vec::new(),
            content: sanitized,
            file_name: "diagnostic.log".to_string(),
        })
        .expect("serialize export payload");

        assert_eq!(payload["status"], "partial_success");
        assert!(payload["redactedCount"].as_u64().unwrap_or(0) >= 2);
        assert_eq!(payload["sanitized"], true);
        assert!(payload["sizeBytes"].as_u64().unwrap_or(0) > 0);
    }
}
