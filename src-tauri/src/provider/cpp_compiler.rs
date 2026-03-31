use once_cell::sync::Lazy;
use regex::Regex;
use serde::{Deserialize, Serialize};
use std::path::Path;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Default)]
pub struct CppCompilerMetadata {
    pub family: String,
    pub variant: Option<String>,
    pub version: Option<String>,
    pub target_architecture: Option<String>,
    pub host_architecture: Option<String>,
    pub target_triple: Option<String>,
    pub subsystem: Option<String>,
    pub discovery_origin: Option<String>,
    pub executable_name: Option<String>,
}

static CLANG_VERSION_RE: Lazy<Regex> =
    Lazy::new(|| Regex::new(r"(?i)clang version (\d+\.\d+\.\d+)").expect("valid regex"));
static MSVC_VERSION_RE: Lazy<Regex> = Lazy::new(|| {
    Regex::new(r"(?i)c/c\+\+.*compiler version (\d+\.\d+\.\d+)").expect("valid regex")
});
static GENERIC_VERSION_RE: Lazy<Regex> =
    Lazy::new(|| Regex::new(r"(\d+\.\d+\.\d+)").expect("valid regex"));
static TARGET_RE: Lazy<Regex> =
    Lazy::new(|| Regex::new(r"(?im)^target:\s*([^\s]+)").expect("valid regex"));
static FOR_ARCH_RE: Lazy<Regex> =
    Lazy::new(|| Regex::new(r"(?i)\bfor\s+(x64|x86|arm64)\b").expect("valid regex"));

pub fn fingerprint_cpp_compiler(
    command_hint: &str,
    executable_path: &Path,
    stdout: &str,
    stderr: &str,
    discovery_origin: Option<&str>,
) -> Option<CppCompilerMetadata> {
    let basename = executable_path
        .file_name()
        .and_then(|value| value.to_str())
        .unwrap_or(command_hint);
    let basename_lower = basename.to_ascii_lowercase();
    let merged = format!("{}\n{}", stdout, stderr);
    let merged_lower = merged.to_ascii_lowercase();

    let (family, variant) = if basename_lower.contains("clang-cl")
        || merged_lower.contains("clang-cl")
    {
        ("clang", Some("clang-cl".to_string()))
    } else if basename_lower.contains("cl.exe") || basename_lower == "cl" {
        ("msvc", Some("cl".to_string()))
    } else if merged_lower.contains("microsoft (r) c/c++")
        || merged_lower.contains("optimizing compiler")
    {
        ("msvc", Some("cl".to_string()))
    } else if basename_lower.contains("clang++") {
        ("clang", Some("clang++".to_string()))
    } else if merged_lower.contains("clang version") {
        ("clang", Some("clang".to_string()))
    } else if basename_lower.contains("g++") {
        ("gcc", Some("g++".to_string()))
    } else if basename_lower == "c++" {
        if merged_lower.contains("clang") {
            ("clang", Some("clang++".to_string()))
        } else if merged_lower.contains("gcc") || merged_lower.contains("gnu compiler collection") {
            ("gcc", Some("g++".to_string()))
        } else {
            ("gcc", Some("c++".to_string()))
        }
    } else if merged_lower.contains("gnu compiler collection") || merged_lower.contains("gcc") {
        ("gcc", Some("gcc".to_string()))
    } else {
        return None;
    };

    let target_triple = TARGET_RE
        .captures(&merged)
        .and_then(|caps| caps.get(1))
        .map(|value| value.as_str().to_string());
    let target_architecture = target_triple
        .as_deref()
        .and_then(architecture_from_target_triple)
        .or_else(|| architecture_from_compiler_path(executable_path))
        .or_else(|| {
            FOR_ARCH_RE
                .captures(&merged)
                .and_then(|caps| caps.get(1))
                .and_then(|value| normalize_architecture(value.as_str()))
        });

    let version = match family {
        "clang" => CLANG_VERSION_RE
            .captures(&merged)
            .and_then(|caps| caps.get(1))
            .map(|value| value.as_str().to_string())
            .or_else(|| first_generic_version(&merged)),
        "msvc" => MSVC_VERSION_RE
            .captures(&merged)
            .and_then(|caps| caps.get(1))
            .map(|value| value.as_str().to_string())
            .or_else(|| first_generic_version(&merged)),
        _ => first_generic_version(&merged),
    };

    Some(CppCompilerMetadata {
        family: family.to_string(),
        variant,
        version,
        target_architecture,
        host_architecture: None,
        target_triple,
        subsystem: infer_subsystem_from_path(executable_path),
        discovery_origin: discovery_origin.map(|value| value.to_string()),
        executable_name: Some(basename.to_string()),
    })
}

pub fn build_msvc_compiler_metadata(
    executable_path: &Path,
    version: &str,
    discovery_origin: &str,
) -> CppCompilerMetadata {
    let (host_architecture, target_architecture) = infer_msvc_host_target(executable_path);

    CppCompilerMetadata {
        family: "msvc".to_string(),
        variant: Some("cl".to_string()),
        version: Some(version.to_string()),
        target_architecture,
        host_architecture,
        target_triple: None,
        subsystem: None,
        discovery_origin: Some(discovery_origin.to_string()),
        executable_name: executable_path
            .file_name()
            .and_then(|value| value.to_str())
            .map(|value| value.to_string()),
    }
}

pub fn infer_subsystem_from_path(path: &Path) -> Option<String> {
    let lower = path.to_string_lossy().to_ascii_lowercase();
    for subsystem in ["ucrt64", "clang64", "mingw64", "mingw32", "clang32"] {
        if lower.contains(subsystem) {
            return Some(subsystem.to_string());
        }
    }
    None
}

pub fn infer_msvc_host_target(path: &Path) -> (Option<String>, Option<String>) {
    let segments = path
        .iter()
        .filter_map(|segment| segment.to_str())
        .collect::<Vec<_>>();

    let mut host_architecture = None;
    let mut target_architecture = None;

    for (index, segment) in segments.iter().enumerate() {
        let lower = segment.to_ascii_lowercase();
        if let Some(host) = lower.strip_prefix("host") {
            host_architecture = normalize_architecture(host);
            if let Some(next) = segments.get(index + 1) {
                target_architecture = normalize_architecture(next);
            }
        }
    }

    (host_architecture, target_architecture)
}

fn first_generic_version(input: &str) -> Option<String> {
    GENERIC_VERSION_RE
        .captures(input)
        .and_then(|caps| caps.get(1))
        .map(|value| value.as_str().to_string())
}

fn architecture_from_target_triple(target: &str) -> Option<String> {
    target.split('-').next().and_then(normalize_architecture)
}

fn architecture_from_compiler_path(path: &Path) -> Option<String> {
    for segment in path.iter().filter_map(|value| value.to_str()) {
        if let Some(arch) = normalize_architecture(segment) {
            return Some(arch);
        }
    }
    None
}

fn normalize_architecture(raw: &str) -> Option<String> {
    let lower = raw.trim().to_ascii_lowercase();
    match lower.as_str() {
        "x86_64" | "amd64" | "x64" => Some("x64".to_string()),
        "x86" | "i386" | "i686" => Some("x86".to_string()),
        "aarch64" | "arm64" => Some("arm64".to_string()),
        _ => None,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::PathBuf;

    #[test]
    fn fingerprints_clang_cl_compiler_output() {
        let metadata = fingerprint_cpp_compiler(
            "clang-cl",
            Path::new(r"C:\LLVM\bin\clang-cl.exe"),
            "clang version 18.1.8\nTarget: x86_64-pc-windows-msvc\n",
            "",
            Some("path"),
        )
        .expect("expected compiler metadata");

        assert_eq!(metadata.family, "clang");
        assert_eq!(metadata.variant.as_deref(), Some("clang-cl"));
        assert_eq!(metadata.version.as_deref(), Some("18.1.8"));
        assert_eq!(metadata.target_architecture.as_deref(), Some("x64"));
        assert_eq!(
            metadata.target_triple.as_deref(),
            Some("x86_64-pc-windows-msvc")
        );
    }

    #[test]
    fn fingerprints_msys2_gpp_compiler_output() {
        let metadata = fingerprint_cpp_compiler(
            "g++",
            Path::new(r"C:\msys64\ucrt64\bin\g++.exe"),
            "g++ (Rev2, Built by MSYS2 project) 13.2.0\nTarget: x86_64-w64-windows-gnu\n",
            "",
            Some("msys2-root"),
        )
        .expect("expected compiler metadata");

        assert_eq!(metadata.family, "gcc");
        assert_eq!(metadata.variant.as_deref(), Some("g++"));
        assert_eq!(metadata.subsystem.as_deref(), Some("ucrt64"));
        assert_eq!(metadata.target_architecture.as_deref(), Some("x64"));
    }

    #[test]
    fn builds_msvc_metadata_from_host_target_path() {
        let metadata = build_msvc_compiler_metadata(
            Path::new(r"C:\VS\VC\Tools\MSVC\14.42.34433\bin\Hostx64\x64\cl.exe"),
            "19.42.34436",
            "vswhere",
        );

        assert_eq!(metadata.family, "msvc");
        assert_eq!(metadata.variant.as_deref(), Some("cl"));
        assert_eq!(metadata.host_architecture.as_deref(), Some("x64"));
        assert_eq!(metadata.target_architecture.as_deref(), Some("x64"));
        assert_eq!(metadata.discovery_origin.as_deref(), Some("vswhere"));
    }

    #[test]
    fn infers_msvc_arm64_target_from_path() {
        let (host, target) = infer_msvc_host_target(&PathBuf::from(
            r"C:\VS\VC\Tools\MSVC\14.42.34433\bin\Hostx64\arm64\cl.exe",
        ));

        assert_eq!(host.as_deref(), Some("x64"));
        assert_eq!(target.as_deref(), Some("arm64"));
    }
}
