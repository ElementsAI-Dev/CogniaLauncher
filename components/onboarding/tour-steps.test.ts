import { TOUR_STEPS } from "@/lib/constants/onboarding";

describe("TOUR_STEPS", () => {
  it("exports a non-empty array", () => {
    expect(Array.isArray(TOUR_STEPS)).toBe(true);
    expect(TOUR_STEPS.length).toBe(6);
  });

  it("each step has all required fields", () => {
    for (const step of TOUR_STEPS) {
      expect(step).toHaveProperty("id");
      expect(step).toHaveProperty("target");
      expect(step).toHaveProperty("titleKey");
      expect(step).toHaveProperty("descKey");
      expect(step).toHaveProperty("side");
      expect(typeof step.id).toBe("string");
      expect(typeof step.target).toBe("string");
      expect(typeof step.titleKey).toBe("string");
      expect(typeof step.descKey).toBe("string");
    }
  });

  it("all step IDs are unique", () => {
    const ids = TOUR_STEPS.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("all side values are valid", () => {
    const validSides = ["top", "bottom", "left", "right"];
    for (const step of TOUR_STEPS) {
      expect(validSides).toContain(step.side);
    }
  });

  it("steps with routes have valid route strings", () => {
    const routeSteps = TOUR_STEPS.filter((s) => s.route);
    expect(routeSteps.length).toBeGreaterThan(0);
    for (const step of routeSteps) {
      expect(step.route).toMatch(/^\//);
    }
  });

  it("all targets use data-tour attribute selectors", () => {
    for (const step of TOUR_STEPS) {
      expect(step.target).toMatch(/\[data-tour=/);
    }
  });

  it("contains known step IDs", () => {
    const ids = TOUR_STEPS.map((s) => s.id);
    expect(ids).toContain("sidebar");
    expect(ids).toContain("dashboard");
    expect(ids).toContain("settings");
    expect(ids).toContain("command-palette");
  });
});
