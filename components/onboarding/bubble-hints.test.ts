import { BUBBLE_HINTS } from "./bubble-hints";

describe("BUBBLE_HINTS", () => {
  it("exports a non-empty array", () => {
    expect(Array.isArray(BUBBLE_HINTS)).toBe(true);
    expect(BUBBLE_HINTS.length).toBe(9);
  });

  it("each hint has all required fields", () => {
    for (const hint of BUBBLE_HINTS) {
      expect(hint).toHaveProperty("id");
      expect(hint).toHaveProperty("target");
      expect(hint).toHaveProperty("titleKey");
      expect(hint).toHaveProperty("descKey");
      expect(hint).toHaveProperty("side");
      expect(hint).toHaveProperty("showAfterOnboarding");
      expect(typeof hint.id).toBe("string");
      expect(typeof hint.target).toBe("string");
      expect(typeof hint.titleKey).toBe("string");
      expect(typeof hint.descKey).toBe("string");
      expect(typeof hint.showAfterOnboarding).toBe("boolean");
    }
  });

  it("all hint IDs are unique", () => {
    const ids = BUBBLE_HINTS.map((h) => h.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("all side values are valid", () => {
    const validSides = ["top", "bottom", "left", "right"];
    for (const hint of BUBBLE_HINTS) {
      expect(validSides).toContain(hint.side);
    }
  });

  it("route-specific hints have valid route strings", () => {
    const routeHints = BUBBLE_HINTS.filter((h) => h.route);
    expect(routeHints.length).toBeGreaterThan(0);
    for (const hint of routeHints) {
      expect(hint.route).toMatch(/^\//);
    }
  });

  it("delay values are positive numbers or undefined", () => {
    for (const hint of BUBBLE_HINTS) {
      if (hint.delay !== undefined) {
        expect(typeof hint.delay).toBe("number");
        expect(hint.delay).toBeGreaterThan(0);
      }
    }
  });

  it("all titleKey and descKey follow onboarding.hints namespace", () => {
    for (const hint of BUBBLE_HINTS) {
      expect(hint.titleKey).toMatch(/^onboarding\.hints\./);
      expect(hint.descKey).toMatch(/^onboarding\.hints\./);
    }
  });

  it("contains known hint IDs", () => {
    const ids = BUBBLE_HINTS.map((h) => h.id);
    expect(ids).toContain("dashboard-customize");
    expect(ids).toContain("command-palette-shortcut");
    expect(ids).toContain("settings-mirrors");
  });
});
