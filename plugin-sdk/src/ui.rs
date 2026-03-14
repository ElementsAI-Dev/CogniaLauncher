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

use crate::host;
use crate::types::{
    PluginUiConfirmData, PluginUiContext, PluginUiPathData, PluginUiPathsData, PluginUiRequest,
    PluginUiRequestResult,
};
use extism_pdk::*;
use std::collections::HashMap;

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
    #[serde(rename = "tabs")]
    Tabs {
        tabs: Vec<TabItem>,
        #[serde(skip_serializing_if = "Option::is_none", rename = "defaultTab")]
        default_tab: Option<String>,
    },
    #[serde(rename = "accordion")]
    Accordion {
        items: Vec<AccordionItem>,
        #[serde(skip_serializing_if = "Option::is_none")]
        collapsible: Option<bool>,
    },
    #[serde(rename = "copy-button")]
    CopyButton {
        content: String,
        #[serde(skip_serializing_if = "Option::is_none")]
        label: Option<String>,
    },
    #[serde(rename = "file-input")]
    FileInput {
        id: String,
        label: String,
        #[serde(skip_serializing_if = "Option::is_none")]
        accept: Option<String>,
        #[serde(skip_serializing_if = "Option::is_none")]
        multiple: Option<bool>,
        #[serde(skip_serializing_if = "Option::is_none", rename = "includeDataUrl")]
        include_data_url: Option<bool>,
    },
    #[serde(rename = "json-view")]
    JsonView {
        data: serde_json::Value,
        #[serde(skip_serializing_if = "Option::is_none")]
        label: Option<String>,
        #[serde(skip_serializing_if = "Option::is_none")]
        expanded: Option<bool>,
    },
    #[serde(rename = "description-list")]
    DescriptionList { items: Vec<DescriptionItem> },
    #[serde(rename = "stat-cards")]
    StatCards { stats: Vec<StatCard> },
    #[serde(rename = "result")]
    Result {
        message: String,
        #[serde(skip_serializing_if = "Option::is_none")]
        title: Option<String>,
        #[serde(skip_serializing_if = "Option::is_none")]
        details: Option<String>,
        #[serde(skip_serializing_if = "Option::is_none")]
        status: Option<String>,
    },
    #[serde(rename = "conditional-group")]
    ConditionalGroup {
        when: ConditionalWhen,
        children: Vec<UiBlock>,
    },
    #[serde(rename = "stepper")]
    Stepper {
        id: String,
        steps: Vec<StepItem>,
        #[serde(skip_serializing_if = "Option::is_none", rename = "defaultStepId")]
        default_step_id: Option<String>,
    },
    #[serde(rename = "log-stream")]
    LogStream { entries: Vec<LogEntry> },
    #[serde(rename = "artifact-actions")]
    ArtifactActions { artifacts: Vec<ArtifactAction> },
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
pub struct DescriptionItem {
    pub term: String,
    pub description: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StatCard {
    pub id: String,
    pub label: String,
    pub value: serde_json::Value,
    #[serde(skip_serializing_if = "Option::is_none", rename = "helpText")]
    pub help_text: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub status: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ConditionalWhen {
    pub path: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub equals: Option<serde_json::Value>,
    #[serde(skip_serializing_if = "Option::is_none", rename = "notEquals")]
    pub not_equals: Option<serde_json::Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub exists: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StepItem {
    pub id: String,
    pub label: String,
    pub children: Vec<UiBlock>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LogEntry {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub level: Option<String>,
    pub message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub timestamp: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ArtifactAction {
    pub id: String,
    pub label: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub href: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub content: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub action: Option<String>,
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
    #[serde(rename = "number")]
    Number {
        id: String,
        label: String,
        #[serde(skip_serializing_if = "Option::is_none")]
        placeholder: Option<String>,
        #[serde(skip_serializing_if = "Option::is_none", rename = "defaultValue")]
        default_value: Option<f64>,
        #[serde(skip_serializing_if = "Option::is_none")]
        min: Option<f64>,
        #[serde(skip_serializing_if = "Option::is_none")]
        max: Option<f64>,
        #[serde(skip_serializing_if = "Option::is_none")]
        step: Option<f64>,
        #[serde(skip_serializing_if = "Option::is_none")]
        required: Option<bool>,
    },
    #[serde(rename = "password")]
    Password {
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
    #[serde(rename = "radio-group")]
    RadioGroup {
        id: String,
        label: String,
        options: Vec<SelectOption>,
        #[serde(skip_serializing_if = "Option::is_none", rename = "defaultValue")]
        default_value: Option<String>,
        #[serde(skip_serializing_if = "Option::is_none")]
        required: Option<bool>,
    },
    #[serde(rename = "switch")]
    Switch {
        id: String,
        label: String,
        #[serde(skip_serializing_if = "Option::is_none", rename = "defaultChecked")]
        default_checked: Option<bool>,
    },
    #[serde(rename = "date-time")]
    DateTime {
        id: String,
        label: String,
        #[serde(skip_serializing_if = "Option::is_none", rename = "defaultValue")]
        default_value: Option<String>,
        #[serde(skip_serializing_if = "Option::is_none")]
        min: Option<String>,
        #[serde(skip_serializing_if = "Option::is_none")]
        max: Option<String>,
        #[serde(skip_serializing_if = "Option::is_none")]
        required: Option<bool>,
    },
    #[serde(rename = "multi-select")]
    MultiSelect {
        id: String,
        label: String,
        options: Vec<SelectOption>,
        #[serde(skip_serializing_if = "Option::is_none", rename = "defaultValues")]
        default_values: Option<Vec<String>>,
        #[serde(skip_serializing_if = "Option::is_none")]
        required: Option<bool>,
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
    #[serde(rename = "array")]
    Array {
        id: String,
        label: String,
        #[serde(skip_serializing_if = "Option::is_none", rename = "itemLabel")]
        item_label: Option<String>,
        #[serde(skip_serializing_if = "Option::is_none")]
        placeholder: Option<String>,
        #[serde(skip_serializing_if = "Option::is_none", rename = "defaultValues")]
        default_values: Option<Vec<String>>,
        #[serde(skip_serializing_if = "Option::is_none", rename = "minItems")]
        min_items: Option<u32>,
        #[serde(skip_serializing_if = "Option::is_none", rename = "maxItems")]
        max_items: Option<u32>,
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

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TabItem {
    pub id: String,
    pub label: String,
    pub children: Vec<UiBlock>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AccordionItem {
    pub id: String,
    pub title: String,
    pub children: Vec<UiBlock>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UiSelectedFile {
    pub name: String,
    pub size: u64,
    #[serde(default, rename = "type")]
    pub file_type: Option<String>,
    #[serde(default)]
    pub data_url: Option<String>,
    #[serde(default)]
    pub last_modified: Option<u64>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct UiOutputChannels {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub structured: Option<Vec<UiBlock>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub stream: Option<Vec<LogEntry>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub artifacts: Option<Vec<ArtifactAction>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub summary: Option<serde_json::Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct UiResponseEnvelope {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub ui: Option<Vec<UiBlock>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub state: Option<serde_json::Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub output_channels: Option<UiOutputChannels>,
}

// ============================================================================
// Action Payload (deserialized from input when user interacts)
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UiAction {
    pub action: String,
    #[serde(default)]
    pub version: Option<u8>,
    #[serde(default)]
    pub source_type: Option<String>,
    #[serde(default)]
    pub source_id: Option<String>,
    #[serde(default)]
    pub correlation_id: Option<String>,
    #[serde(default)]
    pub runtime_context: Option<HashMap<String, serde_json::Value>>,
    #[serde(default)]
    pub button_id: Option<String>,
    #[serde(default)]
    pub form_id: Option<String>,
    #[serde(default)]
    pub form_data: Option<serde_json::Value>,
    #[serde(default)]
    pub form_data_types: Option<HashMap<String, String>>,
    #[serde(default)]
    pub file_input_id: Option<String>,
    #[serde(default)]
    pub files: Option<Vec<UiSelectedFile>>,
    #[serde(default)]
    pub tab_id: Option<String>,
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

pub fn form(id: &str, fields: Vec<FormField>, submit_label: Option<&str>) -> UiBlock {
    UiBlock::Form {
        id: id.to_string(),
        fields,
        submit_label: submit_label.map(|v| v.to_string()),
    }
}

pub fn select_option(label: &str, value: &str) -> SelectOption {
    SelectOption {
        label: label.to_string(),
        value: value.to_string(),
    }
}

pub fn input_field(
    id: &str,
    label: &str,
    placeholder: Option<&str>,
    default_value: Option<&str>,
    required: Option<bool>,
) -> FormField {
    FormField::Input {
        id: id.to_string(),
        label: label.to_string(),
        placeholder: placeholder.map(|v| v.to_string()),
        default_value: default_value.map(|v| v.to_string()),
        required,
    }
}

pub fn number_field(
    id: &str,
    label: &str,
    placeholder: Option<&str>,
    default_value: Option<f64>,
    min: Option<f64>,
    max: Option<f64>,
    step: Option<f64>,
    required: Option<bool>,
) -> FormField {
    FormField::Number {
        id: id.to_string(),
        label: label.to_string(),
        placeholder: placeholder.map(|v| v.to_string()),
        default_value,
        min,
        max,
        step,
        required,
    }
}

pub fn password_field(
    id: &str,
    label: &str,
    placeholder: Option<&str>,
    default_value: Option<&str>,
    required: Option<bool>,
) -> FormField {
    FormField::Password {
        id: id.to_string(),
        label: label.to_string(),
        placeholder: placeholder.map(|v| v.to_string()),
        default_value: default_value.map(|v| v.to_string()),
        required,
    }
}

pub fn textarea_field(
    id: &str,
    label: &str,
    placeholder: Option<&str>,
    rows: Option<u32>,
) -> FormField {
    FormField::Textarea {
        id: id.to_string(),
        label: label.to_string(),
        placeholder: placeholder.map(|v| v.to_string()),
        rows,
    }
}

pub fn select_field(
    id: &str,
    label: &str,
    options: Vec<SelectOption>,
    default_value: Option<&str>,
) -> FormField {
    FormField::Select {
        id: id.to_string(),
        label: label.to_string(),
        options,
        default_value: default_value.map(|v| v.to_string()),
    }
}

pub fn radio_group_field(
    id: &str,
    label: &str,
    options: Vec<SelectOption>,
    default_value: Option<&str>,
    required: Option<bool>,
) -> FormField {
    FormField::RadioGroup {
        id: id.to_string(),
        label: label.to_string(),
        options,
        default_value: default_value.map(|v| v.to_string()),
        required,
    }
}

pub fn switch_field(id: &str, label: &str, default_checked: Option<bool>) -> FormField {
    FormField::Switch {
        id: id.to_string(),
        label: label.to_string(),
        default_checked,
    }
}

pub fn date_time_field(
    id: &str,
    label: &str,
    default_value: Option<&str>,
    min: Option<&str>,
    max: Option<&str>,
    required: Option<bool>,
) -> FormField {
    FormField::DateTime {
        id: id.to_string(),
        label: label.to_string(),
        default_value: default_value.map(|v| v.to_string()),
        min: min.map(|v| v.to_string()),
        max: max.map(|v| v.to_string()),
        required,
    }
}

pub fn multi_select_field(
    id: &str,
    label: &str,
    options: Vec<SelectOption>,
    default_values: Option<Vec<String>>,
    required: Option<bool>,
) -> FormField {
    FormField::MultiSelect {
        id: id.to_string(),
        label: label.to_string(),
        options,
        default_values,
        required,
    }
}

pub fn checkbox_field(id: &str, label: &str, default_checked: Option<bool>) -> FormField {
    FormField::Checkbox {
        id: id.to_string(),
        label: label.to_string(),
        default_checked,
    }
}

pub fn slider_field(
    id: &str,
    label: &str,
    min: f64,
    max: f64,
    step: Option<f64>,
    default_value: Option<f64>,
) -> FormField {
    FormField::Slider {
        id: id.to_string(),
        label: label.to_string(),
        min,
        max,
        step,
        default_value,
    }
}

pub fn array_field(
    id: &str,
    label: &str,
    item_label: Option<&str>,
    placeholder: Option<&str>,
    default_values: Option<Vec<String>>,
    min_items: Option<u32>,
    max_items: Option<u32>,
) -> FormField {
    FormField::Array {
        id: id.to_string(),
        label: label.to_string(),
        item_label: item_label.map(|v| v.to_string()),
        placeholder: placeholder.map(|v| v.to_string()),
        default_values,
        min_items,
        max_items,
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

pub fn tabs(tab_items: Vec<TabItem>, default_tab: Option<&str>) -> UiBlock {
    UiBlock::Tabs {
        tabs: tab_items,
        default_tab: default_tab.map(|d| d.to_string()),
    }
}

pub fn tab_item(id: &str, label: &str, children: Vec<UiBlock>) -> TabItem {
    TabItem {
        id: id.to_string(),
        label: label.to_string(),
        children,
    }
}

pub fn accordion(items: Vec<AccordionItem>, collapsible: Option<bool>) -> UiBlock {
    UiBlock::Accordion { items, collapsible }
}

pub fn accordion_item(id: &str, title: &str, children: Vec<UiBlock>) -> AccordionItem {
    AccordionItem {
        id: id.to_string(),
        title: title.to_string(),
        children,
    }
}

pub fn copy_button(content: &str, label: Option<&str>) -> UiBlock {
    UiBlock::CopyButton {
        content: content.to_string(),
        label: label.map(|v| v.to_string()),
    }
}

pub fn file_input(
    id: &str,
    label: &str,
    accept: Option<&str>,
    multiple: Option<bool>,
    include_data_url: Option<bool>,
) -> UiBlock {
    UiBlock::FileInput {
        id: id.to_string(),
        label: label.to_string(),
        accept: accept.map(|v| v.to_string()),
        multiple,
        include_data_url,
    }
}

pub fn json_view(data: &serde_json::Value, label: Option<&str>, expanded: Option<bool>) -> UiBlock {
    UiBlock::JsonView {
        data: data.clone(),
        label: label.map(|v| v.to_string()),
        expanded,
    }
}

pub fn description_list(items: &[(&str, &str)]) -> UiBlock {
    UiBlock::DescriptionList {
        items: items
            .iter()
            .map(|(term, description)| DescriptionItem {
                term: term.to_string(),
                description: description.to_string(),
            })
            .collect(),
    }
}

pub fn stat_card(
    id: &str,
    label: &str,
    value: serde_json::Value,
    help_text: Option<&str>,
    status: Option<&str>,
) -> StatCard {
    StatCard {
        id: id.to_string(),
        label: label.to_string(),
        value,
        help_text: help_text.map(|v| v.to_string()),
        status: status.map(|v| v.to_string()),
    }
}

pub fn stat_cards(stats: Vec<StatCard>) -> UiBlock {
    UiBlock::StatCards { stats }
}

pub fn result(
    message: &str,
    status: Option<&str>,
    title: Option<&str>,
    details: Option<&str>,
) -> UiBlock {
    UiBlock::Result {
        message: message.to_string(),
        title: title.map(|v| v.to_string()),
        details: details.map(|v| v.to_string()),
        status: status.map(|v| v.to_string()),
    }
}

pub fn conditional_when(
    path: &str,
    equals: Option<serde_json::Value>,
    not_equals: Option<serde_json::Value>,
    exists: Option<bool>,
) -> ConditionalWhen {
    ConditionalWhen {
        path: path.to_string(),
        equals,
        not_equals,
        exists,
    }
}

pub fn conditional_group(when: ConditionalWhen, children: Vec<UiBlock>) -> UiBlock {
    UiBlock::ConditionalGroup { when, children }
}

pub fn step_item(id: &str, label: &str, children: Vec<UiBlock>) -> StepItem {
    StepItem {
        id: id.to_string(),
        label: label.to_string(),
        children,
    }
}

pub fn stepper(id: &str, steps: Vec<StepItem>, default_step_id: Option<&str>) -> UiBlock {
    UiBlock::Stepper {
        id: id.to_string(),
        steps,
        default_step_id: default_step_id.map(|v| v.to_string()),
    }
}

pub fn log_entry(level: Option<&str>, message: &str, timestamp: Option<&str>) -> LogEntry {
    LogEntry {
        level: level.map(|v| v.to_string()),
        message: message.to_string(),
        timestamp: timestamp.map(|v| v.to_string()),
    }
}

pub fn log_stream(entries: Vec<LogEntry>) -> UiBlock {
    UiBlock::LogStream { entries }
}

pub fn artifact_action(
    id: &str,
    label: &str,
    href: Option<&str>,
    content: Option<&str>,
    action: Option<&str>,
) -> ArtifactAction {
    ArtifactAction {
        id: id.to_string(),
        label: label.to_string(),
        href: href.map(|v| v.to_string()),
        content: content.map(|v| v.to_string()),
        action: action.map(|v| v.to_string()),
    }
}

pub fn artifact_actions(artifacts: Vec<ArtifactAction>) -> UiBlock {
    UiBlock::ArtifactActions { artifacts }
}

// ============================================================================
// Render Functions
// ============================================================================

pub fn render(blocks: &[UiBlock]) -> String {
    let payload = UiResponseEnvelope {
        ui: Some(blocks.to_vec()),
        state: None,
        output_channels: None,
    };
    serde_json::to_string(&payload).unwrap_or_else(|_| "{\"ui\":[]}".to_string())
}

pub fn render_with_state(blocks: &[UiBlock], state: &serde_json::Value) -> String {
    let payload = UiResponseEnvelope {
        ui: Some(blocks.to_vec()),
        state: Some(state.clone()),
        output_channels: None,
    };
    serde_json::to_string(&payload).unwrap_or_else(|_| "{\"ui\":[]}".to_string())
}

pub fn render_with_channels(
    blocks: &[UiBlock],
    output_channels: UiOutputChannels,
    state: Option<&serde_json::Value>,
) -> String {
    let payload = UiResponseEnvelope {
        ui: Some(blocks.to_vec()),
        state: state.cloned(),
        output_channels: Some(output_channels),
    };
    serde_json::to_string(&payload).unwrap_or_else(|_| "{\"ui\":[]}".to_string())
}

pub fn parse_action(input: &str) -> Option<UiAction> {
    serde_json::from_str(input).ok()
}

// ============================================================================
// UI Host Effects
// ============================================================================

pub fn get_context() -> Result<PluginUiContext, Error> {
    let result = unsafe { host::cognia_ui_get_context(String::new())? };
    Ok(serde_json::from_str(&result)?)
}

pub fn request<TData>(input: &PluginUiRequest) -> Result<PluginUiRequestResult<TData>, Error>
where
    TData: for<'de> Deserialize<'de>,
{
    let payload = serde_json::to_string(input)?;
    let result = unsafe { host::cognia_ui_request(payload)? };
    Ok(serde_json::from_str(&result)?)
}

pub fn toast(
    message: &str,
    title: Option<&str>,
    level: Option<&str>,
    correlation_id: Option<&str>,
) -> Result<PluginUiRequestResult<serde_json::Value>, Error> {
    request(&PluginUiRequest::Toast {
        message: message.to_string(),
        title: title.map(|value| value.to_string()),
        level: level.map(|value| value.to_string()),
        correlation_id: correlation_id.map(|value| value.to_string()),
    })
}

pub fn navigate(
    path: &str,
    correlation_id: Option<&str>,
) -> Result<PluginUiRequestResult<serde_json::Value>, Error> {
    request(&PluginUiRequest::Navigate {
        path: path.to_string(),
        correlation_id: correlation_id.map(|value| value.to_string()),
    })
}

pub fn confirm(
    message: &str,
    title: Option<&str>,
    correlation_id: Option<&str>,
) -> Result<PluginUiRequestResult<PluginUiConfirmData>, Error> {
    request(&PluginUiRequest::Confirm {
        message: message.to_string(),
        title: title.map(|value| value.to_string()),
        correlation_id: correlation_id.map(|value| value.to_string()),
    })
}

pub fn pick_file(
    title: Option<&str>,
    default_path: Option<&str>,
    multiple: Option<bool>,
    correlation_id: Option<&str>,
) -> Result<PluginUiRequestResult<PluginUiPathsData>, Error> {
    request(&PluginUiRequest::PickFile {
        title: title.map(|value| value.to_string()),
        default_path: default_path.map(|value| value.to_string()),
        multiple,
        filters: Vec::new(),
        correlation_id: correlation_id.map(|value| value.to_string()),
    })
}

pub fn pick_directory(
    title: Option<&str>,
    default_path: Option<&str>,
    correlation_id: Option<&str>,
) -> Result<PluginUiRequestResult<PluginUiPathData>, Error> {
    request(&PluginUiRequest::PickDirectory {
        title: title.map(|value| value.to_string()),
        default_path: default_path.map(|value| value.to_string()),
        correlation_id: correlation_id.map(|value| value.to_string()),
    })
}

pub fn save_file(
    title: Option<&str>,
    default_path: Option<&str>,
    correlation_id: Option<&str>,
) -> Result<PluginUiRequestResult<PluginUiPathData>, Error> {
    request(&PluginUiRequest::SaveFile {
        title: title.map(|value| value.to_string()),
        default_path: default_path.map(|value| value.to_string()),
        filters: Vec::new(),
        correlation_id: correlation_id.map(|value| value.to_string()),
    })
}

pub fn open_external(
    url: &str,
    correlation_id: Option<&str>,
) -> Result<PluginUiRequestResult<serde_json::Value>, Error> {
    request(&PluginUiRequest::OpenExternal {
        url: url.to_string(),
        correlation_id: correlation_id.map(|value| value.to_string()),
    })
}

pub fn reveal_path(
    path: &str,
    correlation_id: Option<&str>,
) -> Result<PluginUiRequestResult<PluginUiPathData>, Error> {
    request(&PluginUiRequest::RevealPath {
        path: path.to_string(),
        correlation_id: correlation_id.map(|value| value.to_string()),
    })
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
        let block = table(&["Name", "Version"], &[vec!["Node".into(), "20.0".into()]]);
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
    fn test_parse_action_with_v2_metadata() {
        let input = r#"{"action":"form_submit","version":2,"sourceType":"form","sourceId":"dashboard-controls","correlationId":"corr-123","runtimeContext":{"toolId":"demo.tool"},"formDataTypes":{"retryCount":"number"}}"#;
        let action = parse_action(input).unwrap();
        assert_eq!(action.version, Some(2));
        assert_eq!(action.source_type.as_deref(), Some("form"));
        assert_eq!(action.source_id.as_deref(), Some("dashboard-controls"));
        assert_eq!(action.correlation_id.as_deref(), Some("corr-123"));
        let runtime_context = action.runtime_context.unwrap();
        assert_eq!(
            runtime_context
                .get("toolId")
                .and_then(serde_json::Value::as_str),
            Some("demo.tool")
        );
        let form_types = action.form_data_types.unwrap();
        assert_eq!(
            form_types.get("retryCount").map(String::as_str),
            Some("number")
        );
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

    #[test]
    fn test_tabs_block() {
        let block = tabs(
            vec![tab_item("overview", "Overview", vec![text("Hello", None)])],
            Some("overview"),
        );
        let json = serde_json::to_string(&block).unwrap();
        assert!(json.contains("\"type\":\"tabs\""));
        assert!(json.contains("\"defaultTab\":\"overview\""));
    }

    #[test]
    fn test_accordion_block() {
        let block = accordion(
            vec![accordion_item("item-1", "Item 1", vec![text("Body", None)])],
            Some(true),
        );
        let json = serde_json::to_string(&block).unwrap();
        assert!(json.contains("\"type\":\"accordion\""));
        assert!(json.contains("\"collapsible\":true"));
    }

    #[test]
    fn test_copy_button_block() {
        let block = copy_button("secret", Some("Copy"));
        let json = serde_json::to_string(&block).unwrap();
        assert!(json.contains("\"type\":\"copy-button\""));
        assert!(json.contains("\"content\":\"secret\""));
    }

    #[test]
    fn test_file_input_block() {
        let block = file_input(
            "upload",
            "Upload File",
            Some(".json"),
            Some(true),
            Some(false),
        );
        let json = serde_json::to_string(&block).unwrap();
        assert!(json.contains("\"type\":\"file-input\""));
        assert!(json.contains("\"id\":\"upload\""));
        assert!(json.contains("\"includeDataUrl\":false"));
    }

    #[test]
    fn test_extended_form_fields() {
        let fields = vec![
            number_field(
                "retry",
                "Retry",
                None,
                Some(1.0),
                Some(0.0),
                Some(5.0),
                Some(1.0),
                Some(true),
            ),
            password_field("token", "Token", None, None, Some(false)),
            radio_group_field(
                "channel",
                "Channel",
                vec![
                    select_option("Stable", "stable"),
                    select_option("Canary", "canary"),
                ],
                Some("stable"),
                Some(true),
            ),
            switch_field("includePrerelease", "Include Pre-release", Some(false)),
            date_time_field("scheduleAt", "Schedule At", None, None, None, None),
            multi_select_field(
                "targets",
                "Targets",
                vec![
                    select_option("Node", "node"),
                    select_option("Python", "python"),
                ],
                Some(vec!["node".into()]),
                Some(true),
            ),
            array_field(
                "hosts",
                "Hosts",
                Some("Host"),
                Some("localhost"),
                Some(vec!["127.0.0.1".into()]),
                Some(1),
                Some(3),
            ),
        ];
        let block = form("dashboard-controls", fields, Some("Apply"));
        let json = serde_json::to_string(&block).unwrap();
        assert!(json.contains("\"type\":\"form\""));
        assert!(json.contains("\"type\":\"number\""));
        assert!(json.contains("\"type\":\"password\""));
        assert!(json.contains("\"type\":\"radio-group\""));
        assert!(json.contains("\"type\":\"switch\""));
        assert!(json.contains("\"type\":\"date-time\""));
        assert!(json.contains("\"type\":\"multi-select\""));
        assert!(json.contains("\"type\":\"array\""));
    }

    #[test]
    fn test_structured_output_blocks() {
        let blocks = vec![
            result("Conversion complete", Some("success"), Some("Result"), None),
            json_view(&serde_json::json!({"ok": true}), Some("Payload"), None),
            description_list(&[("Provider", "pnpm"), ("Version", "9.0.0")]),
            stat_cards(vec![
                stat_card("total", "Total", serde_json::json!(12), None, None),
                stat_card(
                    "passed",
                    "Passed",
                    serde_json::json!(12),
                    None,
                    Some("success"),
                ),
            ]),
        ];
        let json = serde_json::to_string(&blocks).unwrap();
        assert!(json.contains("\"type\":\"result\""));
        assert!(json.contains("\"type\":\"json-view\""));
        assert!(json.contains("\"type\":\"description-list\""));
        assert!(json.contains("\"type\":\"stat-cards\""));
    }

    #[test]
    fn test_dynamic_blocks() {
        let block = conditional_group(
            conditional_when(
                "state.mode",
                Some(serde_json::json!("advanced")),
                None,
                Some(true),
            ),
            vec![text("Advanced settings", None)],
        );
        let flow = stepper(
            "wizard",
            vec![
                step_item("step-1", "Step 1", vec![text("one", None)]),
                step_item("step-2", "Step 2", vec![text("two", None)]),
            ],
            Some("step-1"),
        );
        let json = serde_json::to_string(&vec![block, flow]).unwrap();
        assert!(json.contains("\"type\":\"conditional-group\""));
        assert!(json.contains("\"type\":\"stepper\""));
    }

    #[test]
    fn test_render_with_channels() {
        let blocks = vec![heading("Summary", 2)];
        let channels = UiOutputChannels {
            structured: Some(vec![result("done", Some("success"), None, None)]),
            stream: Some(vec![log_entry(Some("info"), "running", Some("t0"))]),
            artifacts: Some(vec![artifact_action(
                "report",
                "Report",
                Some("https://example.com"),
                None,
                Some("open"),
            )]),
            summary: Some(serde_json::json!({"message":"ok","status":"success"})),
        };
        let output = render_with_channels(&blocks, channels, None);
        let parsed: serde_json::Value = serde_json::from_str(&output).unwrap();
        assert!(parsed["outputChannels"]["structured"].is_array());
        assert!(parsed["outputChannels"]["stream"].is_array());
        assert!(parsed["outputChannels"]["artifacts"].is_array());
    }
}
