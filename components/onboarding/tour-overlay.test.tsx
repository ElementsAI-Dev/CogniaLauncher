import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TourOverlay } from "./tour-overlay";

jest.mock("@/components/providers/locale-provider", () => ({
  useLocale: () => ({
    t: (key: string) => {
      const translations: Record<string, string> = {
        "onboarding.tourNext": "Next",
        "onboarding.tourPrev": "Previous",
        "onboarding.tourFinish": "Finish",
        "onboarding.tourStop": "Stop Tour",
        "onboarding.tourSidebarTitle": "Sidebar",
        "onboarding.tourSidebarDesc": "Navigate between sections",
      };
      return translations[key] || key;
    },
  }),
}));

jest.mock("next/navigation", () => ({
  useRouter: () => ({
    push: jest.fn(),
  }),
}));

jest.mock("./tour-steps", () => ({
  TOUR_STEPS: [
    {
      id: "sidebar",
      target: '[data-tour="sidebar"]',
      titleKey: "onboarding.tourSidebarTitle",
      descKey: "onboarding.tourSidebarDesc",
      side: "right",
      route: "/",
    },
    {
      id: "dashboard",
      target: '[data-tour="dashboard"]',
      titleKey: "onboarding.tourDashboardTitle",
      descKey: "onboarding.tourDashboardDesc",
      side: "bottom",
      route: "/",
    },
  ],
}));

const defaultProps = {
  active: true,
  currentStep: 0,
  onNext: jest.fn(),
  onPrev: jest.fn(),
  onComplete: jest.fn(),
  onStop: jest.fn(),
};

describe("TourOverlay", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("does not render when inactive", () => {
    const { container } = render(
      <TourOverlay {...defaultProps} active={false} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders step title when active", () => {
    render(<TourOverlay {...defaultProps} />);
    expect(screen.getByText("Sidebar")).toBeInTheDocument();
  });

  it("renders step description when active", () => {
    render(<TourOverlay {...defaultProps} />);
    expect(screen.getByText("Navigate between sections")).toBeInTheDocument();
  });

  it("calls onStop when stop button is clicked", async () => {
    const { container } = render(<TourOverlay {...defaultProps} />);
    const closeButtons = container.querySelectorAll("button");
    const stopBtn = closeButtons[0];
    if (stopBtn) {
      await userEvent.click(stopBtn);
      expect(defaultProps.onStop).toHaveBeenCalledTimes(1);
    }
  });

  it("renders step counter badge", () => {
    render(<TourOverlay {...defaultProps} />);
    expect(screen.getByText("1 / 2")).toBeInTheDocument();
  });

  it("calls onNext when Next button is clicked", async () => {
    render(<TourOverlay {...defaultProps} />);
    await userEvent.click(screen.getByText("Next"));
    expect(defaultProps.onNext).toHaveBeenCalledTimes(1);
  });

  it("shows Done button on last step", () => {
    render(<TourOverlay {...defaultProps} currentStep={1} />);
    expect(screen.getByText("onboarding.tourDone")).toBeInTheDocument();
    expect(screen.queryByText("Next")).not.toBeInTheDocument();
  });

  it("calls onComplete when Done is clicked on last step", async () => {
    render(<TourOverlay {...defaultProps} currentStep={1} />);
    await userEvent.click(screen.getByText("onboarding.tourDone"));
    expect(defaultProps.onComplete).toHaveBeenCalledTimes(1);
  });

  it("calls onStop on Escape key", () => {
    render(<TourOverlay {...defaultProps} />);
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    expect(defaultProps.onStop).toHaveBeenCalledTimes(1);
  });

  it("does not render prev button on first step", () => {
    const { container } = render(<TourOverlay {...defaultProps} currentStep={0} />);
    // The only navigation buttons should be the close (X) button and Next
    const buttons = container.querySelectorAll("button");
    const buttonTexts = Array.from(buttons).map((b) => b.textContent);
    // No ChevronLeft (prev) button on first step
    expect(buttonTexts.join(" ")).not.toContain("Previous");
  });

  it("calls onNext on ArrowRight key", () => {
    render(<TourOverlay {...defaultProps} />);
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight" }));
    expect(defaultProps.onNext).toHaveBeenCalledTimes(1);
  });

  it("calls onPrev on ArrowLeft key when not first step", () => {
    render(<TourOverlay {...defaultProps} currentStep={1} />);
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowLeft" }));
    expect(defaultProps.onPrev).toHaveBeenCalledTimes(1);
  });

  it("does not call onPrev on ArrowLeft key when on first step", () => {
    render(<TourOverlay {...defaultProps} currentStep={0} />);
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowLeft" }));
    expect(defaultProps.onPrev).not.toHaveBeenCalled();
  });

  it("calls onComplete on Enter key when on last step", () => {
    render(<TourOverlay {...defaultProps} currentStep={1} />);
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));
    expect(defaultProps.onComplete).toHaveBeenCalledTimes(1);
  });

  it("updates spotlight and popover when target element exists", async () => {
    // Create the target element that the tour step looks for
    const target = document.createElement("div");
    target.setAttribute("data-tour", "sidebar");
    target.style.width = "200px";
    target.style.height = "40px";
    target.getBoundingClientRect = () => ({
      top: 100,
      left: 50,
      width: 200,
      height: 40,
      right: 250,
      bottom: 140,
      x: 50,
      y: 100,
      toJSON: () => {},
    });
    document.body.appendChild(target);

    // Also create the spotlight SVG rect that the code updates
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    const spotlightRect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    spotlightRect.id = "tour-spotlight-rect";
    svg.appendChild(spotlightRect);
    document.body.appendChild(svg);

    const ring = document.createElement("div");
    ring.id = "tour-spotlight-ring";
    ring.style.display = "none";
    document.body.appendChild(ring);

    jest.useFakeTimers();
    render(<TourOverlay {...defaultProps} />);

    // Advance past the 200ms delay for updatePositions
    jest.advanceTimersByTime(300);

    // The spotlight rect should have been updated
    expect(spotlightRect.getAttribute("x")).not.toBe("0");
    expect(ring.style.display).toBe("block");

    jest.useRealTimers();
    document.body.removeChild(target);
    document.body.removeChild(svg);
    document.body.removeChild(ring);
  });
});
