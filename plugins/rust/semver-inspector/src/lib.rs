#[cfg(not(test))]
use cognia_plugin_sdk::prelude::*;
#[cfg(not(test))]
use extism_pdk::plugin_fn;
use semver::{Version, VersionReq};
use serde::{Deserialize, Serialize};

#[cfg(test)]
type FnResult<T> = Result<T, String>;

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct SemverInspectInput {
    current_version: String,
    requirement: String,
    candidate_version: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct SemverInspectSuccess {
    ok: bool,
    current_version: String,
    requirement: String,
    current_matches: bool,
    candidate_version: Option<String>,
    candidate_matches: Option<bool>,
    candidate_impact: Option<String>,
    recommendation_summary: String,
    message: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct SemverInspectFailure {
    ok: bool,
    error_code: String,
    message: String,
    recommendations: Vec<String>,
}

#[derive(Debug)]
struct PluginError {
    code: &'static str,
    message: String,
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

fn execute_semver_inspect(input: String) -> FnResult<String> {
    match parse_and_evaluate(&input) {
        Ok(success) => Ok(serde_json::to_string(&success).unwrap_or_else(|_| {
            r#"{"ok":false,"errorCode":"SERIALIZE_ERROR","message":"Failed to serialize success payload.","recommendations":["Retry with smaller input payload."]}"#
                .to_string()
        })),
        Err(err) => {
            let failure = SemverInspectFailure {
                ok: false,
                error_code: err.code.to_string(),
                message: err.message,
                recommendations: err.recommendations,
            };
            Ok(serde_json::to_string(&failure).unwrap_or_else(|_| {
                r#"{"ok":false,"errorCode":"SERIALIZE_ERROR","message":"Failed to serialize error payload.","recommendations":["Retry operation."]}"#
                    .to_string()
            }))
        }
    }
}

#[cfg(not(test))]
#[plugin_fn]
pub fn semver_inspect(input: String) -> FnResult<String> {
    execute_semver_inspect(input)
}

fn parse_and_evaluate(raw: &str) -> Result<SemverInspectSuccess, PluginError> {
    let parsed: SemverInspectInput = serde_json::from_str(raw).map_err(|_| {
        PluginError::new(
            "INVALID_INPUT",
            "Input must be JSON with currentVersion and requirement.",
            vec![
                "Provide: {\"currentVersion\":\"1.2.3\",\"requirement\":\"^1.0.0\"}".to_string(),
            ],
        )
    })?;

    let current_version = Version::parse(parsed.current_version.trim()).map_err(|e| {
        PluginError::new(
            "INVALID_VERSION",
            format!("Invalid currentVersion: {}", e),
            vec!["Use semantic version format like 1.2.3.".to_string()],
        )
    })?;

    let requirement = VersionReq::parse(parsed.requirement.trim()).map_err(|e| {
        PluginError::new(
            "INVALID_REQUIREMENT",
            format!("Invalid requirement: {}", e),
            vec![
                "Use constraints like ^1.2.0, >=1.0.0, <2.0.0.".to_string(),
            ],
        )
    })?;

    let current_matches = requirement.matches(&current_version);

    let (candidate_version, candidate_matches, candidate_impact, recommendation_summary) =
        match &parsed.candidate_version {
            Some(candidate) => {
                let candidate_version = Version::parse(candidate.trim()).map_err(|e| {
                    PluginError::new(
                        "INVALID_VERSION",
                        format!("Invalid candidateVersion: {}", e),
                        vec!["Use semantic version format like 2.0.0.".to_string()],
                    )
                })?;
                let candidate_matches = requirement.matches(&candidate_version);
                let candidate_impact = classify_candidate_impact(
                    &current_version,
                    &candidate_version,
                    candidate_matches,
                );
                let recommendation_summary = summarize_recommendation(&candidate_impact);

                (
                    Some(candidate_version),
                    Some(candidate_matches),
                    Some(candidate_impact.to_string()),
                    recommendation_summary.to_string(),
                )
            }
            None => (
                None,
                None,
                None,
                if current_matches {
                    "Current version already satisfies the declared semver range.".to_string()
                } else {
                    "Current version does not satisfy the declared semver range.".to_string()
                },
            ),
        };

    Ok(SemverInspectSuccess {
        ok: true,
        current_version: parsed.current_version,
        requirement: parsed.requirement,
        current_matches,
        candidate_version: candidate_version.map(|version| version.to_string()),
        candidate_matches,
        candidate_impact,
        recommendation_summary,
        message: "Semver inspection completed.".to_string(),
    })
}

fn classify_candidate_impact(
    current_version: &Version,
    candidate_version: &Version,
    candidate_matches: bool,
) -> &'static str {
    if !candidate_matches {
        if candidate_version.major != current_version.major {
            return "breaking-change";
        }
        return "out-of-range";
    }

    if candidate_version > current_version {
        "compatible-upgrade"
    } else if candidate_version < current_version {
        "compatible-downgrade"
    } else {
        "no-change"
    }
}

fn summarize_recommendation(impact: &str) -> &'static str {
    match impact {
        "compatible-upgrade" => "Candidate remains within the declared semver range.",
        "compatible-downgrade" => "Candidate satisfies the range but would roll back the current version.",
        "no-change" => "Candidate matches the current version; no semver impact is expected.",
        "breaking-change" => "Candidate crosses a major-version boundary and should be treated as breaking.",
        _ => "Candidate falls outside the declared semver range.",
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parse_and_evaluate_success_for_matching_versions() {
        let raw = r#"{"currentVersion":"1.5.0","requirement":"^1.4.0","candidateVersion":"1.9.1"}"#;
        let result = parse_and_evaluate(raw).expect("expected success");
        assert!(result.ok);
        assert!(result.current_matches);
        assert_eq!(result.candidate_matches, Some(true));
    }

    #[test]
    fn parse_and_evaluate_failure_for_invalid_requirement() {
        let raw = r#"{"currentVersion":"1.5.0","requirement":"not-a-req"}"#;
        let err = parse_and_evaluate(raw).expect_err("expected failure");
        assert_eq!(err.code, "INVALID_REQUIREMENT");
    }

    #[test]
    fn parse_and_evaluate_failure_for_invalid_candidate_version() {
        let raw = r#"{"currentVersion":"1.5.0","requirement":"^1.0.0","candidateVersion":"x.y.z"}"#;
        let err = parse_and_evaluate(raw).expect_err("expected failure");
        assert_eq!(err.code, "INVALID_VERSION");
        assert!(err.message.contains("candidateVersion"));
    }

    #[test]
    fn parse_and_evaluate_classifies_compatible_candidate_upgrades() {
        let raw = r#"{"currentVersion":"1.5.0","requirement":"^1.4.0","candidateVersion":"1.6.0"}"#;
        let result = parse_and_evaluate(raw).expect("expected success");
        let serialized = serde_json::to_value(&result).expect("serialize result");
        assert_eq!(serialized["candidateImpact"], "compatible-upgrade");
        assert_eq!(serialized["recommendationSummary"], "Candidate remains within the declared semver range.");
    }

    #[test]
    fn parse_and_evaluate_classifies_breaking_candidates() {
        let raw = r#"{"currentVersion":"1.5.0","requirement":"^1.4.0","candidateVersion":"2.0.0"}"#;
        let result = parse_and_evaluate(raw).expect("expected success");
        let serialized = serde_json::to_value(&result).expect("serialize result");
        assert_eq!(serialized["candidateImpact"], "breaking-change");
        assert_eq!(serialized["candidateMatches"], false);
    }
}
