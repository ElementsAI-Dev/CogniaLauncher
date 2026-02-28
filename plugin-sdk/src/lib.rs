//! # Cognia Plugin SDK
//!
//! Type-safe Rust SDK for building CogniaLauncher WASM plugins.
//!
//! ## Quick Start
//!
//! ```rust,ignore
//! use cognia_plugin_sdk::prelude::*;
//!
//! #[plugin_fn]
//! pub fn my_tool(input: String) -> FnResult<String> {
//!     let platform = cognia::platform::info()?;
//!     cognia::log::info(&format!("Running on {}", platform.os))?;
//!     Ok(serde_json::json!({ "os": platform.os }).to_string())
//! }
//! ```

pub mod clipboard;
pub mod config;
pub mod env;
pub mod event;
pub mod fs;
mod host;
pub mod http;
pub mod i18n;
pub mod log;
pub mod notification;
pub mod pkg;
pub mod platform;
pub mod process;
pub mod types;
pub mod ui;

/// Convenience namespace: `use cognia_plugin_sdk::cognia;`
/// then call `cognia::env::detect("node")`, `cognia::log::info("msg")`, etc.
pub mod cognia {
    pub use crate::clipboard;
    pub use crate::config;
    pub use crate::env;
    pub use crate::event;
    pub use crate::fs;
    pub use crate::http;
    pub use crate::i18n;
    pub use crate::log;
    pub use crate::notification;
    pub use crate::pkg;
    pub use crate::platform;
    pub use crate::process;
    pub use crate::ui;
}

/// Prelude: import everything you need for a typical plugin.
pub mod prelude {
    pub use crate::cognia;
    pub use crate::types::*;
    pub use extism_pdk::{plugin_fn, FnResult};
    pub use serde::{Deserialize, Serialize};
    pub use serde_json;
}
