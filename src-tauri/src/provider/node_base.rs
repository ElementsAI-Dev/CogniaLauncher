use crate::error::{CogniaError, CogniaResult};
use crate::platform::process;
use crate::provider::InstallReceipt;
use std::path::PathBuf;

/// Common utilities for Node.js-based package managers (npm, pnpm, yarn)
pub struct NodeProviderUtils;

/// Split a "name@version" string into (name, version), correctly handling
/// npm scoped packages like `@scope/name@version`.
///
/// Uses `rfind('@')` to locate the version separator (the LAST `@`).
/// For scoped packages, the first `@` is part of the scope, not a version separator.
///
/// # Examples
/// - `"lodash@4.17.21"` → `("lodash", Some("4.17.21"))`
/// - `"@types/node@18.0.0"` → `("@types/node", Some("18.0.0"))`
/// - `"@types/node"` → `("@types/node", None)`
/// - `"lodash"` → `("lodash", None)`
/// - `""` → `("", None)`
pub fn split_name_version(input: &str) -> (&str, Option<&str>) {
    let input = input.trim();
    if input.is_empty() {
        return ("", None);
    }

    // rfind('@') finds the LAST '@' — the version separator.
    // For "@scope/name@version", rfind returns the index of the second '@'.
    // For "@scope/name" (no version), rfind returns index 0 (the scope '@').
    // For "name@version", rfind returns the only '@'.
    if let Some(at_pos) = input.rfind('@') {
        // If at_pos == 0, the only '@' is the scope prefix → no version
        if at_pos == 0 {
            return (input, None);
        }
        let name = &input[..at_pos];
        let version = &input[at_pos + 1..];
        // If version is empty (trailing '@'), treat as no version
        if version.is_empty() {
            (input, None)
        } else {
            (name, Some(version))
        }
    } else {
        (input, None)
    }
}

impl NodeProviderUtils {
    /// Execute a command and return stdout on success
    pub async fn run_command(cmd: &str, args: &[&str]) -> CogniaResult<String> {
        let out = process::execute(cmd, args, None).await?;
        if out.success {
            Ok(out.stdout)
        } else {
            Err(CogniaError::Provider(out.stderr))
        }
    }

    /// Build the package specifier with optional version
    pub fn build_package_spec(name: &str, version: Option<&str>, separator: &str) -> String {
        match version {
            Some(v) => format!("{}{}{}", name, separator, v),
            None => name.to_string(),
        }
    }

    /// Create an install receipt for a Node.js package
    pub fn create_install_receipt(
        name: String,
        version: Option<String>,
        provider_id: &str,
        install_path: PathBuf,
    ) -> InstallReceipt {
        InstallReceipt {
            name,
            version: version.unwrap_or_default(),
            provider: provider_id.to_string(),
            install_path,
            files: vec![],
            installed_at: chrono::Utc::now().to_rfc3339(),
        }
    }

    /// Get the default node_modules path for local installs
    pub fn local_install_path(package_name: &str) -> PathBuf {
        PathBuf::from("node_modules").join(package_name)
    }
}

/// Macro for implementing common Node.js provider patterns
/// This reduces boilerplate across npm, pnpm, and yarn providers
#[macro_export]
macro_rules! impl_node_provider_install {
    (
        $provider:ty,
        $cmd:expr,
        global_args: $global_args:expr,
        local_args: $local_args:expr,
        version_separator: $sep:expr,
        global_dir_method: $global_dir:expr
    ) => {
        impl $provider {
            async fn install_package_common(
                &self,
                req: InstallRequest,
            ) -> CogniaResult<InstallReceipt> {
                use $crate::provider::node_base::NodeProviderUtils;

                let pkg =
                    NodeProviderUtils::build_package_spec(&req.name, req.version.as_deref(), $sep);

                let args: Vec<&str> = if req.global {
                    let mut base: Vec<&str> = $global_args.to_vec();
                    base.push(&pkg);
                    base
                } else {
                    let mut base: Vec<&str> = $local_args.to_vec();
                    base.push(&pkg);
                    base
                };

                NodeProviderUtils::run_command($cmd, &args).await?;

                let install_path = if req.global {
                    $global_dir(self).await.unwrap_or_default()
                } else {
                    NodeProviderUtils::local_install_path(&req.name)
                };

                Ok(NodeProviderUtils::create_install_receipt(
                    req.name,
                    req.version,
                    self.id(),
                    install_path,
                ))
            }
        }
    };
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_build_package_spec() {
        assert_eq!(
            NodeProviderUtils::build_package_spec("lodash", Some("4.17.21"), "@"),
            "lodash@4.17.21"
        );
        assert_eq!(
            NodeProviderUtils::build_package_spec("lodash", None, "@"),
            "lodash"
        );
        assert_eq!(
            NodeProviderUtils::build_package_spec("requests", Some("2.28.0"), "=="),
            "requests==2.28.0"
        );
    }

    #[test]
    fn test_local_install_path() {
        let path = NodeProviderUtils::local_install_path("express");
        assert_eq!(path, PathBuf::from("node_modules/express"));
    }

    #[test]
    fn test_split_name_version_simple() {
        assert_eq!(split_name_version("lodash"), ("lodash", None));
        assert_eq!(split_name_version("express"), ("express", None));
        assert_eq!(split_name_version("cli-service"), ("cli-service", None));
    }

    #[test]
    fn test_split_name_version_with_version() {
        assert_eq!(
            split_name_version("lodash@4.17.21"),
            ("lodash", Some("4.17.21"))
        );
        assert_eq!(
            split_name_version("express@4.18.2"),
            ("express", Some("4.18.2"))
        );
        assert_eq!(
            split_name_version("react@18.0.0"),
            ("react", Some("18.0.0"))
        );
    }

    #[test]
    fn test_split_name_version_scoped_no_version() {
        assert_eq!(split_name_version("@types/node"), ("@types/node", None));
        assert_eq!(
            split_name_version("@vue/cli-service"),
            ("@vue/cli-service", None)
        );
        assert_eq!(split_name_version("@angular/core"), ("@angular/core", None));
    }

    #[test]
    fn test_split_name_version_scoped_with_version() {
        assert_eq!(
            split_name_version("@types/node@18.0.0"),
            ("@types/node", Some("18.0.0"))
        );
        assert_eq!(
            split_name_version("@vue/cli-service@5.0.8"),
            ("@vue/cli-service", Some("5.0.8"))
        );
        assert_eq!(
            split_name_version("@types/react@^18.0.0"),
            ("@types/react", Some("^18.0.0"))
        );
    }

    #[test]
    fn test_split_name_version_edge_cases() {
        assert_eq!(split_name_version(""), ("", None));
        assert_eq!(split_name_version("  "), ("", None));
        assert_eq!(split_name_version("lodash@"), ("lodash@", None));
        assert_eq!(
            split_name_version("  lodash@4.0.0  "),
            ("lodash", Some("4.0.0"))
        );
    }

    #[test]
    fn test_split_name_version_dist_tags() {
        assert_eq!(
            split_name_version("lodash@latest"),
            ("lodash", Some("latest"))
        );
        assert_eq!(
            split_name_version("@types/node@latest"),
            ("@types/node", Some("latest"))
        );
        assert_eq!(split_name_version("react@next"), ("react", Some("next")));
    }

    #[test]
    fn test_split_name_version_version_ranges() {
        assert_eq!(
            split_name_version("lodash@^4.0.0"),
            ("lodash", Some("^4.0.0"))
        );
        assert_eq!(
            split_name_version("lodash@~4.0.0"),
            ("lodash", Some("~4.0.0"))
        );
        assert_eq!(
            split_name_version("lodash@>=4.0.0"),
            ("lodash", Some(">=4.0.0"))
        );
        assert_eq!(
            split_name_version("@types/node@>=18.0.0"),
            ("@types/node", Some(">=18.0.0"))
        );
    }
}
