import { APPEARANCE_DEFAULTS, parseAppearanceConfig } from "./appearance";

describe("parseAppearanceConfig", () => {
  it("parses valid appearance values", () => {
    const parsed = parseAppearanceConfig({
      "appearance.theme": "dark",
      "appearance.accent_color": "rose",
      "appearance.chart_color_theme": "ocean",
      "appearance.interface_radius": "0.75",
      "appearance.interface_density": "compact",
      "appearance.reduced_motion": "true",
      "appearance.window_effect": "mica",
      "appearance.language": "zh",
    });

    expect(parsed.theme).toBe("dark");
    expect(parsed.accentColor).toBe("rose");
    expect(parsed.chartColorTheme).toBe("ocean");
    expect(parsed.interfaceRadius).toBe(0.75);
    expect(parsed.interfaceDensity).toBe("compact");
    expect(parsed.reducedMotion).toBe(true);
    expect(parsed.windowEffect).toBe("mica");
    expect(parsed.locale).toBe("zh");
    expect(parsed.invalidKeys).toEqual([]);
  });

  it("collects invalid keys for unsupported values", () => {
    const parsed = parseAppearanceConfig({
      "appearance.theme": "invalid",
      "appearance.accent_color": "pink",
      "appearance.chart_color_theme": "neon",
      "appearance.interface_radius": "0.4",
      "appearance.interface_density": "tiny",
      "appearance.reduced_motion": "maybe",
      "appearance.window_effect": "invalid-effect",
      "appearance.language": "fr",
    });

    expect(parsed.theme).toBe("system");
    expect(parsed.accentColor).toBe("blue");
    expect(parsed.chartColorTheme).toBe("default");
    expect(parsed.interfaceRadius).toBe(0.5);
    expect(parsed.interfaceDensity).toBe("comfortable");
    expect(parsed.reducedMotion).toBe(false);
    expect(parsed.windowEffect).toBe("auto");
    expect(parsed.locale).toBe("en");
    expect(parsed.invalidKeys).toEqual([
      "theme",
      "accentColor",
      "chartColorTheme",
      "interfaceRadius",
      "interfaceDensity",
      "reducedMotion",
      "windowEffect",
      "language",
    ]);
  });

  it("returns defaults when values are missing", () => {
    const parsed = parseAppearanceConfig({});

    expect(parsed.theme).toBe(APPEARANCE_DEFAULTS.theme);
    expect(parsed.accentColor).toBe(APPEARANCE_DEFAULTS.accentColor);
    expect(parsed.chartColorTheme).toBe(APPEARANCE_DEFAULTS.chartColorTheme);
    expect(parsed.interfaceRadius).toBe(APPEARANCE_DEFAULTS.interfaceRadius);
    expect(parsed.interfaceDensity).toBe(APPEARANCE_DEFAULTS.interfaceDensity);
    expect(parsed.reducedMotion).toBe(APPEARANCE_DEFAULTS.reducedMotion);
    expect(parsed.windowEffect).toBe(APPEARANCE_DEFAULTS.windowEffect);
    expect(parsed.locale).toBe(APPEARANCE_DEFAULTS.locale);
    expect(parsed.invalidKeys).toEqual([]);
  });

  it("parses valid window_effect values", () => {
    for (const effect of [
      "auto",
      "none",
      "mica",
      "mica-tabbed",
      "acrylic",
      "blur",
      "vibrancy",
    ]) {
      const parsed = parseAppearanceConfig({
        "appearance.window_effect": effect,
      });
      expect(parsed.windowEffect).toBe(effect);
      expect(parsed.invalidKeys).toEqual([]);
    }
  });

  it("rejects invalid window_effect", () => {
    const parsed = parseAppearanceConfig({
      "appearance.window_effect": "frosted",
    });
    expect(parsed.windowEffect).toBe("auto");
    expect(parsed.invalidKeys).toContain("windowEffect");
  });

  it("parses interface_radius with valid numeric strings", () => {
    const parsed = parseAppearanceConfig({
      "appearance.interface_radius": "0",
    });
    expect(parsed.interfaceRadius).toBe(0);
    expect(parsed.invalidKeys).toEqual([]);
  });

  it("rejects non-numeric interface_radius", () => {
    const parsed = parseAppearanceConfig({
      "appearance.interface_radius": "abc",
    });
    expect(parsed.interfaceRadius).toBe(0.625);
    expect(parsed.invalidKeys).toContain("interfaceRadius");
  });

  it("normalizes unsupported interface radius to nearest supported value", () => {
    const parsed = parseAppearanceConfig({
      "appearance.interface_radius": "0.74",
    });
    expect(parsed.interfaceRadius).toBe(0.75);
    expect(parsed.invalidKeys).toContain("interfaceRadius");
  });
});
