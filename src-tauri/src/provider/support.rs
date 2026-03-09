use std::collections::HashSet;
use std::time::Duration;

use crate::platform::env::Platform;

use super::Capability;

pub const SUPPORT_STATUS_SUPPORTED: &str = "supported";
pub const SUPPORT_STATUS_PARTIAL: &str = "partial";
pub const SUPPORT_STATUS_UNSUPPORTED: &str = "unsupported";
pub const SUPPORT_STATUS_ERROR: &str = "error";

pub const REASON_PLATFORM_UNSUPPORTED: &str = "platform_unsupported";
pub const REASON_MISSING_UPDATE_CAPABILITY: &str = "missing_update_capability";
pub const REASON_PROVIDER_UNAVAILABLE: &str = "provider_executable_unavailable";
pub const REASON_HEALTH_CHECK_TIMEOUT: &str = "health_check_timeout";
pub const REASON_NO_MATCHING_INSTALLED_PACKAGES: &str = "no_matching_installed_packages";
pub const REASON_INSTALLED_PACKAGE_ENUMERATION_FAILED: &str =
    "installed_package_enumeration_failed";
pub const REASON_NATIVE_UPDATE_FAILED: &str = "native_update_check_failed";
pub const REASON_NATIVE_UPDATE_FAILED_WITH_FALLBACK: &str =
    "native_update_check_failed_with_fallback";

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct SupportReason {
    pub code: &'static str,
    pub message: String,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ProviderAvailabilityProbe {
    Available,
    Unavailable,
    Timeout,
}

impl ProviderAvailabilityProbe {
    pub fn is_available(self) -> bool {
        matches!(self, Self::Available)
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ProviderHealthScope {
    Available,
    Unavailable,
    Timeout,
    Unsupported,
}

impl ProviderHealthScope {
    pub fn as_health_scope_state(self) -> &'static str {
        match self {
            ProviderHealthScope::Available => "available",
            ProviderHealthScope::Unavailable => "unavailable",
            ProviderHealthScope::Timeout => "timeout",
            ProviderHealthScope::Unsupported => "unsupported",
        }
    }

    pub fn is_available(self) -> bool {
        matches!(self, Self::Available)
    }
}

pub fn update_support_reason(
    platform: Platform,
    supported_platforms: &[Platform],
    capabilities: &HashSet<Capability>,
) -> Option<SupportReason> {
    if !supported_platforms.contains(&platform) {
        return Some(SupportReason {
            code: REASON_PLATFORM_UNSUPPORTED,
            message: format!("provider not supported on {}", platform.as_str()),
        });
    }

    if !capabilities.contains(&Capability::Update) && !capabilities.contains(&Capability::Upgrade) {
        return Some(SupportReason {
            code: REASON_MISSING_UPDATE_CAPABILITY,
            message: "provider does not declare update capability".into(),
        });
    }

    None
}

pub fn provider_unavailable_reason() -> SupportReason {
    SupportReason {
        code: REASON_PROVIDER_UNAVAILABLE,
        message: "provider executable is not available".into(),
    }
}

pub fn provider_timeout_reason() -> SupportReason {
    SupportReason {
        code: REASON_HEALTH_CHECK_TIMEOUT,
        message: "provider health check timed out".into(),
    }
}

pub fn classify_provider_scope(
    platform: Platform,
    supported_platforms: &[Platform],
    availability: ProviderAvailabilityProbe,
) -> (ProviderHealthScope, Option<SupportReason>) {
    if !supported_platforms.contains(&platform) {
        return (
            ProviderHealthScope::Unsupported,
            Some(SupportReason {
                code: REASON_PLATFORM_UNSUPPORTED,
                message: format!("provider not supported on {}", platform.as_str()),
            }),
        );
    }

    match availability {
        ProviderAvailabilityProbe::Available => (ProviderHealthScope::Available, None),
        ProviderAvailabilityProbe::Unavailable => (
            ProviderHealthScope::Unavailable,
            Some(provider_unavailable_reason()),
        ),
        ProviderAvailabilityProbe::Timeout => (
            ProviderHealthScope::Timeout,
            Some(provider_timeout_reason()),
        ),
    }
}

pub fn provider_health_probe_timeout(provider_id: &str, is_api_provider: bool) -> Duration {
    if is_api_provider {
        return Duration::from_secs(10);
    }

    match provider_id {
        "wsl" => Duration::from_secs(25),
        "docker" | "podman" => Duration::from_secs(20),
        _ => Duration::from_secs(15),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn update_support_reason_reports_platform_mismatch() {
        let capabilities = HashSet::from([Capability::Update]);
        let reason = update_support_reason(Platform::Windows, &[Platform::Linux], &capabilities)
            .expect("expected reason for unsupported platform");
        assert_eq!(reason.code, REASON_PLATFORM_UNSUPPORTED);
        assert!(reason.message.contains("windows"));
    }

    #[test]
    fn update_support_reason_reports_missing_update_capability() {
        let capabilities = HashSet::from([Capability::Install]);
        let reason = update_support_reason(
            Platform::Windows,
            &[Platform::Windows, Platform::Linux],
            &capabilities,
        )
        .expect("expected reason for missing capability");
        assert_eq!(reason.code, REASON_MISSING_UPDATE_CAPABILITY);
    }

    #[test]
    fn update_support_reason_returns_none_when_supported() {
        let capabilities = HashSet::from([Capability::Update]);
        let reason = update_support_reason(Platform::Windows, &[Platform::Windows], &capabilities);
        assert!(reason.is_none());
    }

    #[test]
    fn provider_unavailable_reason_has_stable_code() {
        let reason = provider_unavailable_reason();
        assert_eq!(reason.code, REASON_PROVIDER_UNAVAILABLE);
        assert_eq!(reason.message, "provider executable is not available");
    }

    #[test]
    fn provider_timeout_reason_has_stable_code() {
        let reason = provider_timeout_reason();
        assert_eq!(reason.code, REASON_HEALTH_CHECK_TIMEOUT);
        assert_eq!(reason.message, "provider health check timed out");
    }

    #[test]
    fn classify_provider_scope_reports_timeout_when_probe_times_out() {
        let (scope, reason) = classify_provider_scope(
            Platform::Windows,
            &[Platform::Windows],
            ProviderAvailabilityProbe::Timeout,
        );

        assert_eq!(scope, ProviderHealthScope::Timeout);
        assert_eq!(
            reason.as_ref().map(|r| r.code),
            Some(REASON_HEALTH_CHECK_TIMEOUT)
        );
    }

    #[test]
    fn classify_provider_scope_reports_unsupported_platform_first() {
        let (scope, reason) = classify_provider_scope(
            Platform::Windows,
            &[Platform::Linux],
            ProviderAvailabilityProbe::Available,
        );

        assert_eq!(scope, ProviderHealthScope::Unsupported);
        assert_eq!(
            reason.as_ref().map(|r| r.code),
            Some(REASON_PLATFORM_UNSUPPORTED)
        );
    }

    #[test]
    fn provider_health_probe_timeout_is_provider_aware() {
        assert_eq!(
            provider_health_probe_timeout("wsl", false),
            Duration::from_secs(25)
        );
        assert_eq!(
            provider_health_probe_timeout("github", true),
            Duration::from_secs(10)
        );
        assert_eq!(
            provider_health_probe_timeout("npm", false),
            Duration::from_secs(15)
        );
    }
}
