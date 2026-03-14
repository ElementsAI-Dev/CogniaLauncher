#[cfg(not(test))]
use cognia_plugin_sdk::prelude::*;
#[cfg(not(test))]
use extism_pdk::plugin_fn;
use serde::{Deserialize, Serialize};
use serde_json::{Map, Value};

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct JsonWorkbenchInput {
    mode: String,
    input: String,
    #[serde(default)]
    other_input: Option<String>,
    #[serde(default)]
    input_format: Option<String>,
    #[serde(default)]
    other_input_format: Option<String>,
    #[serde(default)]
    output_format: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct JsonWorkbenchSuccess {
    ok: bool,
    mode: String,
    input_format: String,
    output_format: Option<String>,
    normalized: Value,
    formatted: Option<String>,
    minified: Option<String>,
    converted: Option<String>,
    comparison: Option<JsonComparison>,
    message: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct JsonComparison {
    equivalent: bool,
    left_summary: JsonSummary,
    right_summary: JsonSummary,
    difference_summary: DifferenceSummary,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct JsonSummary {
    value_type: String,
    key_count: usize,
    array_length: usize,
}

#[derive(Debug, Clone, Default, Serialize)]
#[serde(rename_all = "camelCase")]
struct DifferenceSummary {
    added: usize,
    removed: usize,
    changed: usize,
}

#[cfg(not(test))]
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct JsonWorkbenchFailure {
    ok: bool,
    error_code: String,
    message: String,
    recommendations: Vec<String>,
}

#[derive(Debug)]
struct PluginError {
    code: &'static str,
    #[cfg_attr(test, allow(dead_code))]
    message: String,
    #[cfg_attr(test, allow(dead_code))]
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

#[cfg(not(test))]
fn execute_json_workbench(input: String) -> FnResult<String> {
    match parse_and_execute(&input) {
        Ok(success) => Ok(serde_json::to_string(&success).unwrap_or_else(|_| {
            r#"{"ok":false,"errorCode":"SERIALIZE_ERROR","message":"Failed to serialize success payload.","recommendations":["Retry with smaller input payload."]}"#
                .to_string()
        })),
        Err(err) => {
            let failure = JsonWorkbenchFailure {
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
pub fn json_workbench(input: String) -> FnResult<String> {
    execute_json_workbench(input)
}

fn parse_and_execute(raw: &str) -> Result<JsonWorkbenchSuccess, PluginError> {
    let parsed: JsonWorkbenchInput = serde_json::from_str(raw).map_err(|_| {
        PluginError::new(
            "INVALID_INPUT",
            "Input must be JSON with mode and input fields.",
            vec![r#"Provide: {"mode":"prettify","input":"{\"name\":\"cognia\"}"}"#.to_string()],
        )
    })?;

    let mode = parsed.mode.trim().to_lowercase();
    let (normalized, input_format) = parse_structured_value(
        &parsed.input,
        "input",
        parsed.input_format.as_deref(),
    )?;

    match mode.as_str() {
        "validate" => Ok(JsonWorkbenchSuccess {
            ok: true,
            mode,
            input_format,
            output_format: None,
            normalized,
            formatted: None,
            minified: None,
            converted: None,
            comparison: None,
            message: "Structured document workflow completed.".to_string(),
        }),
        "prettify" => Ok(JsonWorkbenchSuccess {
            ok: true,
            mode,
            input_format: input_format.clone(),
            output_format: Some(input_format.clone()),
            normalized: normalized.clone(),
            formatted: Some(render_value(&normalized, &input_format, true)?),
            minified: None,
            converted: None,
            comparison: None,
            message: "Structured document workflow completed.".to_string(),
        }),
        "minify" => Ok(JsonWorkbenchSuccess {
            ok: true,
            mode,
            input_format,
            output_format: Some("json".to_string()),
            normalized: normalized.clone(),
            formatted: None,
            minified: Some(render_value(&normalized, "json", false)?),
            converted: None,
            comparison: None,
            message: "Structured document workflow completed.".to_string(),
        }),
        "convert" => {
            let output_format = normalize_format(
                parsed.output_format.as_deref().unwrap_or("json"),
                "outputFormat",
            )?;
            Ok(JsonWorkbenchSuccess {
                ok: true,
                mode,
                input_format,
                output_format: Some(output_format.to_string()),
                normalized: normalized.clone(),
                formatted: None,
                minified: None,
                converted: Some(render_value(&normalized, output_format, output_format == "yaml")?),
                comparison: None,
                message: "Structured document workflow completed.".to_string(),
            })
        }
        "compare" => {
            let other_input = parsed.other_input.ok_or_else(|| {
                PluginError::new(
                    "MISSING_OTHER_INPUT",
                    "compare mode requires otherInput.",
                    vec!["Provide otherInput with the second structured payload.".to_string()],
                )
            })?;
            let (other, _) = parse_structured_value(
                &other_input,
                "otherInput",
                parsed.other_input_format.as_deref(),
            )?;
            let difference_summary = diff_values(&normalized, &other);

            Ok(JsonWorkbenchSuccess {
                ok: true,
                mode,
                input_format,
                output_format: None,
                normalized: normalized.clone(),
                formatted: None,
                minified: None,
                converted: None,
                comparison: Some(JsonComparison {
                    equivalent: normalized == other,
                    left_summary: summarize_value(&normalized),
                    right_summary: summarize_value(&other),
                    difference_summary,
                }),
                message: "Structured document workflow completed.".to_string(),
            })
        }
        _ => Err(PluginError::new(
            "UNSUPPORTED_MODE",
            format!("Unsupported mode: {}", parsed.mode),
            vec!["Use one of: validate, prettify, minify, convert, compare.".to_string()],
        )),
    }
}

fn parse_structured_value(
    raw: &str,
    label: &str,
    format_hint: Option<&str>,
) -> Result<(Value, String), PluginError> {
    if let Some(format_hint) = format_hint {
        let normalized = normalize_format(format_hint, label)?;
        let value = parse_with_format(raw, label, normalized)?;
        return Ok((value, normalized.to_string()));
    }

    match serde_json::from_str::<Value>(raw) {
        Ok(value) => Ok((value, "json".to_string())),
        Err(_) => parse_with_format(raw, label, "yaml").map(|value| (value, "yaml".to_string())),
    }
}

fn normalize_format<'a>(value: &'a str, field_name: &str) -> Result<&'a str, PluginError> {
    let normalized = value.trim().to_lowercase();
    match normalized.as_str() {
        "json" => Ok("json"),
        "yaml" => Ok("yaml"),
        _ => Err(PluginError::new(
            "UNSUPPORTED_FORMAT",
            format!("{} must be 'json' or 'yaml'.", field_name),
            vec!["Use json or yaml as the structured document format.".to_string()],
        )),
    }
}

fn parse_with_format(raw: &str, label: &str, format: &str) -> Result<Value, PluginError> {
    match format {
        "json" => serde_json::from_str(raw).map_err(|err| {
            PluginError::new(
                "INVALID_JSON",
                format!("{} is not valid JSON: {}", label, err),
                vec!["Validate the JSON syntax and quote object keys/strings.".to_string()],
            )
        }),
        "yaml" => serde_yaml::from_str(raw).map_err(|err| {
            PluginError::new(
                "INVALID_YAML",
                format!("{} is not valid YAML: {}", label, err),
                vec!["Validate indentation and key/value structure in the YAML payload.".to_string()],
            )
        }),
        _ => unreachable!(),
    }
}

fn render_value(value: &Value, format: &str, pretty: bool) -> Result<String, PluginError> {
    match format {
        "json" => {
            let rendered = if pretty {
                serde_json::to_string_pretty(value)
            } else {
                serde_json::to_string(value)
            };
            rendered.map_err(|err| {
                PluginError::new(
                    "SERIALIZE_ERROR",
                    format!("Failed to serialize JSON output: {}", err),
                    vec!["Retry with a smaller or simpler structured payload.".to_string()],
                )
            })
        }
        "yaml" => serde_yaml::to_string(value)
            .map(|text| text.trim_end().to_string())
            .map_err(|err| {
                PluginError::new(
                    "SERIALIZE_ERROR",
                    format!("Failed to serialize YAML output: {}", err),
                    vec!["Retry with a smaller or simpler structured payload.".to_string()],
                )
            }),
        _ => unreachable!(),
    }
}

fn summarize_value(value: &Value) -> JsonSummary {
    match value {
        Value::Object(map) => JsonSummary {
            value_type: "object".to_string(),
            key_count: map.len(),
            array_length: 0,
        },
        Value::Array(array) => JsonSummary {
            value_type: "array".to_string(),
            key_count: 0,
            array_length: array.len(),
        },
        Value::String(_) => JsonSummary {
            value_type: "string".to_string(),
            key_count: 0,
            array_length: 0,
        },
        Value::Number(_) => JsonSummary {
            value_type: "number".to_string(),
            key_count: 0,
            array_length: 0,
        },
        Value::Bool(_) => JsonSummary {
            value_type: "boolean".to_string(),
            key_count: 0,
            array_length: 0,
        },
        Value::Null => JsonSummary {
            value_type: "null".to_string(),
            key_count: 0,
            array_length: 0,
        },
    }
}

fn diff_values(left: &Value, right: &Value) -> DifferenceSummary {
    let mut summary = DifferenceSummary::default();
    accumulate_diff(left, right, &mut summary);
    summary
}

fn accumulate_diff(left: &Value, right: &Value, summary: &mut DifferenceSummary) {
    match (left, right) {
        (Value::Object(left_map), Value::Object(right_map)) => {
            diff_objects(left_map, right_map, summary);
        }
        (Value::Array(left_array), Value::Array(right_array)) => {
            let max_len = left_array.len().max(right_array.len());
            for index in 0..max_len {
                match (left_array.get(index), right_array.get(index)) {
                    (Some(left_value), Some(right_value)) => accumulate_diff(left_value, right_value, summary),
                    (None, Some(_)) => summary.added += 1,
                    (Some(_), None) => summary.removed += 1,
                    (None, None) => {}
                }
            }
        }
        _ if left != right => {
            summary.changed += 1;
        }
        _ => {}
    }
}

fn diff_objects(left: &Map<String, Value>, right: &Map<String, Value>, summary: &mut DifferenceSummary) {
    for key in left.keys() {
        if !right.contains_key(key) {
            summary.removed += 1;
        }
    }
    for key in right.keys() {
        if !left.contains_key(key) {
            summary.added += 1;
        }
    }
    for (key, left_value) in left {
        if let Some(right_value) = right.get(key) {
            accumulate_diff(left_value, right_value, summary);
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parse_and_execute_prettify_success() {
        let raw = r#"{"mode":"prettify","input":"{\"name\":\"cognia\",\"ports\":[3000,5173]}"}"#;
        let result = parse_and_execute(raw).expect("expected success");
        assert!(result.ok);
        assert_eq!(result.mode, "prettify");
        assert!(result.formatted.unwrap().contains('\n'));
    }

    #[test]
    fn parse_and_execute_compare_detects_equivalence() {
        let raw = r#"{"mode":"compare","input":"{\"name\":\"cognia\",\"enabled\":true}","otherInput":"{\n  \"enabled\": true,\n  \"name\": \"cognia\"\n}"}"#;
        let result = parse_and_execute(raw).expect("expected success");
        assert_eq!(result.comparison.unwrap().equivalent, true);
    }

    #[test]
    fn parse_and_execute_rejects_invalid_json() {
        let raw = r#"{"mode":"prettify","input":"{name:cognia}","inputFormat":"json"}"#;
        let err = parse_and_execute(raw).expect_err("expected failure");
        assert_eq!(err.code, "INVALID_JSON");
    }

    #[test]
    fn parse_and_execute_converts_yaml_to_json() {
        let raw = r#"{"mode":"convert","input":"name: cognia\nports:\n  - 3000\n","inputFormat":"yaml","outputFormat":"json"}"#;
        let result = parse_and_execute(raw).expect("expected success");
        let serialized = serde_json::to_value(&result).expect("serialize result");
        assert_eq!(serialized["outputFormat"], "json");
        assert_eq!(serialized["converted"], "{\"name\":\"cognia\",\"ports\":[3000]}");
    }

    #[test]
    fn parse_and_execute_compare_reports_structural_differences() {
        let raw = r#"{"mode":"compare","input":"{\"name\":\"cognia\",\"enabled\":true}","otherInput":"{\"name\":\"cognia\",\"enabled\":false,\"port\":3000}"}"#;
        let result = parse_and_execute(raw).expect("expected success");
        let serialized = serde_json::to_value(&result).expect("serialize result");
        assert_eq!(serialized["comparison"]["equivalent"], false);
        assert_eq!(serialized["comparison"]["differenceSummary"]["changed"], 1);
        assert_eq!(serialized["comparison"]["differenceSummary"]["added"], 1);
    }
}
