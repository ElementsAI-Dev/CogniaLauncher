use crate::config::Settings;
use log::{debug, info, warn};
use reqwest::Client;
use std::sync::RwLock;
use std::time::Duration;

static SHARED_CLIENT: std::sync::OnceLock<RwLock<Client>> = std::sync::OnceLock::new();

const USER_AGENT: &str = "CogniaLauncher/0.1.0";

/// Build a `reqwest::Proxy` from a proxy URL string and optional no_proxy bypass list.
///
/// Supports http://, https://, and socks5:// URL schemes.
/// Returns `None` if the URL is empty or invalid.
pub fn build_proxy(
    proxy_url: Option<&str>,
    no_proxy: Option<&str>,
) -> Option<reqwest::Proxy> {
    let url = proxy_url?.trim();
    if url.is_empty() {
        return None;
    }

    match reqwest::Proxy::all(url) {
        Ok(mut proxy) => {
            if let Some(np) = no_proxy {
                let np = np.trim();
                if !np.is_empty() {
                    let no_proxy_rule = reqwest::NoProxy::from_string(np);
                    proxy = proxy.no_proxy(no_proxy_rule);
                }
            }
            debug!("Built proxy: {} (no_proxy: {:?})", url, no_proxy);
            Some(proxy)
        }
        Err(e) => {
            warn!("Invalid proxy URL '{}': {}", url, e);
            None
        }
    }
}

/// Build a fully configured `reqwest::Client` from application settings.
///
/// Applies proxy, no_proxy, security settings (certificate verification),
/// timeout, and user-agent.
pub fn build_client(settings: &Settings) -> Client {
    let mut builder = Client::builder()
        .user_agent(USER_AGENT)
        .timeout(Duration::from_secs(settings.network.timeout))
        .connect_timeout(Duration::from_secs(settings.network.timeout));

    // Apply proxy configuration
    if let Some(proxy) = build_proxy(
        settings.network.proxy.as_deref(),
        settings.network.no_proxy.as_deref(),
    ) {
        builder = builder.proxy(proxy);
    }

    // Apply security settings
    if settings.security.allow_self_signed {
        builder = builder.danger_accept_invalid_certs(true);
    }

    builder.build().unwrap_or_else(|e| {
        warn!("Failed to build HTTP client with settings, using default: {}", e);
        Client::new()
    })
}

/// Get a clone of the global shared HTTP client.
///
/// The returned `Client` is cheap to clone (uses `Arc` internally).
/// If the shared client has not been initialized yet, returns a default client.
pub fn get_shared_client() -> Client {
    match SHARED_CLIENT.get() {
        Some(lock) => lock.read().unwrap_or_else(|e| {
            warn!("Shared client lock poisoned, returning inner: {}", e);
            e.into_inner()
        }).clone(),
        None => {
            debug!("Shared client not yet initialized, returning default");
            Client::builder()
                .user_agent(USER_AGENT)
                .timeout(Duration::from_secs(30))
                .build()
                .unwrap_or_default()
        }
    }
}

/// Initialize or rebuild the global shared HTTP client from settings.
///
/// Called at app startup and whenever network/security settings change.
pub fn rebuild_shared_client(settings: &Settings) {
    let client = build_client(settings);
    match SHARED_CLIENT.get() {
        Some(lock) => {
            match lock.write() {
                Ok(mut guard) => {
                    *guard = client;
                    info!("Shared HTTP client rebuilt with updated settings");
                }
                Err(e) => {
                    warn!("Failed to acquire write lock for shared client: {}", e);
                }
            }
        }
        None => {
            let _ = SHARED_CLIENT.set(RwLock::new(client));
            info!("Shared HTTP client initialized");
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_build_proxy_http() {
        let proxy = build_proxy(Some("http://proxy.example.com:8080"), None);
        assert!(proxy.is_some());
    }

    #[test]
    fn test_build_proxy_socks5() {
        let proxy = build_proxy(Some("socks5://127.0.0.1:1080"), None);
        assert!(proxy.is_some());
    }

    #[test]
    fn test_build_proxy_empty() {
        assert!(build_proxy(None, None).is_none());
        assert!(build_proxy(Some(""), None).is_none());
        assert!(build_proxy(Some("  "), None).is_none());
    }

    #[test]
    fn test_build_proxy_with_auth_in_url() {
        let proxy = build_proxy(Some("http://user:pass@proxy.example.com:8080"), None);
        assert!(proxy.is_some());
    }

    #[test]
    fn test_build_proxy_with_no_proxy() {
        let proxy = build_proxy(
            Some("http://proxy.example.com:8080"),
            Some("localhost,127.0.0.1,.internal.com"),
        );
        assert!(proxy.is_some());
    }

    #[test]
    fn test_build_proxy_invalid_url() {
        let proxy = build_proxy(Some("not-a-valid-proxy"), None);
        // reqwest::Proxy::all may or may not reject this depending on version;
        // the important thing is it doesn't panic
        let _ = proxy;
    }

    #[test]
    fn test_build_client_default_settings() {
        let settings = Settings::default();
        let client = build_client(&settings);
        // Should successfully create a client
        assert!(client.get("https://example.com").build().is_ok());
    }

    #[test]
    fn test_build_client_with_proxy() {
        let mut settings = Settings::default();
        settings.network.proxy = Some("http://proxy.example.com:8080".into());
        settings.network.no_proxy = Some("localhost".into());
        let client = build_client(&settings);
        assert!(client.get("https://example.com").build().is_ok());
    }

    #[test]
    fn test_build_client_with_self_signed() {
        let mut settings = Settings::default();
        settings.security.allow_self_signed = true;
        let client = build_client(&settings);
        assert!(client.get("https://example.com").build().is_ok());
    }

    #[test]
    fn test_get_shared_client_before_init() {
        // Before rebuild_shared_client is called, should return a default client
        let client = get_shared_client();
        assert!(client.get("https://example.com").build().is_ok());
    }

    #[test]
    fn test_build_proxy_https() {
        let proxy = build_proxy(Some("https://secure-proxy.example.com:443"), None);
        assert!(proxy.is_some());
    }

    #[test]
    fn test_rebuild_shared_client() {
        let settings = Settings::default();
        rebuild_shared_client(&settings);
        // After rebuild, get_shared_client should work
        let client = get_shared_client();
        assert!(client.get("https://example.com").build().is_ok());
    }

    #[test]
    fn test_build_proxy_with_empty_no_proxy() {
        let proxy = build_proxy(
            Some("http://proxy.example.com:8080"),
            Some(""),
        );
        assert!(proxy.is_some());
    }

    #[test]
    fn test_build_proxy_with_whitespace_no_proxy() {
        let proxy = build_proxy(
            Some("http://proxy.example.com:8080"),
            Some("   "),
        );
        assert!(proxy.is_some());
    }
}
