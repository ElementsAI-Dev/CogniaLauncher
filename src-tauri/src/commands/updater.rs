use crate::config::{UpdateSettings, UpdateSourceMode};
use crate::SharedSettings;
use reqwest::Url;
use serde::Serialize;
use tauri::{AppHandle, Emitter, Manager};
use tauri_plugin_updater::{Error as UpdaterError, Update, Updater, UpdaterExt};

const EMBEDDED_OFFICIAL_ENDPOINTS: &[&str] = &[
    "https://github.com/ElementAstro/CogniaLauncher/releases/latest/download/latest.json",
];
const EMBEDDED_MIRROR_ENDPOINTS: &[&str] = &[
    "https://gh-proxy.com/https://github.com/ElementAstro/CogniaLauncher/releases/latest/download/latest.json",
];

#[derive(Serialize, Clone)]
pub struct SelfUpdateInfo {
    pub current_version: String,
    pub latest_version: Option<String>,
    pub update_available: bool,
    pub release_notes: Option<String>,
    pub selected_source: Option<String>,
    pub attempted_sources: Vec<String>,
    pub error_category: Option<String>,
    pub error_message: Option<String>,
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct SelfUpdateProgressEvent {
    pub progress: Option<u32>,
    pub status: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub selected_source: Option<String>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub attempted_sources: Vec<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error_category: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error_message: Option<String>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum UpdateSourceKind {
    Official,
    Mirror,
    Custom,
}

impl UpdateSourceKind {
    fn as_str(self) -> &'static str {
        match self {
            Self::Official => "official",
            Self::Mirror => "mirror",
            Self::Custom => "custom",
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum UpdateErrorCategory {
    SourceUnavailable,
    Network,
    Timeout,
    Validation,
    Signature,
    NoUpdate,
    Unknown,
}

impl UpdateErrorCategory {
    fn as_str(self) -> &'static str {
        match self {
            Self::SourceUnavailable => "source_unavailable",
            Self::Network => "network",
            Self::Timeout => "timeout",
            Self::Validation => "validation",
            Self::Signature => "signature",
            Self::NoUpdate => "no_update",
            Self::Unknown => "unknown",
        }
    }
}

#[derive(Debug, Clone)]
enum EndpointStrategy {
    Default,
    Override(Vec<Url>),
}

#[derive(Debug, Clone)]
struct UpdateSourceCandidate {
    source: UpdateSourceKind,
    strategy: EndpointStrategy,
}

impl UpdateSourceCandidate {
    fn official() -> Self {
        Self {
            source: UpdateSourceKind::Official,
            strategy: EndpointStrategy::Default,
        }
    }

    fn mirror() -> Self {
        Self {
            source: UpdateSourceKind::Mirror,
            strategy: EndpointStrategy::Override(parse_static_endpoints(EMBEDDED_MIRROR_ENDPOINTS)),
        }
    }

    fn custom(endpoints: Vec<Url>) -> Self {
        Self {
            source: UpdateSourceKind::Custom,
            strategy: EndpointStrategy::Override(endpoints),
        }
    }
}

#[derive(Debug, Clone)]
struct UpdateSourceFailure {
    source: UpdateSourceKind,
    category: UpdateErrorCategory,
    message: String,
}

impl UpdateSourceFailure {
    fn new(source: UpdateSourceKind, category: UpdateErrorCategory, message: String) -> Self {
        Self {
            source,
            category,
            message,
        }
    }
}

fn parse_static_endpoints(values: &[&str]) -> Vec<Url> {
    values
        .iter()
        .map(|value| Url::parse(value).expect("embedded updater endpoint must be valid URL"))
        .collect()
}

fn parse_custom_endpoints(endpoints: &[String]) -> Vec<Url> {
    endpoints
        .iter()
        .filter_map(|value| match Url::parse(value) {
            Ok(url) => Some(url),
            Err(error) => {
                log::warn!("Ignoring invalid custom updater endpoint '{}': {}", value, error);
                None
            }
        })
        .collect()
}

fn resolve_update_source_candidates(update_settings: &UpdateSettings) -> Vec<UpdateSourceCandidate> {
    let mut candidates = Vec::new();

    match update_settings.source_mode {
        UpdateSourceMode::Official => candidates.push(UpdateSourceCandidate::official()),
        UpdateSourceMode::Mirror => candidates.push(UpdateSourceCandidate::mirror()),
        UpdateSourceMode::Custom => candidates.push(UpdateSourceCandidate::custom(
            parse_custom_endpoints(&update_settings.custom_endpoints),
        )),
    }

    if update_settings.fallback_to_official && !matches!(update_settings.source_mode, UpdateSourceMode::Official) {
        candidates.push(UpdateSourceCandidate::official());
    }

    if candidates.is_empty() {
        candidates.push(UpdateSourceCandidate::official());
    }

    candidates
}

fn push_attempted_source(attempted: &mut Vec<UpdateSourceKind>, source: UpdateSourceKind) {
    if !attempted.contains(&source) {
        attempted.push(source);
    }
}

fn attempted_source_labels(attempted: &[UpdateSourceKind]) -> Vec<String> {
    attempted
        .iter()
        .map(|source| source.as_str().to_string())
        .collect()
}

fn is_timeout_message(message: &str) -> bool {
    let normalized = message.to_ascii_lowercase();
    normalized.contains("timed out") || normalized.contains("timeout")
}

fn categorize_updater_error(error: &UpdaterError) -> UpdateErrorCategory {
    match error {
        UpdaterError::EmptyEndpoints
        | UpdaterError::ReleaseNotFound
        | UpdaterError::TargetNotFound(_)
        | UpdaterError::TargetsNotFound(_)
        | UpdaterError::UnsupportedArch
        | UpdaterError::UnsupportedOs
        | UpdaterError::FailedToDetermineExtractPath
        | UpdaterError::TempDirNotFound
        | UpdaterError::TempDirNotOnSameMountPoint
        | UpdaterError::DebInstallFailed
        | UpdaterError::PackageInstallFailed
        | UpdaterError::AuthenticationFailed => UpdateErrorCategory::SourceUnavailable,
        UpdaterError::Reqwest(error) => {
            if error.is_timeout() || is_timeout_message(&error.to_string()) {
                UpdateErrorCategory::Timeout
            } else {
                UpdateErrorCategory::Network
            }
        }
        UpdaterError::Network(message) => {
            if is_timeout_message(message) {
                UpdateErrorCategory::Timeout
            } else {
                UpdateErrorCategory::Network
            }
        }
        UpdaterError::Minisign(_)
        | UpdaterError::Base64(_)
        | UpdaterError::SignatureUtf8(_) => UpdateErrorCategory::Signature,
        UpdaterError::Semver(_)
        | UpdaterError::Serialization(_)
        | UpdaterError::UrlParse(_)
        | UpdaterError::BinaryNotFoundInArchive
        | UpdaterError::InvalidUpdaterFormat
        | UpdaterError::FormatDate
        | UpdaterError::InsecureTransportProtocol => UpdateErrorCategory::Validation,
        _ => UpdateErrorCategory::Unknown,
    }
}

fn build_updater_with_endpoints(app: &AppHandle, endpoints: Vec<Url>) -> Result<Updater, UpdaterError> {
    app.updater_builder().endpoints(endpoints)?.build()
}

fn build_updater_for_candidate(
    app: &AppHandle,
    candidate: &UpdateSourceCandidate,
) -> Result<Updater, UpdateSourceFailure> {
    let build_result = match &candidate.strategy {
        EndpointStrategy::Override(endpoints) => build_updater_with_endpoints(app, endpoints.clone()),
        EndpointStrategy::Default => match app.updater_builder().build() {
            Ok(updater) => Ok(updater),
            Err(UpdaterError::EmptyEndpoints) => {
                let embedded = parse_static_endpoints(EMBEDDED_OFFICIAL_ENDPOINTS);
                build_updater_with_endpoints(app, embedded)
            }
            Err(error) => Err(error),
        },
    };

    build_result.map_err(|error| {
        UpdateSourceFailure::new(
            candidate.source,
            categorize_updater_error(&error),
            error.to_string(),
        )
    })
}

async fn check_candidate_for_update(
    app: &AppHandle,
    candidate: &UpdateSourceCandidate,
) -> Result<Option<Update>, UpdateSourceFailure> {
    let updater = build_updater_for_candidate(app, candidate)?;
    updater.check().await.map_err(|error| {
        UpdateSourceFailure::new(
            candidate.source,
            categorize_updater_error(&error),
            error.to_string(),
        )
    })
}

fn build_self_update_info(
    current_version: &str,
    latest_version: Option<String>,
    update_available: bool,
    release_notes: Option<String>,
    selected_source: Option<UpdateSourceKind>,
    attempted_sources: &[UpdateSourceKind],
    failure: Option<&UpdateSourceFailure>,
) -> SelfUpdateInfo {
    SelfUpdateInfo {
        current_version: current_version.to_string(),
        latest_version,
        update_available,
        release_notes,
        selected_source: selected_source.map(|source| source.as_str().to_string()),
        attempted_sources: attempted_source_labels(attempted_sources),
        error_category: failure.map(|failure| failure.category.as_str().to_string()),
        error_message: failure.map(|failure| failure.message.clone()),
    }
}

fn build_progress_event(
    status: &str,
    progress: Option<u32>,
    selected_source: Option<UpdateSourceKind>,
    attempted_sources: &[UpdateSourceKind],
    failure: Option<&UpdateSourceFailure>,
) -> SelfUpdateProgressEvent {
    SelfUpdateProgressEvent {
        progress,
        status: status.to_string(),
        selected_source: selected_source.map(|source| source.as_str().to_string()),
        attempted_sources: attempted_source_labels(attempted_sources),
        error_category: failure.map(|failure| failure.category.as_str().to_string()),
        error_message: failure.map(|failure| failure.message.clone()),
    }
}

fn emit_update_progress(
    app: &AppHandle,
    status: &str,
    progress: Option<u32>,
    selected_source: Option<UpdateSourceKind>,
    attempted_sources: &[UpdateSourceKind],
    failure: Option<&UpdateSourceFailure>,
) {
    let _ = app.emit(
        "self-update-progress",
        build_progress_event(
            status,
            progress,
            selected_source,
            attempted_sources,
            failure,
        ),
    );
}

fn format_failure_message(failure: &UpdateSourceFailure, attempted_sources: &[UpdateSourceKind]) -> String {
    let attempted = attempted_source_labels(attempted_sources).join(",");
    let attempted = if attempted.is_empty() {
        "none".to_string()
    } else {
        attempted
    };

    format!(
        "{}: {} (selected_source={}, attempted_sources={})",
        failure.category.as_str(),
        failure.message,
        failure.source.as_str(),
        attempted
    )
}

async fn load_update_settings(app: &AppHandle) -> UpdateSettings {
    if let Some(shared_settings) = app.try_state::<SharedSettings>() {
        let guard = shared_settings.inner().read().await;
        return guard.updates.clone();
    }
    UpdateSettings::default()
}

#[tauri::command]
pub async fn self_check_update(app: AppHandle) -> Result<SelfUpdateInfo, String> {
    let current_version = app
        .config()
        .version
        .clone()
        .unwrap_or_else(|| "0.1.0".to_string());

    let update_settings = load_update_settings(&app).await;
    let candidates = resolve_update_source_candidates(&update_settings);
    let mut attempted_sources: Vec<UpdateSourceKind> = Vec::new();
    let mut failures: Vec<UpdateSourceFailure> = Vec::new();

    for candidate in &candidates {
        push_attempted_source(&mut attempted_sources, candidate.source);
        match check_candidate_for_update(&app, candidate).await {
            Ok(Some(update)) => {
                return Ok(build_self_update_info(
                    &current_version,
                    Some(update.version.clone()),
                    true,
                    update.body.clone(),
                    Some(candidate.source),
                    &attempted_sources,
                    None,
                ));
            }
            Ok(None) => {
                return Ok(build_self_update_info(
                    &current_version,
                    Some(current_version.clone()),
                    false,
                    None,
                    Some(candidate.source),
                    &attempted_sources,
                    None,
                ));
            }
            Err(failure) => {
                log::warn!(
                    "Self-update check failed on {} source: {}",
                    candidate.source.as_str(),
                    failure.message
                );
                failures.push(failure);
            }
        }
    }

    let fallback_failure = failures.last().cloned().unwrap_or_else(|| {
        UpdateSourceFailure::new(
            UpdateSourceKind::Official,
            UpdateErrorCategory::Unknown,
            "Unknown self-update check failure".to_string(),
        )
    });
    Ok(build_self_update_info(
        &current_version,
        None,
        false,
        None,
        None,
        &attempted_sources,
        Some(&fallback_failure),
    ))
}

#[tauri::command]
pub async fn self_update(app: AppHandle) -> Result<(), String> {
    let update_settings = load_update_settings(&app).await;
    let candidates = resolve_update_source_candidates(&update_settings);
    let mut attempted_sources: Vec<UpdateSourceKind> = Vec::new();
    let mut failures: Vec<UpdateSourceFailure> = Vec::new();

    for candidate in &candidates {
        push_attempted_source(&mut attempted_sources, candidate.source);

        let update = match check_candidate_for_update(&app, candidate).await {
            Ok(Some(update)) => update,
            Ok(None) => {
                let failure = UpdateSourceFailure::new(
                    candidate.source,
                    UpdateErrorCategory::NoUpdate,
                    format!("No update available from {} source", candidate.source.as_str()),
                );
                return Err(format_failure_message(&failure, &attempted_sources));
            }
            Err(failure) => {
                log::warn!(
                    "Self-update source '{}' failed before install, trying fallback if available: {}",
                    candidate.source.as_str(),
                    failure.message
                );
                failures.push(failure);
                continue;
            }
        };

        emit_update_progress(
            &app,
            "downloading",
            Some(0),
            Some(candidate.source),
            &attempted_sources,
            None,
        );

        let mut downloaded: u64 = 0;
        let install_result = update
            .download_and_install(
                |chunk_length, content_length| {
                    downloaded += chunk_length as u64;
                    if let Some(total) = content_length {
                        let progress = (downloaded as f64 / total as f64 * 100.0) as u32;
                        emit_update_progress(
                            &app,
                            "downloading",
                            Some(progress),
                            Some(candidate.source),
                            &attempted_sources,
                            None,
                        );
                        log::info!(
                            "Self-update download progress on source '{}': {}%",
                            candidate.source.as_str(),
                            progress
                        );
                    }
                },
                || {
                    emit_update_progress(
                        &app,
                        "installing",
                        None,
                        Some(candidate.source),
                        &attempted_sources,
                        None,
                    );
                    log::info!(
                        "Self-update downloaded from source '{}', starting install...",
                        candidate.source.as_str()
                    );
                },
            )
            .await;

        match install_result {
            Ok(_) => {
                emit_update_progress(
                    &app,
                    "done",
                    Some(100),
                    Some(candidate.source),
                    &attempted_sources,
                    None,
                );
                log::info!(
                    "Self-update installed successfully from source '{}', restarting app...",
                    candidate.source.as_str()
                );
                app.restart();
            }
            Err(error) => {
                let failure = UpdateSourceFailure::new(
                    candidate.source,
                    categorize_updater_error(&error),
                    error.to_string(),
                );
                log::warn!(
                    "Self-update install failed on source '{}', trying fallback if available: {}",
                    candidate.source.as_str(),
                    failure.message
                );
                failures.push(failure);
            }
        }
    }

    let final_failure = failures.last().cloned().unwrap_or_else(|| {
        UpdateSourceFailure::new(
            UpdateSourceKind::Official,
            UpdateErrorCategory::Unknown,
            "Unknown self-update installation failure".to_string(),
        )
    });

    emit_update_progress(
        &app,
        "error",
        None,
        Some(final_failure.source),
        &attempted_sources,
        Some(&final_failure),
    );
    Err(format_failure_message(&final_failure, &attempted_sources))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn build_update_settings(
        mode: UpdateSourceMode,
        fallback_to_official: bool,
        custom_endpoints: Vec<&str>,
    ) -> UpdateSettings {
        UpdateSettings {
            check_on_start: true,
            auto_install: false,
            notify: true,
            source_mode: mode,
            custom_endpoints: custom_endpoints
                .into_iter()
                .map(std::string::ToString::to_string)
                .collect(),
            fallback_to_official,
        }
    }

    #[test]
    fn resolve_source_candidates_prefers_selected_source_then_official_fallback() {
        let settings = build_update_settings(UpdateSourceMode::Mirror, true, vec![]);
        let candidates = resolve_update_source_candidates(&settings);
        let sources: Vec<&str> = candidates.iter().map(|candidate| candidate.source.as_str()).collect();
        assert_eq!(sources, vec!["mirror", "official"]);
    }

    #[test]
    fn resolve_source_candidates_uses_custom_without_official_when_fallback_disabled() {
        let settings = build_update_settings(
            UpdateSourceMode::Custom,
            false,
            vec!["https://updates.example.com/latest.json"],
        );
        let candidates = resolve_update_source_candidates(&settings);
        let sources: Vec<&str> = candidates.iter().map(|candidate| candidate.source.as_str()).collect();
        assert_eq!(sources, vec!["custom"]);
        assert!(matches!(
            candidates[0].strategy,
            EndpointStrategy::Override(_)
        ));
    }

    #[test]
    fn resolve_source_candidates_keeps_official_single_source() {
        let settings = build_update_settings(UpdateSourceMode::Official, true, vec![]);
        let candidates = resolve_update_source_candidates(&settings);
        let sources: Vec<&str> = candidates.iter().map(|candidate| candidate.source.as_str()).collect();
        assert_eq!(sources, vec!["official"]);
    }

    #[test]
    fn categorize_updater_error_distinguishes_core_classes() {
        assert_eq!(
            categorize_updater_error(&UpdaterError::EmptyEndpoints),
            UpdateErrorCategory::SourceUnavailable
        );
        assert_eq!(
            categorize_updater_error(&UpdaterError::Network("request timed out".into())),
            UpdateErrorCategory::Timeout
        );
        assert_eq!(
            categorize_updater_error(&UpdaterError::Network("connection reset".into())),
            UpdateErrorCategory::Network
        );
        assert_eq!(
            categorize_updater_error(&UpdaterError::InsecureTransportProtocol),
            UpdateErrorCategory::Validation
        );
    }

    #[test]
    fn build_progress_event_carries_source_context_and_error_category() {
        let attempted_sources = vec![UpdateSourceKind::Mirror, UpdateSourceKind::Official];
        let failure = UpdateSourceFailure::new(
            UpdateSourceKind::Official,
            UpdateErrorCategory::Signature,
            "signature mismatch".to_string(),
        );
        let event = build_progress_event(
            "error",
            None,
            Some(UpdateSourceKind::Official),
            &attempted_sources,
            Some(&failure),
        );

        assert_eq!(event.status, "error");
        assert_eq!(event.selected_source.as_deref(), Some("official"));
        assert_eq!(event.attempted_sources, vec!["mirror", "official"]);
        assert_eq!(event.error_category.as_deref(), Some("signature"));
        assert_eq!(event.error_message.as_deref(), Some("signature mismatch"));
    }
}
