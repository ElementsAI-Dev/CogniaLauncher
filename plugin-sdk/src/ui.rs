//! # UI Module
//!
//! Builder functions for declarative UI blocks. Plugins with `ui_mode = "declarative"`
//! return JSON-serialized `UiBlock` arrays that the host renders using native components.
//!
//! ## Example
//!
//! ```rust,ignore
//! use cognia_plugin_sdk::prelude::*;
//! use cognia_plugin_sdk::ui;
//!
//! #[plugin_fn]
//! pub fn my_dashboard(_input: String) -> FnResult<String> {
//!     let blocks = vec![
//!         ui::heading("Environment Dashboard", 1),
//!         ui::text("Current system status", Some("muted")),
//!         ui::divider(),
//!         ui::table(
//!             &["Environment", "Version", "Status"],
//!             &[
//!                 vec!["Node.js".into(), "20.0.0".into(), "Active".into()],
//!                 vec!["Python".into(), "3.12.0".into(), "Active".into()],
//!             ],
//!         ),
//!         ui::actions(&[
//!             ui::button("refresh", "Refresh", None, None),
//!         ]),
//!     ];
//!     Ok(ui::render(&blocks))
//! }
//! ```

use serde::{Deserialize, Serialize};

// ============================================================================
// Block Types
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "camelCase")]
pub enum UiBlock {
    #[serde(rename = "text")]
    Text {
        content: String,
        #[serde(skip_serializing_if = "Option::is_none")]
        variant: Option<String>,
    },
    #[serde(rename = "heading")]
    Heading {
        content: String,
        #[serde(skip_serializing_if = "Option::is_none")]
        level: Option<u8>,
    },
    #[serde(rename = "markdown")]
    Markdown { content: String },
    #[serde(rename = "divider")]
    Divider,
    #[serde(rename = "alert")]
    Alert {
        #[serde(skip_serializing_if = "Option::is_none")]
        title: Option<String>,
        message: String,
        #[serde(skip_serializing_if = "Option::is_none")]
        variant: Option<String>,
    },
    #[serde(rename = "badge")]
    Badge {
        label: String,
        #[serde(skip_serializing_if = "Option::is_none")]
        variant: Option<String>,
    },
    #[serde(rename = "progress")]
    Progress {
        value: f64,
        #[serde(skip_serializing_if = "Option::is_none")]
        max: Option<f64>,
        #[serde(skip_serializing_if = "Option::is_none")]
        label: Option<String>,
    },
    #[serde(rename = "image")]
    Image {
        src: String,
        #[serde(skip_serializing_if = "Option::is_none")]
        alt: Option<String>,
        #[serde(skip_serializing_if = "Option::is_none")]
        width: Option<u32>,
        #[serde(skip_serializing_if = "Option::is_none")]
        height: Option<u32>,
    },
    #[serde(rename = "code")]
    Code {
        code: String,
        #[serde(skip_serializing_if = "Option::is_none")]
        language: Option<String>,
    },
    #[serde(rename = "table")]
    Table {
        headers: Vec<String>,
        rows: Vec<Vec<String>>,
    },
    #[serde(rename = "key-value")]
    KeyValue { items: Vec<KeyValueItem> },
    #[serde(rename = "form")]
    Form {
        id: String,
        fields: Vec<FormField>,
        #[serde(skip_serializing_if = "Option::is_none", rename = "submitLabel")]
        submit_label: Option<String>,
    },
    #[serde(rename = "actions")]
    Actions { buttons: Vec<ActionButton> },
    #[serde(rename = "group")]
    Group {
        #[serde(skip_serializing_if = "Option::is_none")]
        direction: Option<String>,
        #[serde(skip_serializing_if = "Option::is_none")]
        gap: Option<u32>,
        children: Vec<UiBlock>,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct KeyValueItem {
    pub key: String,
    pub value: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "camelCase")]
pub enum FormField {
    #[serde(rename = "input")]
    Input {
        id: String,
        label: String,
        #[serde(skip_serializing_if = "Option::is_none")]
        placeholder: Option<String>,
        #[serde(skip_serializing_if = "Option::is_none", rename = "defaultValue")]
        default_value: Option<String>,
        #[serde(skip_serializing_if = "Option::is_none")]
        required: Option<bool>,
    },
    #[serde(rename = "textarea")]
    Textarea {
        id: String,
        label: String,
        #[serde(skip_serializing_if = "Option::is_none")]
        placeholder: Option<String>,
        #[serde(skip_serializing_if = "Option::is_none")]
        rows: Option<u32>,
    },
    #[serde(rename = "select")]
    Select {
        id: String,
        label: String,
        options: Vec<SelectOption>,
        #[serde(skip_serializing_if = "Option::is_none", rename = "defaultValue")]
        default_value: Option<String>,
    },
    #[serde(rename = "checkbox")]
    Checkbox {
        id: String,
        label: String,
        #[serde(skip_serializing_if = "Option::is_none", rename = "defaultChecked")]
        default_checked: Option<bool>,
    },
    #[serde(rename = "slider")]
    Slider {
        id: String,
        label: String,
        min: f64,
        max: f64,
        #[serde(skip_serializing_if = "Option::is_none")]
        step: Option<f64>,
        #[serde(skip_serializing_if = "Option::is_none", rename = "defaultValue")]
        default_value: Option<f64>,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SelectOption {
    pub label: String,
    pub value: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ActionButton {
    pub id: String,
    pub label: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub variant: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub icon: Option<String>,
}

// ============================================================================
// Action Payload (deserialized from input when user interacts)
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UiAction {
    pub action: String,
    #[serde(default)]
    pub button_id: Option<String>,
    #[serde(default)]
    pub form_id: Option<String>,
    #[serde(default)]
    pub form_data: Option<serde_json::Value>,
    #[serde(default)]
    pub state: Option<serde_json::Value>,
}

// ============================================================================
// Builder Functions
// ============================================================================

pub fn text(content: &str, variant: Option<&str>) -> UiBlock {
    UiBlock::Text {
        content: content.to_string(),
        variant: variant.map(|v| v.to_string()),
    }
}

pub fn heading(content: &str, level: u8) -> UiBlock {
    UiBlock::Heading {
        content: content.to_string(),
        level: Some(level),
    }
}

pub fn markdown(content: &str) -> UiBlock {
    UiBlock::Markdown {
        content: content.to_string(),
    }
}

pub fn divider() -> UiBlock {
    UiBlock::Divider
}

pub fn alert(message: &str, title: Option<&str>, variant: Option<&str>) -> UiBlock {
    UiBlock::Alert {
        title: title.map(|t| t.to_string()),
        message: message.to_string(),
        variant: variant.map(|v| v.to_string()),
    }
}

pub fn badge(label: &str, variant: Option<&str>) -> UiBlock {
    UiBlock::Badge {
        label: label.to_string(),
        variant: variant.map(|v| v.to_string()),
    }
}

pub fn progress(value: f64, max: Option<f64>, label: Option<&str>) -> UiBlock {
    UiBlock::Progress {
        value,
        max,
        label: label.map(|l| l.to_string()),
    }
}

pub fn code(code: &str, language: Option<&str>) -> UiBlock {
    UiBlock::Code {
        code: code.to_string(),
        language: language.map(|l| l.to_string()),
    }
}

pub fn table(headers: &[&str], rows: &[Vec<String>]) -> UiBlock {
    UiBlock::Table {
        headers: headers.iter().map(|h| h.to_string()).collect(),
        rows: rows.to_vec(),
    }
}

pub fn key_value(items: &[(&str, &str)]) -> UiBlock {
    UiBlock::KeyValue {
        items: items
            .iter()
            .map(|(k, v)| KeyValueItem {
                key: k.to_string(),
                value: v.to_string(),
            })
            .collect(),
    }
}

pub fn actions(buttons: &[ActionButton]) -> UiBlock {
    UiBlock::Actions {
        buttons: buttons.to_vec(),
    }
}

pub fn button(id: &str, label: &str, variant: Option<&str>, icon: Option<&str>) -> ActionButton {
    ActionButton {
        id: id.to_string(),
        label: label.to_string(),
        variant: variant.map(|v| v.to_string()),
        icon: icon.map(|i| i.to_string()),
    }
}

pub fn group(direction: &str, gap: Option<u32>, children: Vec<UiBlock>) -> UiBlock {
    UiBlock::Group {
        direction: Some(direction.to_string()),
        gap,
        children,
    }
}

// ============================================================================
// Render Functions
// ============================================================================

pub fn render(blocks: &[UiBlock]) -> String {
    serde_json::json!({ "ui": blocks }).to_string()
}

pub fn render_with_state(blocks: &[UiBlock], state: &serde_json::Value) -> String {
    serde_json::json!({ "ui": blocks, "state": state }).to_string()
}

pub fn parse_action(input: &str) -> Option<UiAction> {
    serde_json::from_str(input).ok()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_text_block() {
        let block = text("Hello", None);
        let json = serde_json::to_string(&block).unwrap();
        assert!(json.contains("\"type\":\"text\""));
        assert!(json.contains("\"content\":\"Hello\""));
        assert!(!json.contains("variant"));
    }

    #[test]
    fn test_text_block_with_variant() {
        let block = text("Muted text", Some("muted"));
        let json = serde_json::to_string(&block).unwrap();
        assert!(json.contains("\"variant\":\"muted\""));
    }

    #[test]
    fn test_heading_block() {
        let block = heading("Title", 1);
        let json = serde_json::to_string(&block).unwrap();
        assert!(json.contains("\"type\":\"heading\""));
        assert!(json.contains("\"level\":1"));
    }

    #[test]
    fn test_table_block() {
        let block = table(
            &["Name", "Version"],
            &[vec!["Node".into(), "20.0".into()]],
        );
        let json = serde_json::to_string(&block).unwrap();
        assert!(json.contains("\"type\":\"table\""));
        assert!(json.contains("\"headers\":[\"Name\",\"Version\"]"));
    }

    #[test]
    fn test_render_wraps_in_envelope() {
        let blocks = vec![text("Hello", None), divider()];
        let output = render(&blocks);
        let parsed: serde_json::Value = serde_json::from_str(&output).unwrap();
        assert!(parsed["ui"].is_array());
        assert_eq!(parsed["ui"].as_array().unwrap().len(), 2);
    }

    #[test]
    fn test_render_with_state() {
        let blocks = vec![text("Hello", None)];
        let state = serde_json::json!({"counter": 42});
        let output = render_with_state(&blocks, &state);
        let parsed: serde_json::Value = serde_json::from_str(&output).unwrap();
        assert_eq!(parsed["state"]["counter"], 42);
    }

    #[test]
    fn test_parse_action_button_click() {
        let input = r#"{"action":"button_click","buttonId":"refresh"}"#;
        let action = parse_action(input).unwrap();
        assert_eq!(action.action, "button_click");
        assert_eq!(action.button_id.as_deref(), Some("refresh"));
    }

    #[test]
    fn test_parse_action_form_submit() {
        let input = r#"{"action":"form_submit","formId":"settings","formData":{"name":"test"}}"#;
        let action = parse_action(input).unwrap();
        assert_eq!(action.action, "form_submit");
        assert_eq!(action.form_id.as_deref(), Some("settings"));
    }

    #[test]
    fn test_button_helper() {
        let btn = button("ok", "OK", Some("default"), Some("Check"));
        assert_eq!(btn.id, "ok");
        assert_eq!(btn.icon.as_deref(), Some("Check"));
    }

    #[test]
    fn test_key_value_block() {
        let block = key_value(&[("OS", "Windows"), ("Arch", "x64")]);
        let json = serde_json::to_string(&block).unwrap();
        assert!(json.contains("\"type\":\"key-value\""));
        assert!(json.contains("\"key\":\"OS\""));
    }
}
