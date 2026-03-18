let readFileSync;
let path;

beforeAll(async () => {
  ({ readFileSync } = await import("node:fs"));
  ({ default: path } = await import("node:path"));
});

describe("src-tauri build script", () => {
  it("does not emit test-only rustc link args", () => {
    const buildScript = readFileSync(
      path.join(process.cwd(), "src-tauri", "build.rs"),
      "utf8",
    );

    expect(buildScript).not.toContain("cargo:rustc-link-arg-tests=");
  });
});
