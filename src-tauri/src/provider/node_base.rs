use crate::error::{CogniaError, CogniaResult};
use crate::platform::process;
use crate::provider::InstallReceipt;
use std::path::PathBuf;

/// Common utilities for Node.js-based package managers (npm, pnpm, yarn)
pub struct NodeProviderUtils;

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
            async fn install_package_common(&self, req: InstallRequest) -> CogniaResult<InstallReceipt> {
                use $crate::provider::node_base::NodeProviderUtils;
                
                let pkg = NodeProviderUtils::build_package_spec(
                    &req.name,
                    req.version.as_deref(),
                    $sep,
                );

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
}
