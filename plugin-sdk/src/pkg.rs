use crate::host;
use crate::types::*;
use extism_pdk::*;

/// Search for packages.
pub fn search(query: &str, provider: Option<&str>) -> Result<Vec<PackageSummary>, Error> {
    let input = serde_json::json!({ "query": query, "provider": provider }).to_string();
    let result = unsafe { host::cognia_pkg_search(input)? };
    Ok(serde_json::from_str(&result)?)
}

/// Get detailed package info.
pub fn info(name: &str, provider: Option<&str>) -> Result<PackageInfo, Error> {
    let input = serde_json::json!({ "name": name, "provider": provider }).to_string();
    let result = unsafe { host::cognia_pkg_info(input)? };
    Ok(serde_json::from_str(&result)?)
}

/// Get available versions for a package.
pub fn versions(name: &str, provider: Option<&str>) -> Result<Vec<VersionInfo>, Error> {
    let input = serde_json::json!({ "name": name, "provider": provider }).to_string();
    let result = unsafe { host::cognia_pkg_versions(input)? };
    Ok(serde_json::from_str(&result)?)
}

/// Get dependencies for a specific package version.
pub fn dependencies(name: &str, version: &str, provider: Option<&str>) -> Result<Vec<Dependency>, Error> {
    let input = serde_json::json!({ "name": name, "version": version, "provider": provider }).to_string();
    let result = unsafe { host::cognia_pkg_dependencies(input)? };
    Ok(serde_json::from_str(&result)?)
}

/// List installed packages.
pub fn list_installed(provider: Option<&str>) -> Result<Vec<InstalledPackage>, Error> {
    let input = serde_json::json!({ "provider": provider }).to_string();
    let result = unsafe { host::cognia_pkg_list_installed(input)? };
    Ok(serde_json::from_str(&result)?)
}

/// Check for package updates.
pub fn check_updates(packages: &[&str], provider: &str) -> Result<Vec<UpdateInfo>, Error> {
    let input = serde_json::json!({ "packages": packages, "provider": provider }).to_string();
    let result = unsafe { host::cognia_pkg_check_updates(input)? };
    Ok(serde_json::from_str(&result)?)
}

/// Install a package.
pub fn install(name: &str, version: Option<&str>, provider: Option<&str>) -> Result<InstallReceipt, Error> {
    let input = serde_json::json!({ "name": name, "version": version, "provider": provider }).to_string();
    let result = unsafe { host::cognia_pkg_install(input)? };
    Ok(serde_json::from_str(&result)?)
}

/// Uninstall a package.
pub fn uninstall(name: &str, version: Option<&str>, provider: Option<&str>) -> Result<(), Error> {
    let input = serde_json::json!({ "name": name, "version": version, "provider": provider }).to_string();
    unsafe { host::cognia_pkg_uninstall(input)?; }
    Ok(())
}
