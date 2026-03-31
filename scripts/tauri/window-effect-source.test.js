let readFileSync;
let path;

beforeAll(async () => {
  ({ readFileSync } = await import("node:fs"));
  ({ default: path } = await import("node:path"));
});

describe("src-tauri window effect source", () => {
  it("guards native window-vibrancy paths out of test builds", () => {
    const source = readFileSync(
      path.join(process.cwd(), "src-tauri", "src", "commands", "window_effect.rs"),
      "utf8",
    );

    expect(source).toMatch(
      /#\[cfg\(all\(target_os = "windows", not\(test\)\)\)\]/,
    );
    expect(source).toMatch(
      /#\[cfg\(all\(target_os = "macos", not\(test\)\)\)\]/,
    );
  });
});
