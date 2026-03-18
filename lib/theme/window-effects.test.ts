import {
  buildWindowEffectRuntimeState,
  resolveEffectiveWindowEffect,
} from "./window-effects";

describe("resolveEffectiveWindowEffect", () => {
  it("resolves auto to mica when mica is supported", () => {
    expect(
      resolveEffectiveWindowEffect("auto", [
        "auto",
        "none",
        "mica",
        "mica-tabbed",
        "acrylic",
        "blur",
      ]),
    ).toBe("mica");
  });

  it("returns null when the requested effect is unsupported", () => {
    expect(
      resolveEffectiveWindowEffect("mica", ["auto", "none", "vibrancy"]),
    ).toBeNull();
  });

  it("returns null when the requested effect is none", () => {
    expect(
      resolveEffectiveWindowEffect("none", ["auto", "none", "mica"]),
    ).toBeNull();
  });
});

describe("buildWindowEffectRuntimeState", () => {
  it("treats web mode as native-transparency unavailable", () => {
    expect(
      buildWindowEffectRuntimeState({
        requested: "mica",
        supported: [],
        desktop: false,
      }),
    ).toEqual({
      desktop: false,
      nativeAvailable: false,
      requested: "mica",
      requestedSupported: false,
      unsupportedRequested: "mica",
      selectable: ["none"],
      effective: null,
    });
  });

  it("keeps supported desktop options actionable while flagging unsupported requested values", () => {
    expect(
      buildWindowEffectRuntimeState({
        requested: "mica",
        supported: ["auto", "none", "vibrancy"],
        desktop: true,
      }),
    ).toEqual({
      desktop: true,
      nativeAvailable: true,
      requested: "mica",
      requestedSupported: false,
      unsupportedRequested: "mica",
      selectable: ["auto", "none", "vibrancy"],
      effective: null,
    });
  });
});
