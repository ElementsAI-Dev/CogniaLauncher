import {
  OnboardingWizard,
  TourOverlay,
  TOUR_STEPS,
  BubbleHint,
  BubbleHintLayer,
  BUBBLE_HINTS,
} from "./index";

describe("onboarding barrel exports", () => {
  it("exports OnboardingWizard", () => {
    expect(OnboardingWizard).toBeDefined();
  });

  it("exports TourOverlay", () => {
    expect(TourOverlay).toBeDefined();
  });

  it("exports TOUR_STEPS", () => {
    expect(TOUR_STEPS).toBeDefined();
    expect(Array.isArray(TOUR_STEPS)).toBe(true);
  });

  it("exports BubbleHint", () => {
    expect(BubbleHint).toBeDefined();
  });

  it("exports BubbleHintLayer", () => {
    expect(BubbleHintLayer).toBeDefined();
  });

  it("exports BUBBLE_HINTS", () => {
    expect(BUBBLE_HINTS).toBeDefined();
    expect(Array.isArray(BUBBLE_HINTS)).toBe(true);
  });
});
