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
});
