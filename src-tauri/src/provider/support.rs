use std::collections::HashSet;

use crate::platform::env::Platform;

use super::Capability;

pub const SUPPORT_STATUS_SUPPORTED: &str = "supported";
pub const SUPPORT_STATUS_PARTIAL: &str = "partial";
pub const SUPPORT_STATUS_UNSUPPORTED: &str = "unsupported";
pub const SUPPORT_STATUS_ERROR: &str = "error";

pub const REASON_PLATFORM_UNSUPPORTED: &str = "platform_unsupported";
pub const REASON_MISSING_UPDATE_CAPABILITY: &str = "missing_update_capability";
pub const REASON_PROVIDER_UNAVAILABLE: &str = "provider_executable_unavailable";
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
}
