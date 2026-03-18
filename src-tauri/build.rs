fn main() {
    #[cfg(target_os = "windows")]
    {
        let manifest_path = std::path::PathBuf::from(
            std::env::var("CARGO_MANIFEST_DIR").expect("missing CARGO_MANIFEST_DIR"),
        )
        .join("test-common-controls.manifest");
        println!("cargo:rerun-if-changed={}", manifest_path.display());

        // tauri_build embeds the Windows app manifest for the application binary.
        let windows = tauri_build::WindowsAttributes::new()
            .app_manifest(include_str!("test-common-controls.manifest"));
        let attributes = tauri_build::Attributes::new().windows_attributes(windows);
        tauri_build::try_build(attributes).expect("failed to run tauri build script");
    }

    #[cfg(not(target_os = "windows"))]
    tauri_build::build()
}
