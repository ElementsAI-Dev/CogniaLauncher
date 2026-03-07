use crate::error::{CogniaError, CogniaResult};
use crate::plugin::manifest::PluginPermissions;
use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet};
use std::path::{Path, PathBuf};

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq, Default)]
#[serde(rename_all = "lowercase")]
pub enum PermissionEnforcementMode {
    #[default]
    Compat,
    Strict,
}

impl PermissionEnforcementMode {
    pub fn from_config_value(value: &str) -> Self {
        if value.eq_ignore_ascii_case("strict") {
            Self::Strict
        } else {
            Self::Compat
        }
    }
}

/// Runtime permission state for a loaded plugin
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PluginPermissionState {
    /// Permissions declared in plugin.toml
    pub declared: PluginPermissions,
    /// Permissions granted by the user (subset of declared)
    pub granted: HashSet<String>,
    /// Permissions explicitly denied by the user
    pub denied: HashSet<String>,
}

impl PluginPermissionState {
    pub fn new(declared: PluginPermissions) -> Self {
        // By default, grant all declared permissions (user can revoke)
        let mut granted = HashSet::new();
        if declared.config_read {
            granted.insert("config_read".to_string());
        }
        if declared.env_read {
            granted.insert("env_read".to_string());
        }
        if declared.pkg_search {
            granted.insert("pkg_search".to_string());
        }
        if declared.clipboard {
            granted.insert("clipboard".to_string());
        }
        if declared.notification {
            granted.insert("notification".to_string());
        }
        // Dangerous permissions require explicit grant
        // config_write, pkg_install, and process_exec are NOT auto-granted
        if !declared.fs_read.is_empty() {
            granted.insert("fs_read".to_string());
        }
        if !declared.fs_write.is_empty() {
            granted.insert("fs_write".to_string());
        }
        if !declared.http.is_empty() {
            granted.insert("http".to_string());
        }

        Self {
            declared,
            granted,
            denied: HashSet::new(),
        }
    }

    pub fn is_granted(&self, permission: &str) -> bool {
        self.granted.contains(permission) && !self.denied.contains(permission)
    }
}

/// Manages permissions for all loaded plugins
pub struct PermissionManager {
    /// plugin_id -> permission state
    states: HashMap<String, PluginPermissionState>,
    /// Base directory for plugin data isolation
    plugins_data_dir: PathBuf,
    /// Runtime policy for permission enforcement.
    mode: PermissionEnforcementMode,
}

impl PermissionManager {
    pub fn new(plugins_data_dir: PathBuf) -> Self {
        Self::with_mode(plugins_data_dir, PermissionEnforcementMode::Compat)
    }

    pub fn with_mode(plugins_data_dir: PathBuf, mode: PermissionEnforcementMode) -> Self {
        Self {
            states: HashMap::new(),
            plugins_data_dir,
            mode,
        }
    }

    pub fn set_mode(&mut self, mode: PermissionEnforcementMode) {
        self.mode = mode;
    }

    pub fn mode(&self) -> PermissionEnforcementMode {
        self.mode
    }

    pub fn register_plugin(&mut self, plugin_id: &str, permissions: PluginPermissions) {
        self.states.insert(
            plugin_id.to_string(),
            PluginPermissionState::new(permissions),
        );
    }

    pub fn unregister_plugin(&mut self, plugin_id: &str) {
        self.states.remove(plugin_id);
    }

    pub fn get_state(&self, plugin_id: &str) -> Option<&PluginPermissionState> {
        self.states.get(plugin_id)
    }

    fn is_declared_permission(state: &PluginPermissionState, permission: &str) -> bool {
        match permission {
            "config_read" => state.declared.config_read,
            "config_write" => state.declared.config_write,
            "env_read" => state.declared.env_read,
            "pkg_search" => state.declared.pkg_search,
            "pkg_install" => state.declared.pkg_install,
            "clipboard" => state.declared.clipboard,
            "notification" => state.declared.notification,
            "process_exec" => state.declared.process_exec,
            "fs_read" => !state.declared.fs_read.is_empty(),
            "fs_write" => !state.declared.fs_write.is_empty(),
            "http" => !state.declared.http.is_empty(),
            _ => false,
        }
    }

    pub fn grant_permission(&mut self, plugin_id: &str, permission: &str) -> CogniaResult<()> {
        let state = self
            .states
            .get_mut(plugin_id)
            .ok_or_else(|| CogniaError::Plugin(format!("Plugin '{}' not found", plugin_id)))?;

        let declared = Self::is_declared_permission(state, permission);
        if !declared {
            if self.mode == PermissionEnforcementMode::Strict {
                return Err(CogniaError::PermissionDenied(format!(
                    "Plugin '{}' did not declare '{}' permission",
                    plugin_id, permission
                )));
            }
            log::warn!(
                "Granting undeclared permission '{}' to plugin '{}' in compat mode",
                permission,
                plugin_id
            );
        }

        state.denied.remove(permission);
        state.granted.insert(permission.to_string());
        Ok(())
    }

    pub fn revoke_permission(&mut self, plugin_id: &str, permission: &str) -> CogniaResult<()> {
        let state = self
            .states
            .get_mut(plugin_id)
            .ok_or_else(|| CogniaError::Plugin(format!("Plugin '{}' not found", plugin_id)))?;
        state.granted.remove(permission);
        state.denied.insert(permission.to_string());
        Ok(())
    }

    /// Check if a plugin has a specific permission at runtime
    pub fn check_permission(&self, plugin_id: &str, permission: &str) -> CogniaResult<()> {
        let state = self
            .states
            .get(plugin_id)
            .ok_or_else(|| CogniaError::Plugin(format!("Plugin '{}' not found", plugin_id)))?;

        if self.mode == PermissionEnforcementMode::Strict
            && !Self::is_declared_permission(state, permission)
        {
            return Err(CogniaError::PermissionDenied(format!(
                "Plugin '{}' did not declare '{}' permission",
                plugin_id, permission
            )));
        }

        if state.is_granted(permission) {
            Ok(())
        } else {
            Err(CogniaError::PermissionDenied(format!(
                "Plugin '{}' does not have '{}' permission",
                plugin_id, permission
            )))
        }
    }

    /// Get the sandboxed data directory for a plugin
    pub fn get_plugin_data_dir(&self, plugin_id: &str) -> PathBuf {
        self.plugins_data_dir.join(plugin_id).join("data")
    }

    /// Validate that a file path is within the plugin's allowed paths
    pub fn check_fs_access(&self, plugin_id: &str, path: &Path, write: bool) -> CogniaResult<()> {
        let state = self
            .states
            .get(plugin_id)
            .ok_or_else(|| CogniaError::Plugin(format!("Plugin '{}' not found", plugin_id)))?;

        let perm_key = if write { "fs_write" } else { "fs_read" };
        if !state.is_granted(perm_key) {
            return Err(CogniaError::PermissionDenied(format!(
                "Plugin '{}' does not have '{}' permission",
                plugin_id, perm_key
            )));
        }

        // Check if path is within plugin data dir
        let data_dir = self.get_plugin_data_dir(plugin_id);
        let canonical = path.canonicalize().unwrap_or_else(|_| path.to_path_buf());
        if !canonical.starts_with(&data_dir) {
            return Err(CogniaError::PermissionDenied(format!(
                "Plugin '{}' cannot access path outside its data directory: {}",
                plugin_id,
                path.display()
            )));
        }

        if self.mode == PermissionEnforcementMode::Strict {
            let rel = canonical
                .strip_prefix(&data_dir)
                .unwrap_or_else(|_| Path::new(""))
                .to_string_lossy()
                .replace('\\', "/");
            let rel = rel.trim_start_matches('/').to_string();
            let allowed_patterns = if write {
                &state.declared.fs_write
            } else {
                &state.declared.fs_read
            };
            let allowed = allowed_patterns
                .iter()
                .any(|pattern| fs_pattern_matches(pattern, &rel));
            if !allowed {
                return Err(CogniaError::PermissionDenied(format!(
                    "Plugin '{}' path '{}' does not match declared {} allowlist",
                    plugin_id, rel, perm_key
                )));
            }
        }

        Ok(())
    }

    /// Validate that a URL is within the plugin's allowed HTTP domains
    pub fn check_http_access(&self, plugin_id: &str, url: &str) -> CogniaResult<()> {
        let state = self
            .states
            .get(plugin_id)
            .ok_or_else(|| CogniaError::Plugin(format!("Plugin '{}' not found", plugin_id)))?;

        if !state.is_granted("http") {
            return Err(CogniaError::PermissionDenied(format!(
                "Plugin '{}' does not have 'http' permission",
                plugin_id
            )));
        }

        // Check against allowed domains
        let allowed = &state.declared.http;
        if allowed.is_empty() {
            if self.mode == PermissionEnforcementMode::Compat {
                log::warn!(
                    "Plugin '{}' has runtime http grant but no declared domains; allowing in compat mode",
                    plugin_id
                );
                return Ok(());
            }
            return Err(CogniaError::PermissionDenied(format!(
                "Plugin '{}' has no allowed HTTP domains",
                plugin_id
            )));
        }

        let parsed = reqwest::Url::parse(url)
            .map_err(|e| CogniaError::Plugin(format!("Invalid URL '{}': {}", url, e)))?;
        let host = parsed.host_str().unwrap_or("");

        for pattern in allowed {
            let pattern_trimmed = pattern
                .trim_start_matches("https://")
                .trim_start_matches("http://")
                .trim_end_matches("/*")
                .trim_end_matches('/');
            if pattern_trimmed.starts_with('*') {
                // Wildcard domain: *.example.com
                let suffix = pattern_trimmed.trim_start_matches('*');
                if host.ends_with(suffix) {
                    return Ok(());
                }
            } else if host == pattern_trimmed {
                return Ok(());
            }
        }

        Err(CogniaError::PermissionDenied(format!(
            "Plugin '{}' is not allowed to access '{}'",
            plugin_id, url
        )))
    }
}

fn normalize_fs_pattern(pattern: &str) -> String {
    let mut normalized = pattern.replace('\\', "/").trim().to_string();
    if let Some(stripped) = normalized.strip_prefix("./") {
        normalized = stripped.to_string();
    }
    if let Some(stripped) = normalized.strip_prefix("data/") {
        normalized = stripped.to_string();
    } else if normalized == "data" {
        normalized.clear();
    }
    normalized.trim_start_matches('/').to_string()
}

fn fs_pattern_matches(pattern: &str, rel_path: &str) -> bool {
    let normalized_pattern = normalize_fs_pattern(pattern);
    let normalized_path = rel_path.replace('\\', "/");
    if normalized_pattern.is_empty() {
        return normalized_path.is_empty();
    }
    wildcard_match(&normalized_pattern, &normalized_path)
}

fn wildcard_match(pattern: &str, text: &str) -> bool {
    let p: Vec<char> = pattern.chars().collect();
    let t: Vec<char> = text.chars().collect();
    let mut dp = vec![vec![false; t.len() + 1]; p.len() + 1];
    dp[0][0] = true;

    for i in 1..=p.len() {
        if p[i - 1] == '*' {
            dp[i][0] = dp[i - 1][0];
        }
    }

    for i in 1..=p.len() {
        for j in 1..=t.len() {
            dp[i][j] = match p[i - 1] {
                '*' => dp[i - 1][j] || dp[i][j - 1],
                '?' => dp[i - 1][j - 1],
                c => dp[i - 1][j - 1] && c == t[j - 1],
            };
        }
    }

    dp[p.len()][t.len()]
}

#[cfg(test)]
mod tests {
    use super::*;

    fn make_perms(overrides: impl FnOnce(&mut PluginPermissions)) -> PluginPermissions {
        let mut p = PluginPermissions::default();
        overrides(&mut p);
        p
    }

    // --- PluginPermissionState ---

    #[test]
    fn test_auto_grant_safe_permissions() {
        let state = PluginPermissionState::new(make_perms(|p| {
            p.config_read = true;
            p.env_read = true;
            p.pkg_search = true;
            p.clipboard = true;
            p.notification = true;
        }));
        assert!(state.is_granted("config_read"));
        assert!(state.is_granted("env_read"));
        assert!(state.is_granted("pkg_search"));
        assert!(state.is_granted("clipboard"));
        assert!(state.is_granted("notification"));
    }

    #[test]
    fn test_dangerous_permissions_not_auto_granted() {
        let state = PluginPermissionState::new(make_perms(|p| {
            p.config_write = true;
            p.pkg_install = true;
        }));
        // config_write and pkg_install are NOT auto-granted
        assert!(!state.is_granted("config_write"));
        assert!(!state.is_granted("pkg_install"));
    }

    #[test]
    fn test_fs_http_auto_granted_when_declared() {
        let state = PluginPermissionState::new(make_perms(|p| {
            p.fs_read = vec!["data/*".into()];
            p.fs_write = vec!["data/*".into()];
            p.http = vec!["api.example.com".into()];
        }));
        assert!(state.is_granted("fs_read"));
        assert!(state.is_granted("fs_write"));
        assert!(state.is_granted("http"));
    }

    #[test]
    fn test_denied_overrides_granted() {
        let mut state = PluginPermissionState::new(make_perms(|p| {
            p.config_read = true;
        }));
        assert!(state.is_granted("config_read"));
        state.denied.insert("config_read".to_string());
        assert!(!state.is_granted("config_read"));
    }

    #[test]
    fn test_default_perms_grant_nothing() {
        let state = PluginPermissionState::new(PluginPermissions::default());
        assert!(state.granted.is_empty());
        assert!(!state.is_granted("config_read"));
        assert!(!state.is_granted("fs_read"));
    }

    // --- PermissionManager ---

    fn test_manager() -> PermissionManager {
        PermissionManager::new(PathBuf::from("/tmp/test-plugins"))
    }

    #[test]
    fn test_register_and_check_permission() {
        let mut mgr = test_manager();
        mgr.register_plugin(
            "test-plugin",
            make_perms(|p| {
                p.config_read = true;
            }),
        );
        assert!(mgr.check_permission("test-plugin", "config_read").is_ok());
        assert!(mgr.check_permission("test-plugin", "config_write").is_err());
    }

    #[test]
    fn test_check_permission_unknown_plugin() {
        let mgr = test_manager();
        assert!(mgr.check_permission("nonexistent", "config_read").is_err());
    }

    #[test]
    fn test_unregister_plugin() {
        let mut mgr = test_manager();
        mgr.register_plugin("p1", PluginPermissions::default());
        assert!(mgr.get_state("p1").is_some());
        mgr.unregister_plugin("p1");
        assert!(mgr.get_state("p1").is_none());
    }

    #[test]
    fn test_grant_and_revoke() {
        let mut mgr = test_manager();
        mgr.register_plugin(
            "p1",
            make_perms(|p| {
                p.config_write = true; // declared but not auto-granted
            }),
        );

        // Not granted initially
        assert!(mgr.check_permission("p1", "config_write").is_err());

        // Grant it
        mgr.grant_permission("p1", "config_write").unwrap();
        assert!(mgr.check_permission("p1", "config_write").is_ok());

        // Revoke it
        mgr.revoke_permission("p1", "config_write").unwrap();
        assert!(mgr.check_permission("p1", "config_write").is_err());
    }

    #[test]
    fn test_grant_unknown_plugin_fails() {
        let mut mgr = test_manager();
        assert!(mgr.grant_permission("nonexistent", "config_read").is_err());
        assert!(mgr.revoke_permission("nonexistent", "config_read").is_err());
    }

    #[test]
    fn test_get_plugin_data_dir() {
        let mgr = PermissionManager::new(PathBuf::from("/data/plugins"));
        let dir = mgr.get_plugin_data_dir("com.example.test");
        assert_eq!(dir, PathBuf::from("/data/plugins/com.example.test/data"));
    }

    #[test]
    fn test_check_http_access_exact_domain() {
        let mut mgr = test_manager();
        mgr.register_plugin(
            "p1",
            make_perms(|p| {
                p.http = vec!["api.example.com".into()];
            }),
        );
        assert!(mgr.check_permission("p1", "http").is_ok());

        // Allowed domain
        assert!(mgr
            .check_http_access("p1", "https://api.example.com/v1/data")
            .is_ok());
        // Disallowed domain
        assert!(mgr
            .check_http_access("p1", "https://evil.com/steal")
            .is_err());
    }

    #[test]
    fn test_check_http_access_wildcard_domain() {
        let mut mgr = test_manager();
        mgr.register_plugin(
            "p1",
            make_perms(|p| {
                p.http = vec!["*.github.com".into()];
            }),
        );

        assert!(mgr
            .check_http_access("p1", "https://api.github.com/repos")
            .is_ok());
        assert!(mgr
            .check_http_access("p1", "https://raw.github.com/file")
            .is_ok());
        assert!(mgr.check_http_access("p1", "https://evil.com/").is_err());
    }

    #[test]
    fn test_check_http_access_no_permission() {
        let mut mgr = test_manager();
        mgr.register_plugin("p1", PluginPermissions::default());
        assert!(mgr.check_http_access("p1", "https://example.com").is_err());
    }

    #[test]
    fn test_check_http_access_invalid_url() {
        let mut mgr = test_manager();
        mgr.register_plugin(
            "p1",
            make_perms(|p| {
                p.http = vec!["example.com".into()];
            }),
        );
        assert!(mgr.check_http_access("p1", "not a url").is_err());
    }

    #[test]
    fn test_process_exec_not_auto_granted() {
        let state = PluginPermissionState::new(make_perms(|p| {
            p.process_exec = true;
        }));
        assert!(!state.is_granted("process_exec"));
    }

    #[test]
    fn test_grant_process_exec() {
        let mut mgr = test_manager();
        mgr.register_plugin(
            "p1",
            make_perms(|p| {
                p.process_exec = true;
            }),
        );
        assert!(mgr.check_permission("p1", "process_exec").is_err());
        mgr.grant_permission("p1", "process_exec").unwrap();
        assert!(mgr.check_permission("p1", "process_exec").is_ok());
    }

    #[test]
    fn test_check_http_access_empty_allowed_domains() {
        let mut mgr = test_manager();
        // http perm is granted but no domains listed—this should be impossible via make_perms
        // but let's test the edge case by manually granting
        mgr.register_plugin("p1", PluginPermissions::default());
        mgr.grant_permission("p1", "http").unwrap();
        assert!(mgr.check_http_access("p1", "https://example.com").is_ok());
    }

    #[test]
    fn test_strict_mode_rejects_undeclared_grant() {
        let mut mgr = PermissionManager::with_mode(
            PathBuf::from("/tmp/test-plugins"),
            PermissionEnforcementMode::Strict,
        );
        mgr.register_plugin("p1", PluginPermissions::default());
        assert!(mgr.grant_permission("p1", "process_exec").is_err());
    }

    #[test]
    fn test_strict_mode_rejects_undeclared_check_even_if_granted() {
        let mut mgr = PermissionManager::with_mode(
            PathBuf::from("/tmp/test-plugins"),
            PermissionEnforcementMode::Strict,
        );
        mgr.register_plugin("p1", PluginPermissions::default());
        if let Some(state) = mgr.states.get_mut("p1") {
            state.granted.insert("process_exec".to_string());
        }

        assert!(mgr.check_permission("p1", "process_exec").is_err());
    }

    #[test]
    fn test_strict_mode_fs_pattern_enforced() {
        let mut mgr = PermissionManager::with_mode(
            PathBuf::from("/tmp/test-plugins"),
            PermissionEnforcementMode::Strict,
        );
        mgr.register_plugin(
            "p1",
            make_perms(|p| {
                p.fs_read = vec!["logs/*.txt".into()];
            }),
        );

        let allowed = mgr.get_plugin_data_dir("p1").join("logs/app.txt");
        let denied = mgr.get_plugin_data_dir("p1").join("cache/app.txt");

        assert!(mgr.check_fs_access("p1", &allowed, false).is_ok());
        assert!(mgr.check_fs_access("p1", &denied, false).is_err());
    }

    #[test]
    fn test_strict_mode_fs_pattern_supports_data_prefix() {
        let mut mgr = PermissionManager::with_mode(
            PathBuf::from("/tmp/test-plugins"),
            PermissionEnforcementMode::Strict,
        );
        mgr.register_plugin(
            "p1",
            make_perms(|p| {
                p.fs_read = vec!["data/logs/*.txt".into()];
            }),
        );

        let allowed = mgr.get_plugin_data_dir("p1").join("logs/app.txt");
        assert!(mgr.check_fs_access("p1", &allowed, false).is_ok());
    }

    #[test]
    fn test_strict_mode_http_requires_declared_domains() {
        let mut mgr = PermissionManager::with_mode(
            PathBuf::from("/tmp/test-plugins"),
            PermissionEnforcementMode::Strict,
        );
        mgr.register_plugin("p1", PluginPermissions::default());
        if let Some(state) = mgr.states.get_mut("p1") {
            state.granted.insert("http".to_string());
        }

        assert!(mgr.check_http_access("p1", "https://example.com").is_err());
    }

    #[test]
    fn test_mode_from_config_value() {
        assert_eq!(
            PermissionEnforcementMode::from_config_value("strict"),
            PermissionEnforcementMode::Strict
        );
        assert_eq!(
            PermissionEnforcementMode::from_config_value("compat"),
            PermissionEnforcementMode::Compat
        );
        assert_eq!(
            PermissionEnforcementMode::from_config_value("unknown"),
            PermissionEnforcementMode::Compat
        );
    }
}
