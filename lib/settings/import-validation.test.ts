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

  it("rejects non-object payload roots", () => {
    const result = validateImportPayload('[]', { isTauri: false });
    expect(result.valid).toBe(false);
    expect(result.issues[0]?.code).toBe('invalid_root');
  });

  it("rejects unsupported import versions", () => {
    const result = validateImportPayload(
      JSON.stringify({ version: '9.9', settings: {} }),
      { isTauri: false },
    );
    expect(result.valid).toBe(false);
    expect(result.issues[0]?.code).toBe('unsupported_version');
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

  it("rejects v2.0 payloads without a backendConfig string", () => {
    const result = validateImportPayload(
      JSON.stringify({ version: '2.0', backendConfig: '' }),
      { isTauri: true },
    );
    expect(result.valid).toBe(false);
    expect(result.issues[0]?.code).toBe('invalid_settings_shape');
  });

  it("accepts valid v2.0 desktop payloads", () => {
    const result = validateImportPayload(
      JSON.stringify({
        version: '2.0',
        backendConfig: 'updates.check_on_start=true',
        appSettings: { notifyOnUpdates: false },
        appearancePresets: [{ id: 'preset-1' }],
        appearanceActivePresetId: 'preset-1',
      }),
      { isTauri: true },
    );
    expect(result.valid).toBe(true);
    expect(result.payload).toMatchObject({
      version: '2.0',
      backendConfig: 'updates.check_on_start=true',
      appearanceActivePresetId: 'preset-1',
    });
  });

  it("rejects v1 payloads that omit the settings object", () => {
    const result = validateImportPayload(JSON.stringify({ version: '1.0' }), {
      isTauri: false,
    });
    expect(result.valid).toBe(false);
    expect(result.issues[0]?.code).toBe('invalid_settings_shape');
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

  it("returns an empty diff when v1 settings match the baseline", () => {
    const payload: SettingsImportPayload = {
      version: '1.0',
      settings: {
        'network.timeout': '30',
      },
    };

    expect(buildImportDiffSummary(payload, {
      'network.timeout': '30',
    })).toEqual({
      changedKeys: [],
      affectedSections: [],
    });
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

  it("treats v2 imports as affecting every non-system section", () => {
    const summary = buildImportDiffSummary(
      {
        version: '2.0',
        backendConfig: 'updates.notify=true',
      },
      {},
    );

    expect(summary.changedKeys).toEqual([]);
    expect(summary.affectedSections).toContain('updates');
    expect(summary.affectedSections).not.toContain('system');
  });
});
