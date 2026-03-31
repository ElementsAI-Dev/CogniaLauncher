let readFileSync;
let path;

beforeAll(async () => {
  ({ readFileSync } = await import("node:fs"));
  ({ default: path } = await import("node:path"));
});

describe("src-tauri build script", () => {
  it("embeds the common-controls manifest for Windows test targets", () => {
    const buildScript = readFileSync(
      path.join(process.cwd(), "src-tauri", "build.rs"),
      "utf8",
    );

    expect(buildScript).toContain("cargo:rustc-link-arg=/MANIFEST:EMBED");
    expect(buildScript).toContain("cargo:rustc-link-arg=/MANIFESTINPUT:");
    expect(buildScript).toContain(
      "cargo:rustc-link-arg-bin=cognia-launcher=/MANIFEST:NO",
    );
  });
});
