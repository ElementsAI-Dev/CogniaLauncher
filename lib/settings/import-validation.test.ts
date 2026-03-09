import {
  buildImportDiffSummary,
  validateImportPayload,
  type SettingsImportPayload,
} from "./import-validation";

describe("import-validation", () => {
  it("rejects invalid JSON payload", () => {
    const result = validateImportPayload("{invalid", { isTauri: false });
    expect(result.valid).toBe(false);
    expect(result.issues[0]?.code).toBe("json_parse_failed");
  });

  it("rejects v2.0 payload in non-tauri mode", () => {
    const payload = JSON.stringify({
      version: "2.0",
      backendConfig: "a=b",
    });
    const result = validateImportPayload(payload, { isTauri: false });
    expect(result.valid).toBe(false);
    expect(result.issues[0]?.code).toBe("desktop_required");
  });

  it("rejects non-string values in v1 settings payload", () => {
    const payload = JSON.stringify({
      settings: {
        "network.timeout": 30,
      },
    });
    const result = validateImportPayload(payload, { isTauri: false });
    expect(result.valid).toBe(false);
    expect(result.issues[0]?.code).toBe("invalid_setting_value");
  });

  it("builds diff summary for changed v1 keys and sections", () => {
    const payload: SettingsImportPayload = {
      version: "1.0",
      settings: {
        "network.timeout": "20",
        "updates.notify": "false",
        "mirrors.npm": "https://registry.npmjs.org",
      },
    };

    const summary = buildImportDiffSummary(payload, {
      "network.timeout": "30",
      "updates.notify": "true",
      "mirrors.npm": "https://registry.npmjs.org",
    });

    expect(summary.changedKeys).toEqual([
      "network.timeout",
      "updates.notify",
    ]);
    expect(summary.affectedSections).toEqual(["network", "updates"]);
  });
});
