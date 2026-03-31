fn main() {
    #[cfg(target_os = "windows")]
    {
        let manifest_path = std::path::PathBuf::from(
            std::env::var("CARGO_MANIFEST_DIR").expect("missing CARGO_MANIFEST_DIR"),
        )
        .join("test-common-controls.manifest");
        println!("cargo:rerun-if-changed={}", manifest_path.display());

        // Tauri embeds the manifest for the main app binary, but Rust test harness
        // executables do not get a resource section unless we forward the linker
        // arguments explicitly. Without the common-controls manifest, lib tests can
        // fail at startup when Windows resolves the legacy comctl32 exports.
        println!("cargo:rustc-link-arg=/MANIFEST:EMBED");
        println!(
            "cargo:rustc-link-arg=/MANIFESTINPUT:{}",
            manifest_path.display()
        );
        println!("cargo:rustc-link-arg-bin=cognia-launcher=/MANIFEST:NO");

        let windows = tauri_build::WindowsAttributes::new()
            .app_manifest(include_str!("test-common-controls.manifest"));
        let attributes = tauri_build::Attributes::new().windows_attributes(windows);
        tauri_build::try_build(attributes).expect("failed to run tauri build script");
    }

    #[cfg(not(target_os = "windows"))]
    tauri_build::build()
}
