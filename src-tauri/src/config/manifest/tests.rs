use super::*;

#[test]
fn test_manifest_filename_constant() {
    assert_eq!(MANIFEST_FILENAME, "CogniaLauncher.yaml");
}

#[test]
fn test_manifest_default() {
    let m = Manifest::default();
    assert!(m.project.name.is_none());
    assert!(m.project.version.is_none());
    assert!(m.project.description.is_none());
    assert!(m.environments.is_empty());
    assert!(m.packages.is_empty());
    assert!(m.custom_packages.is_empty());
    assert!(m.platforms.is_empty());
    assert!(m.profiles.is_empty());
    assert!(m.hooks.post_install.is_empty());
    assert!(m.hooks.pre_update.is_empty());
    assert!(m.hooks.post_update.is_empty());
}

#[test]
fn test_project_info_default() {
    let p = ProjectInfo::default();
    assert!(p.name.is_none());
    assert!(p.version.is_none());
    assert!(p.description.is_none());
}

#[test]
fn test_platform_override_default() {
    let po = PlatformOverride::default();
    assert!(po.environments.is_empty());
    assert!(po.packages.is_empty());
}

#[test]
fn test_profile_config_default() {
    let pc = ProfileConfig::default();
    assert!(pc.packages.is_empty());
}

#[test]
fn test_hooks_config_default() {
    let hc = HooksConfig::default();
    assert!(hc.post_install.is_empty());
    assert!(hc.pre_update.is_empty());
    assert!(hc.post_update.is_empty());
}

#[test]
fn test_parse_simple_manifest() {
    let yaml = r#"
project:
  name: test-project
  version: 1.0.0

environments:
  node:
    version: ">=18.0.0"
  python:
    version: "~3.11"

packages:
  - git
  - name: docker
    optional: true
"#;

    let manifest: Manifest = serde_yaml::from_str(yaml).unwrap();
    assert_eq!(manifest.project.name, Some("test-project".to_string()));
    assert_eq!(manifest.project.version, Some("1.0.0".to_string()));
    assert_eq!(manifest.environments.len(), 2);
    assert_eq!(manifest.packages.len(), 2);
}

#[test]
fn test_parse_full_manifest() {
    let yaml = r#"
project:
  name: full-project
  version: 2.0.0
  description: A full test project

environments:
  node:
    version: "20.0.0"
    provider: nvm
    components:
      - npm
    targets:
      - x86_64
  rust:
    version: "1.75.0"

packages:
  - git
  - name: docker
    version: ">=24.0"
    provider: brew
    optional: true
    platforms:
      - macos
      - linux

custom_packages:
  - name: mytool
    source:
      github: owner/mytool
      asset_pattern: "mytool-*-linux.tar.gz"
    version: "1.0.0"
    binaries:
      - mytool
    checksum:
      sha256: abc123
    post_install:
      - chmod +x mytool

platforms:
  windows:
    packages:
      - name: winget-tool
        provider: winget

profiles:
  ci:
    packages:
      - lint-tool

hooks:
  post_install:
    - run: "echo done"
      platforms:
        - linux
  pre_update:
    - run: "echo pre"
  post_update:
    - run: "echo post"
"#;

    let m: Manifest = serde_yaml::from_str(yaml).unwrap();
    assert_eq!(m.project.name, Some("full-project".to_string()));
    assert_eq!(
        m.project.description,
        Some("A full test project".to_string())
    );
    assert_eq!(m.environments.len(), 2);

    let node = m.environments.get("node").unwrap();
    assert_eq!(node.version, "20.0.0");
    assert_eq!(node.provider, Some("nvm".to_string()));
    assert_eq!(node.components, vec!["npm".to_string()]);
    assert_eq!(node.targets, vec!["x86_64".to_string()]);

    assert_eq!(m.packages.len(), 2);
    assert_eq!(m.custom_packages.len(), 1);
    assert_eq!(m.custom_packages[0].name, "mytool");
    assert_eq!(
        m.custom_packages[0].source.github,
        Some("owner/mytool".to_string())
    );
    assert_eq!(m.custom_packages[0].binaries, vec!["mytool".to_string()]);
    assert_eq!(
        m.custom_packages[0].checksum.as_ref().unwrap().sha256,
        Some("abc123".to_string())
    );
    assert_eq!(
        m.custom_packages[0].post_install,
        vec!["chmod +x mytool".to_string()]
    );

    assert_eq!(m.platforms.len(), 1);
    assert_eq!(m.platforms.get("windows").unwrap().packages.len(), 1);

    assert_eq!(m.profiles.len(), 1);
    assert_eq!(m.profiles.get("ci").unwrap().packages.len(), 1);

    assert_eq!(m.hooks.post_install.len(), 1);
    assert_eq!(m.hooks.post_install[0].run, "echo done");
    assert_eq!(m.hooks.post_install[0].platforms, vec!["linux".to_string()]);
    assert_eq!(m.hooks.pre_update.len(), 1);
    assert_eq!(m.hooks.post_update.len(), 1);
}

#[test]
fn test_parse_empty_manifest() {
    let yaml = "{}";
    let m: Manifest = serde_yaml::from_str(yaml).unwrap();
    assert!(m.project.name.is_none());
    assert!(m.environments.is_empty());
    assert!(m.packages.is_empty());
}

#[test]
fn test_get_environment_version_found() {
    let yaml = r#"
environments:
  node:
    version: "20.0.0"
  python:
    version: "3.12"
"#;
    let m: Manifest = serde_yaml::from_str(yaml).unwrap();
    assert_eq!(m.get_environment_version("node"), Some("20.0.0"));
    assert_eq!(m.get_environment_version("python"), Some("3.12"));
}

#[test]
fn test_get_environment_version_not_found() {
    let m = Manifest::default();
    assert_eq!(m.get_environment_version("node"), None);
    assert_eq!(m.get_environment_version(""), None);
}

#[test]
fn test_get_effective_packages_base_only() {
    let yaml = r#"
packages:
  - git
  - name: docker
    optional: true
"#;
    let m: Manifest = serde_yaml::from_str(yaml).unwrap();
    let pkgs = m.get_effective_packages("linux", None);
    assert_eq!(pkgs.len(), 2);
}

#[test]
fn test_get_effective_packages_with_platform() {
    let yaml = r#"
packages:
  - git

platforms:
  windows:
    packages:
      - winget-tool
  linux:
    packages:
      - apt-tool
      - snap-tool
"#;
    let m: Manifest = serde_yaml::from_str(yaml).unwrap();

    let linux_pkgs = m.get_effective_packages("linux", None);
    assert_eq!(linux_pkgs.len(), 3); // git + apt-tool + snap-tool

    let win_pkgs = m.get_effective_packages("windows", None);
    assert_eq!(win_pkgs.len(), 2); // git + winget-tool

    let mac_pkgs = m.get_effective_packages("macos", None);
    assert_eq!(mac_pkgs.len(), 1); // git only
}

#[test]
fn test_get_effective_packages_with_profile() {
    let yaml = r#"
packages:
  - git

profiles:
  ci:
    packages:
      - lint-tool
  dev:
    packages:
      - debug-tool
      - test-tool
"#;
    let m: Manifest = serde_yaml::from_str(yaml).unwrap();

    let ci_pkgs = m.get_effective_packages("linux", Some("ci"));
    assert_eq!(ci_pkgs.len(), 2); // git + lint-tool

    let dev_pkgs = m.get_effective_packages("linux", Some("dev"));
    assert_eq!(dev_pkgs.len(), 3); // git + debug-tool + test-tool

    let no_profile = m.get_effective_packages("linux", Some("nonexistent"));
    assert_eq!(no_profile.len(), 1); // git only
}

#[test]
fn test_get_effective_packages_with_both() {
    let yaml = r#"
packages:
  - git

platforms:
  linux:
    packages:
      - apt-tool

profiles:
  ci:
    packages:
      - lint-tool
"#;
    let m: Manifest = serde_yaml::from_str(yaml).unwrap();
    let pkgs = m.get_effective_packages("linux", Some("ci"));
    assert_eq!(pkgs.len(), 3); // git + apt-tool + lint-tool
}

#[test]
fn test_package_dep_methods() {
    let simple = PackageDep::Simple("git".to_string());
    assert_eq!(simple.name(), "git");
    assert!(simple.version().is_none());
    assert!(!simple.is_optional());
    assert!(simple.provider().is_none());

    let detailed = PackageDep::Detailed(DetailedPackageDep {
        name: "docker".to_string(),
        version: Some(">=20.0".to_string()),
        provider: Some("brew".to_string()),
        optional: true,
        platforms: vec!["macos".to_string()],
    });
    assert_eq!(detailed.name(), "docker");
    assert_eq!(detailed.version(), Some(">=20.0"));
    assert_eq!(detailed.provider(), Some("brew"));
    assert!(detailed.is_optional());
    assert!(detailed.supports_platform("macos"));
    assert!(!detailed.supports_platform("windows"));
}

#[test]
fn test_package_dep_provider_simple_none() {
    let simple = PackageDep::Simple("curl".to_string());
    assert!(simple.provider().is_none());
}

#[test]
fn test_package_dep_provider_detailed_none() {
    let detailed = PackageDep::Detailed(DetailedPackageDep {
        name: "curl".to_string(),
        version: None,
        provider: None,
        optional: false,
        platforms: vec![],
    });
    assert!(detailed.provider().is_none());
    assert!(detailed.version().is_none());
    assert!(!detailed.is_optional());
}

#[test]
fn test_package_dep_supports_platform_empty_platforms() {
    let detailed = PackageDep::Detailed(DetailedPackageDep {
        name: "tool".to_string(),
        version: None,
        provider: None,
        optional: false,
        platforms: vec![],
    });
    assert!(detailed.supports_platform("linux"));
    assert!(detailed.supports_platform("windows"));
    assert!(detailed.supports_platform("macos"));
}

#[test]
fn test_package_dep_simple_always_supports_platform() {
    let simple = PackageDep::Simple("git".to_string());
    assert!(simple.supports_platform("linux"));
    assert!(simple.supports_platform("windows"));
    assert!(simple.supports_platform("anything"));
}

#[test]
fn test_serialize_deserialize_roundtrip() {
    let yaml = r#"
project:
  name: roundtrip-test
  version: 1.0.0

environments:
  node:
    version: "20.0.0"

packages:
  - git
  - name: docker
    version: "24.0"
    provider: brew
    optional: true
    platforms:
      - macos
"#;
    let original: Manifest = serde_yaml::from_str(yaml).unwrap();
    let serialized = serde_yaml::to_string(&original).unwrap();
    let parsed: Manifest = serde_yaml::from_str(&serialized).unwrap();

    assert_eq!(parsed.project.name, Some("roundtrip-test".to_string()));
    assert_eq!(parsed.environments.len(), 1);
    assert_eq!(parsed.packages.len(), 2);
    assert_eq!(parsed.get_environment_version("node"), Some("20.0.0"));
}

#[test]
fn test_custom_package_source_fields() {
    let yaml = r#"
custom_packages:
  - name: tool-a
    source:
      github: owner/tool-a
      asset_pattern: "tool-a-*.tar.gz"
  - name: tool-b
    source:
      url: https://example.com/tool-b.zip
"#;
    let m: Manifest = serde_yaml::from_str(yaml).unwrap();
    assert_eq!(m.custom_packages.len(), 2);

    let a = &m.custom_packages[0];
    assert_eq!(a.source.github, Some("owner/tool-a".to_string()));
    assert_eq!(a.source.asset_pattern, Some("tool-a-*.tar.gz".to_string()));
    assert!(a.source.url.is_none());

    let b = &m.custom_packages[1];
    assert!(b.source.github.is_none());
    assert_eq!(
        b.source.url,
        Some("https://example.com/tool-b.zip".to_string())
    );
}

#[test]
fn test_environment_spec_defaults() {
    let yaml = r#"
environments:
  node:
    version: "20.0.0"
"#;
    let m: Manifest = serde_yaml::from_str(yaml).unwrap();
    let node = m.environments.get("node").unwrap();
    assert_eq!(node.version, "20.0.0");
    assert!(node.provider.is_none());
    assert!(node.components.is_empty());
    assert!(node.targets.is_empty());
}
