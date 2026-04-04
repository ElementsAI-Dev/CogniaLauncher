use super::*;

#[test]
fn test_lockfile_filename_constant() {
    assert_eq!(LOCKFILE_FILENAME, "CogniaLauncher-lock.yaml");
}

#[test]
fn test_new_lockfile() {
    let lockfile = Lockfile::new();
    assert_eq!(lockfile.lockfile_version, 1);
    assert!(lockfile.environments.is_empty());
    assert!(lockfile.packages.is_empty());
    assert!(lockfile.dependency_graph_hash.is_none());
    assert!(lockfile.generated_by.contains("CogniaLauncher/"));
}

#[test]
fn test_lockfile_default_delegates_to_new() {
    let d = Lockfile::default();
    assert_eq!(d.lockfile_version, 1);
    assert!(d.environments.is_empty());
    assert!(d.packages.is_empty());
    assert!(d.dependency_graph_hash.is_none());
}

#[test]
fn test_lock_environment() {
    let mut lockfile = Lockfile::new();
    lockfile.lock_environment("node", "18.19.0", "nvm");

    assert_eq!(lockfile.get_environment_version("node"), Some("18.19.0"));
    assert_eq!(lockfile.environments.len(), 1);

    let env = lockfile.environments.get("node").unwrap();
    assert_eq!(env.provider, "nvm");
}

#[test]
fn test_lock_environment_overwrite() {
    let mut lockfile = Lockfile::new();
    lockfile.lock_environment("node", "18.19.0", "nvm");
    lockfile.lock_environment("node", "20.0.0", "fnm");

    assert_eq!(lockfile.get_environment_version("node"), Some("20.0.0"));
    assert_eq!(lockfile.environments.len(), 1);
    assert_eq!(lockfile.environments.get("node").unwrap().provider, "fnm");
}

#[test]
fn test_lock_environment_multiple() {
    let mut lockfile = Lockfile::new();
    lockfile.lock_environment("node", "20.0.0", "nvm");
    lockfile.lock_environment("python", "3.12.0", "pyenv");
    lockfile.lock_environment("rust", "1.75.0", "rustup");

    assert_eq!(lockfile.environments.len(), 3);
    assert_eq!(lockfile.get_environment_version("node"), Some("20.0.0"));
    assert_eq!(lockfile.get_environment_version("python"), Some("3.12.0"));
    assert_eq!(lockfile.get_environment_version("rust"), Some("1.75.0"));
}

#[test]
fn test_get_environment_version_not_found() {
    let lockfile = Lockfile::new();
    assert_eq!(lockfile.get_environment_version("node"), None);
    assert_eq!(lockfile.get_environment_version(""), None);
}

#[test]
fn test_lock_package() {
    let mut lockfile = Lockfile::new();
    let pkg = LockedPackage::new("ripgrep", "14.0.3", "github");
    lockfile.lock_package(pkg);

    let locked = lockfile.get_package("ripgrep").unwrap();
    assert_eq!(locked.version, "14.0.3");
    assert_eq!(locked.provider, "github");
}

#[test]
fn test_lock_package_update_existing() {
    let mut lockfile = Lockfile::new();
    lockfile.lock_package(LockedPackage::new("ripgrep", "13.0.0", "github"));
    lockfile.lock_package(LockedPackage::new("ripgrep", "14.0.3", "cargo"));

    assert_eq!(lockfile.packages.len(), 1);
    let locked = lockfile.get_package("ripgrep").unwrap();
    assert_eq!(locked.version, "14.0.3");
    assert_eq!(locked.provider, "cargo");
}

#[test]
fn test_lock_package_multiple() {
    let mut lockfile = Lockfile::new();
    lockfile.lock_package(LockedPackage::new("ripgrep", "14.0.3", "github"));
    lockfile.lock_package(LockedPackage::new("fd", "9.0.0", "cargo"));
    lockfile.lock_package(LockedPackage::new("bat", "0.24.0", "brew"));

    assert_eq!(lockfile.packages.len(), 3);
    assert!(lockfile.get_package("ripgrep").is_some());
    assert!(lockfile.get_package("fd").is_some());
    assert!(lockfile.get_package("bat").is_some());
}

#[test]
fn test_get_package_not_found() {
    let lockfile = Lockfile::new();
    assert!(lockfile.get_package("nonexistent").is_none());
    assert!(lockfile.get_package("").is_none());
}

#[test]
fn test_remove_package_existing() {
    let mut lockfile = Lockfile::new();
    lockfile.lock_package(LockedPackage::new("ripgrep", "14.0.3", "github"));
    lockfile.lock_package(LockedPackage::new("fd", "9.0.0", "cargo"));

    assert!(lockfile.remove_package("ripgrep"));
    assert_eq!(lockfile.packages.len(), 1);
    assert!(lockfile.get_package("ripgrep").is_none());
    assert!(lockfile.get_package("fd").is_some());
}

#[test]
fn test_remove_package_nonexistent() {
    let mut lockfile = Lockfile::new();
    lockfile.lock_package(LockedPackage::new("ripgrep", "14.0.3", "github"));

    assert!(!lockfile.remove_package("nonexistent"));
    assert_eq!(lockfile.packages.len(), 1);
}

#[test]
fn test_update_hash_produces_hex_string() {
    let mut lockfile = Lockfile::new();
    lockfile.lock_environment("node", "20.0.0", "nvm");
    lockfile.lock_package(LockedPackage::new("git", "2.43.0", "apt"));
    lockfile.update_hash();

    let hash = lockfile.dependency_graph_hash.as_ref().unwrap();
    assert_eq!(hash.len(), 64); // SHA256 hex = 64 chars
    assert!(hash.chars().all(|c| c.is_ascii_hexdigit()));
}

#[test]
fn test_update_hash_deterministic() {
    let make = || {
        let mut lf = Lockfile::new();
        lf.lock_package(LockedPackage::new("a", "1.0", "x"));
        lf.update_hash();
        lf.dependency_graph_hash.unwrap()
    };
    assert_eq!(make(), make());
}

#[test]
fn test_update_hash_empty() {
    let mut lockfile = Lockfile::new();
    lockfile.update_hash();
    let hash = lockfile.dependency_graph_hash.as_ref().unwrap();
    assert_eq!(hash.len(), 64);
}

#[test]
fn test_locked_package_new() {
    let pkg = LockedPackage::new("ripgrep", "14.0.3", "github");
    assert_eq!(pkg.name, "ripgrep");
    assert_eq!(pkg.version, "14.0.3");
    assert_eq!(pkg.provider, "github");
    assert!(pkg.checksum.is_none());
    assert!(pkg.source.is_none());
    assert!(pkg.artifacts.is_empty());
}

#[test]
fn test_locked_package_with_checksum() {
    let pkg = LockedPackage::new("rg", "14.0.3", "gh").with_checksum(Some("abc123".to_string()));
    let cs = pkg.checksum.as_ref().unwrap();
    assert_eq!(cs.sha256, Some("abc123".to_string()));
    assert!(cs.sha512.is_none());
}

#[test]
fn test_locked_package_with_checksum_none() {
    let pkg = LockedPackage::new("rg", "14.0.3", "gh").with_checksum(None);
    let cs = pkg.checksum.as_ref().unwrap();
    assert!(cs.sha256.is_none());
    assert!(cs.sha512.is_none());
}

#[test]
fn test_locked_package_with_source() {
    let src = LockedSource {
        github: Some("BurntSushi/ripgrep".to_string()),
        tag: Some("v14.0.3".to_string()),
        url: None,
    };
    let pkg = LockedPackage::new("rg", "14.0.3", "gh").with_source(src);
    let s = pkg.source.as_ref().unwrap();
    assert_eq!(s.github, Some("BurntSushi/ripgrep".to_string()));
    assert_eq!(s.tag, Some("v14.0.3".to_string()));
    assert!(s.url.is_none());
}

#[test]
fn test_locked_package_add_artifact() {
    let mut pkg = LockedPackage::new("rg", "14.0.3", "gh");
    pkg.add_artifact(
        "x86_64-linux",
        LockedArtifact {
            url: "https://example.com/rg.tar.gz".to_string(),
            checksum: ChecksumInfo {
                sha256: Some("deadbeef".to_string()),
                sha512: None,
            },
        },
    );
    assert_eq!(pkg.artifacts.len(), 1);
    let art = pkg.artifacts.get("x86_64-linux").unwrap();
    assert_eq!(art.url, "https://example.com/rg.tar.gz");
    assert_eq!(art.checksum.sha256, Some("deadbeef".to_string()));
}

#[test]
fn test_locked_package_builder_chain() {
    let src = LockedSource {
        github: Some("owner/repo".to_string()),
        tag: None,
        url: Some("https://example.com".to_string()),
    };
    let pkg = LockedPackage::new("tool", "1.0.0", "github")
        .with_checksum(Some("sha".to_string()))
        .with_source(src);

    assert!(pkg.checksum.is_some());
    assert!(pkg.source.is_some());
    assert_eq!(
        pkg.source.as_ref().unwrap().url,
        Some("https://example.com".to_string())
    );
}

#[test]
fn test_serialize_deserialize() {
    let mut lockfile = Lockfile::new();
    lockfile.lock_environment("node", "20.0.0", "nvm");
    lockfile.lock_package(LockedPackage::new("git", "2.43.0", "apt"));

    let yaml = serde_yaml::to_string(&lockfile).unwrap();
    let parsed: Lockfile = serde_yaml::from_str(&yaml).unwrap();

    assert_eq!(parsed.get_environment_version("node"), Some("20.0.0"));
    assert_eq!(parsed.lockfile_version, 1);
    assert_eq!(parsed.packages.len(), 1);
    assert_eq!(parsed.get_package("git").unwrap().version, "2.43.0");
}

#[test]
fn test_serialize_deserialize_with_all_fields() {
    let mut lockfile = Lockfile::new();
    lockfile.lock_environment("node", "20.0.0", "nvm");

    let mut pkg = LockedPackage::new("rg", "14.0.3", "github")
        .with_checksum(Some("abc".to_string()))
        .with_source(LockedSource {
            github: Some("BurntSushi/ripgrep".to_string()),
            tag: Some("v14.0.3".to_string()),
            url: None,
        });
    pkg.add_artifact(
        "x86_64-linux",
        LockedArtifact {
            url: "https://dl.example.com/rg".to_string(),
            checksum: ChecksumInfo {
                sha256: Some("def".to_string()),
                sha512: Some("ghi".to_string()),
            },
        },
    );
    lockfile.lock_package(pkg);
    lockfile.update_hash();

    let yaml = serde_yaml::to_string(&lockfile).unwrap();
    let parsed: Lockfile = serde_yaml::from_str(&yaml).unwrap();

    assert!(parsed.dependency_graph_hash.is_some());
    let p = parsed.get_package("rg").unwrap();
    assert_eq!(p.checksum.as_ref().unwrap().sha256, Some("abc".to_string()));
    assert_eq!(
        p.source.as_ref().unwrap().github,
        Some("BurntSushi/ripgrep".to_string())
    );
    let art = p.artifacts.get("x86_64-linux").unwrap();
    assert_eq!(art.checksum.sha512, Some("ghi".to_string()));
}
