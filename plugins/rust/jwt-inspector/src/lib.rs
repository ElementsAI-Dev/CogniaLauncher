use base64::engine::general_purpose::URL_SAFE_NO_PAD;
use base64::Engine;
#[cfg(not(test))]
use cognia_plugin_sdk::prelude::*;
#[cfg(not(test))]
use extism_pdk::plugin_fn;
use hmac::{Hmac, Mac};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use sha2::{Sha256, Sha384, Sha512};

#[cfg(test)]
type FnResult<T> = Result<T, String>;

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct JwtInspectInput {
    token: String,
    #[serde(default)]
    now_epoch_seconds: Option<i64>,
    #[serde(default)]
    verification: Option<JwtVerificationInput>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct JwtVerificationInput {
    #[serde(default)]
    shared_secret: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct ClaimTime {
    epoch_seconds: i64,
    iso_utc: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct VerificationSummary {
    status: String,
    algorithm_checked: Option<String>,
    message: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct JwtInspectSuccess {
    ok: bool,
    algorithm: Option<String>,
    token_type: Option<String>,
    header: Value,
    payload: Value,
    issued_at: Option<ClaimTime>,
    not_before: Option<ClaimTime>,
    expires_at: Option<ClaimTime>,
    is_expired: Option<bool>,
    is_active: Option<bool>,
    verification: VerificationSummary,
    trust_established: bool,
    message: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct JwtInspectFailure {
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

fn execute_jwt_inspect(input: String) -> FnResult<String> {
    match parse_and_inspect(&input) {
        Ok(success) => Ok(serde_json::to_string(&success).unwrap_or_else(|_| {
            r#"{"ok":false,"errorCode":"SERIALIZE_ERROR","message":"Failed to serialize success payload.","recommendations":["Retry with smaller input payload."]}"#
                .to_string()
        })),
        Err(err) => {
            let failure = JwtInspectFailure {
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
pub fn jwt_inspect(input: String) -> FnResult<String> {
    execute_jwt_inspect(input)
}

fn parse_and_inspect(raw: &str) -> Result<JwtInspectSuccess, PluginError> {
    let parsed: JwtInspectInput = serde_json::from_str(raw).map_err(|_| {
        PluginError::new(
            "INVALID_INPUT",
            "Input must be JSON with a token field.",
            vec![r#"Provide: {"token":"<jwt>"}"#.to_string()],
        )
    })?;

    let parts: Vec<&str> = parsed.token.trim().split('.').collect();
    if parts.len() != 3 {
        return Err(PluginError::new(
            "INVALID_TOKEN",
            "Token must contain header.payload.signature segments.",
            vec!["Paste the full JWT, including all three dot-separated segments.".to_string()],
        ));
    }

    let header = decode_segment(parts[0], "header")?;
    let payload = decode_segment(parts[1], "payload")?;
    let signature = parts[2];

    let now_epoch_seconds = parsed.now_epoch_seconds.unwrap_or_else(current_epoch_seconds);
    let issued_at = extract_claim_time(&payload, "iat");
    let not_before = extract_claim_time(&payload, "nbf");
    let expires_at = extract_claim_time(&payload, "exp");
    let is_expired = expires_at.as_ref().map(|claim| claim.epoch_seconds < now_epoch_seconds);
    let is_active = match &not_before {
        Some(claim) => Some(claim.epoch_seconds <= now_epoch_seconds && !is_expired.unwrap_or(false)),
        None => is_expired.map(|expired| !expired),
    };

    let verification = verify_signature(
        header.get("alg").and_then(Value::as_str),
        &format!("{}.{}", parts[0], parts[1]),
        signature,
        parsed.verification.as_ref(),
    )?;
    let trust_established = verification.status == "verified";

    Ok(JwtInspectSuccess {
        ok: true,
        algorithm: header.get("alg").and_then(Value::as_str).map(str::to_string),
        token_type: header.get("typ").and_then(Value::as_str).map(str::to_string),
        header,
        payload,
        issued_at,
        not_before,
        expires_at,
        is_expired,
        is_active,
        verification,
        trust_established,
        message: "JWT inspection completed.".to_string(),
    })
}

fn verify_signature(
    algorithm: Option<&str>,
    signing_input: &str,
    signature: &str,
    verification: Option<&JwtVerificationInput>,
) -> Result<VerificationSummary, PluginError> {
    let algorithm = algorithm.map(str::to_string);

    let Some(verification) = verification else {
        return Ok(VerificationSummary {
            status: "not_requested".to_string(),
            algorithm_checked: algorithm,
            message: "Token was decoded without verifying the signature.".to_string(),
        });
    };

    let Some(shared_secret) = verification.shared_secret.as_deref() else {
        return Ok(VerificationSummary {
            status: "not_requested".to_string(),
            algorithm_checked: algorithm,
            message: "Verification input was provided, but no supported sharedSecret was supplied.".to_string(),
        });
    };

    let Some(alg) = algorithm.as_deref() else {
        return Ok(VerificationSummary {
            status: "unsupported".to_string(),
            algorithm_checked: None,
            message: "JWT header does not declare an algorithm for offline verification.".to_string(),
        });
    };

    let verified = match alg {
        "HS256" => verify_hs256(signing_input, shared_secret, signature)?,
        "HS384" => verify_hs384(signing_input, shared_secret, signature)?,
        "HS512" => verify_hs512(signing_input, shared_secret, signature)?,
        _ => {
            return Ok(VerificationSummary {
                status: "unsupported".to_string(),
                algorithm_checked: Some(alg.to_string()),
                message: format!("Offline verification for {} is not supported by this built-in plugin.", alg),
            });
        }
    };

    Ok(VerificationSummary {
        status: if verified { "verified" } else { "failed" }.to_string(),
        algorithm_checked: Some(alg.to_string()),
        message: if verified {
            "JWT signature matches the supplied shared secret.".to_string()
        } else {
            "JWT signature did not match the supplied shared secret.".to_string()
        },
    })
}

fn verify_hs256(signing_input: &str, shared_secret: &str, signature: &str) -> Result<bool, PluginError> {
    verify_hmac_sha256(signing_input, shared_secret, signature)
}

fn verify_hs384(signing_input: &str, shared_secret: &str, signature: &str) -> Result<bool, PluginError> {
    verify_hmac_sha384(signing_input, shared_secret, signature)
}

fn verify_hs512(signing_input: &str, shared_secret: &str, signature: &str) -> Result<bool, PluginError> {
    verify_hmac_sha512(signing_input, shared_secret, signature)
}

fn build_hmac_failure() -> PluginError {
    PluginError::new(
        "INVALID_VERIFICATION",
        "Failed to initialize shared-secret verification.",
        vec!["Provide a non-empty sharedSecret string.".to_string()],
    )
}

fn verify_hmac_sha256(signing_input: &str, shared_secret: &str, signature: &str) -> Result<bool, PluginError> {
    let mut mac = Hmac::<Sha256>::new_from_slice(shared_secret.as_bytes()).map_err(|_| build_hmac_failure())?;
    mac.update(signing_input.as_bytes());
    let expected = URL_SAFE_NO_PAD.encode(mac.finalize().into_bytes());
    Ok(expected == signature)
}

fn verify_hmac_sha384(signing_input: &str, shared_secret: &str, signature: &str) -> Result<bool, PluginError> {
    let mut mac = Hmac::<Sha384>::new_from_slice(shared_secret.as_bytes()).map_err(|_| build_hmac_failure())?;
    mac.update(signing_input.as_bytes());
    let expected = URL_SAFE_NO_PAD.encode(mac.finalize().into_bytes());
    Ok(expected == signature)
}

fn verify_hmac_sha512(signing_input: &str, shared_secret: &str, signature: &str) -> Result<bool, PluginError> {
    let mut mac = Hmac::<Sha512>::new_from_slice(shared_secret.as_bytes()).map_err(|_| build_hmac_failure())?;
    mac.update(signing_input.as_bytes());
    let expected = URL_SAFE_NO_PAD.encode(mac.finalize().into_bytes());
    Ok(expected == signature)
}

fn decode_segment(segment: &str, label: &str) -> Result<Value, PluginError> {
    let bytes = URL_SAFE_NO_PAD.decode(segment).map_err(|_| {
        PluginError::new(
            "INVALID_BASE64",
            format!("The {} segment is not valid base64url.", label),
            vec!["Ensure the token is copied exactly and not truncated.".to_string()],
        )
    })?;

    serde_json::from_slice::<Value>(&bytes).map_err(|_| {
        PluginError::new(
            "INVALID_JSON",
            format!("The decoded {} segment is not valid JSON.", label),
            vec!["Check whether the token payload is malformed or encrypted.".to_string()],
        )
    })
}

fn extract_claim_time(payload: &Value, key: &str) -> Option<ClaimTime> {
    payload.get(key).and_then(Value::as_i64).map(|epoch_seconds| ClaimTime {
        epoch_seconds,
        iso_utc: format_epoch(epoch_seconds),
    })
}

fn current_epoch_seconds() -> i64 {
    (std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs()) as i64
}

fn format_epoch(epoch_seconds: i64) -> String {
    use std::fmt::Write;

    let days = epoch_seconds.div_euclid(86_400);
    let secs_of_day = epoch_seconds.rem_euclid(86_400);
    let (year, month, day) = civil_from_days(days);
    let hour = secs_of_day / 3_600;
    let minute = (secs_of_day % 3_600) / 60;
    let second = secs_of_day % 60;

    let mut output = String::with_capacity(20);
    let _ = write!(
        output,
        "{year:04}-{month:02}-{day:02}T{hour:02}:{minute:02}:{second:02}Z"
    );
    output
}

fn civil_from_days(days_since_epoch: i64) -> (i64, i64, i64) {
    let z = days_since_epoch + 719_468;
    let era = if z >= 0 { z } else { z - 146_096 } / 146_097;
    let doe = z - era * 146_097;
    let yoe = (doe - doe / 1_460 + doe / 36_524 - doe / 146_096) / 365;
    let y = yoe + era * 400;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp = (5 * doy + 2) / 153;
    let d = doy - (153 * mp + 2) / 5 + 1;
    let m = mp + if mp < 10 { 3 } else { -9 };
    let year = y + if m <= 2 { 1 } else { 0 };
    (year, m, d)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parse_and_inspect_successfully_decodes_claims() {
        let raw = r#"{"token":"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjMiLCJleHAiOjIwMDAwMDAwMDAsImlhdCI6MTkwMDAwMDAwMCwibmJmIjoxOTAwMDAwMDAwfQ.signature","nowEpochSeconds":1950000000}"#;
        let result = parse_and_inspect(raw).expect("expected success");

        assert!(result.ok);
        assert_eq!(result.algorithm.as_deref(), Some("HS256"));
        assert_eq!(result.token_type.as_deref(), Some("JWT"));
        assert_eq!(result.payload["sub"], "123");
        assert_eq!(result.is_expired, Some(false));
        assert_eq!(result.is_active, Some(true));
    }

    #[test]
    fn parse_and_inspect_rejects_two_segment_tokens() {
        let raw = r#"{"token":"abc.def"}"#;
        let err = parse_and_inspect(raw).expect_err("expected failure");
        assert_eq!(err.code, "INVALID_TOKEN");
    }

    #[test]
    fn parse_and_inspect_rejects_non_json_payloads() {
        let raw = r#"{"token":"eyJhbGciOiJIUzI1NiJ9.bm90LWpzb24.signature"}"#;
        let err = parse_and_inspect(raw).expect_err("expected failure");
        assert_eq!(err.code, "INVALID_JSON");
    }

    #[test]
    fn parse_and_inspect_reports_verified_shared_secret_tokens() {
        let raw = r#"{"token":"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjMiLCJleHAiOjIwMDAwMDAwMDAsImlhdCI6MTkwMDAwMDAwMCwibmJmIjoxOTAwMDAwMDAwfQ.brPdpWTibPh50celw5J7K5Ptpopx9wjN4xHavoRkqvY","nowEpochSeconds":1950000000,"verification":{"sharedSecret":"secret"}}"#;
        let result = parse_and_inspect(raw).expect("expected success");
        let serialized = serde_json::to_value(&result).expect("serialize result");
        assert_eq!(serialized["verification"]["status"], "verified");
        assert_eq!(serialized["trustEstablished"], true);
    }

    #[test]
    fn parse_and_inspect_marks_decode_only_mode_as_unverified() {
        let raw = r#"{"token":"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjMiLCJleHAiOjIwMDAwMDAwMDAsImlhdCI6MTkwMDAwMDAwMCwibmJmIjoxOTAwMDAwMDAwfQ.signature","nowEpochSeconds":1950000000}"#;
        let result = parse_and_inspect(raw).expect("expected success");
        let serialized = serde_json::to_value(&result).expect("serialize result");
        assert_eq!(serialized["verification"]["status"], "not_requested");
        assert_eq!(serialized["trustEstablished"], false);
    }
}
