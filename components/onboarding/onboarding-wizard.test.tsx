import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { OnboardingWizard } from "./onboarding-wizard";

// ResizeObserver is required by Radix Tooltip's useSize hook
global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
} as unknown as typeof ResizeObserver;

jest.mock("@/components/providers/locale-provider", () => ({
  useLocale: () => ({
    locale: "en",
    setLocale: jest.fn(),
    t: (key: string, params?: Record<string, string | number>) => {
      const translations: Record<string, string> = {
        "onboarding.wizardTitle": "Setup Wizard",
        "onboarding.wizardDesc": "Get started with CogniaLauncher",
        "onboarding.stepOf": `Step ${params?.current || 1} of ${params?.total || 7}`,
        "onboarding.skip": "Skip",
        "onboarding.back": "Back",
        "onboarding.next": "Next",
        "onboarding.finish": "Finish",
        "onboarding.welcomeTitle": "Welcome",
        "onboarding.welcomeDesc": "Welcome description",
        "onboarding.welcomeFeature1Title": "F1",
        "onboarding.welcomeFeature1Desc": "F1 desc",
        "onboarding.welcomeFeature2Title": "F2",
        "onboarding.welcomeFeature2Desc": "F2 desc",
        "onboarding.welcomeFeature3Title": "F3",
        "onboarding.welcomeFeature3Desc": "F3 desc",
        "onboarding.welcomeHint": "Hint",
      };
      return translations[key] || key;
    },
  }),
}));

jest.mock("next-themes", () => ({
  useTheme: () => ({ theme: "system", setTheme: jest.fn() }),
}));

jest.mock("@/lib/stores/onboarding", () => ({
  ONBOARDING_STEPS: ["welcome", "language", "theme", "environment-detection", "mirrors", "shell-init", "complete"],
}));

jest.mock("@/lib/constants/mirrors", () => ({
  MIRROR_PRESETS: {
    default: { labelKey: "default", npm: "npm-url", pypi: "pypi-url", crates: "crates-url", go: "go-url" },
  },
}));

jest.mock("@/lib/tauri", () => ({
  isTauri: () => false,
}));

const defaultProps = {
  open: true,
  currentStep: 0,
  totalSteps: 7,
  progress: 14,
  isFirstStep: true,
  isLastStep: false,
  tourCompleted: false,
  onNext: jest.fn(),
  onPrev: jest.fn(),
  onGoTo: jest.fn(),
  onComplete: jest.fn(),
  onSkip: jest.fn(),
  onStartTour: jest.fn(),
  onClose: jest.fn(),
};

describe("OnboardingWizard", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders when open", () => {
    render(<OnboardingWizard {...defaultProps} />);
    expect(screen.getByText("14%")).toBeInTheDocument();
  });

  it("does not render when closed", () => {
    render(<OnboardingWizard {...defaultProps} open={false} />);
    expect(screen.queryByText("14%")).not.toBeInTheDocument();
  });

  it("renders Next button on first step", () => {
    render(<OnboardingWizard {...defaultProps} />);
    expect(screen.getByText("Next")).toBeInTheDocument();
  });

  it("does not render Back button on first step", () => {
    render(<OnboardingWizard {...defaultProps} />);
    expect(screen.queryByText("Back")).not.toBeInTheDocument();
  });

  it("renders Back button on middle step", () => {
    render(
      <OnboardingWizard
        {...defaultProps}
        currentStep={2}
        isFirstStep={false}
        isLastStep={false}
      />,
    );
    expect(screen.getByText("Back")).toBeInTheDocument();
  });

  it("renders Skip button on middle step", () => {
    render(
      <OnboardingWizard
        {...defaultProps}
        currentStep={2}
        isFirstStep={false}
        isLastStep={false}
      />,
    );
    expect(screen.getByText("Skip")).toBeInTheDocument();
  });

  it("renders Finish button on last step", () => {
    render(
      <OnboardingWizard
        {...defaultProps}
        currentStep={6}
        isFirstStep={false}
        isLastStep={true}
      />,
    );
    expect(screen.getByText("Finish")).toBeInTheDocument();
  });

  it("calls onNext when Next is clicked", async () => {
    render(<OnboardingWizard {...defaultProps} />);
    await userEvent.click(screen.getByText("Next"));
    expect(defaultProps.onNext).toHaveBeenCalledTimes(1);
  });

  it("calls onComplete when Finish is clicked", async () => {
    render(
      <OnboardingWizard
        {...defaultProps}
        currentStep={6}
        isFirstStep={false}
        isLastStep={true}
      />,
    );
    await userEvent.click(screen.getByText("Finish"));
    expect(defaultProps.onComplete).toHaveBeenCalledTimes(1);
  });

  it("calls onSkip when Skip is clicked", async () => {
    render(
      <OnboardingWizard
        {...defaultProps}
        currentStep={2}
        isFirstStep={false}
        isLastStep={false}
      />,
    );
    await userEvent.click(screen.getByText("Skip"));
    expect(defaultProps.onSkip).toHaveBeenCalledTimes(1);
  });

  it("renders step indicators for all steps", () => {
    render(<OnboardingWizard {...defaultProps} />);
    // 7 steps = 7 step indicator buttons (each with aria-label)
    const stepButtons = screen.getAllByRole("button").filter((btn) =>
      btn.classList.contains("rounded-full"),
    );
    expect(stepButtons.length).toBe(7);
  });

  it("calls onPrev when Back is clicked", async () => {
    render(
      <OnboardingWizard
        {...defaultProps}
        currentStep={3}
        isFirstStep={false}
        isLastStep={false}
      />,
    );
    await userEvent.click(screen.getByText("Back"));
    expect(defaultProps.onPrev).toHaveBeenCalledTimes(1);
  });

  it("does not show Skip on first step", () => {
    render(<OnboardingWizard {...defaultProps} />);
    expect(screen.queryByText("Skip")).not.toBeInTheDocument();
  });

  it("does not show Skip on last step", () => {
    render(
      <OnboardingWizard
        {...defaultProps}
        currentStep={6}
        isFirstStep={false}
        isLastStep={true}
      />,
    );
    expect(screen.queryByText("Skip")).not.toBeInTheDocument();
  });

  it("displays progress percentage", () => {
    render(<OnboardingWizard {...defaultProps} progress={57} />);
    expect(screen.getByText("57%")).toBeInTheDocument();
  });

  it("displays step count text", () => {
    render(<OnboardingWizard {...defaultProps} />);
    expect(screen.getByText("Step 1 of 7")).toBeInTheDocument();
  });

  it("calls onNext on ArrowRight key", () => {
    render(<OnboardingWizard {...defaultProps} />);
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight" }));
    expect(defaultProps.onNext).toHaveBeenCalledTimes(1);
  });

  it("calls onPrev on ArrowLeft key when not first step", () => {
    render(
      <OnboardingWizard {...defaultProps} currentStep={3} isFirstStep={false} isLastStep={false} />,
    );
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowLeft" }));
    expect(defaultProps.onPrev).toHaveBeenCalledTimes(1);
  });

  it("does not call onPrev on ArrowLeft when on first step", () => {
    render(<OnboardingWizard {...defaultProps} />);
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowLeft" }));
    expect(defaultProps.onPrev).not.toHaveBeenCalled();
  });

  it("calls onComplete on Enter key when on last step", () => {
    render(
      <OnboardingWizard {...defaultProps} currentStep={6} isFirstStep={false} isLastStep={true} />,
    );
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));
    expect(defaultProps.onComplete).toHaveBeenCalledTimes(1);
  });

  it("calls onSkip on Escape key", () => {
    render(<OnboardingWizard {...defaultProps} />);
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    expect(defaultProps.onSkip).toHaveBeenCalledTimes(1);
  });

  it("does not respond to keyboard when closed", () => {
    render(<OnboardingWizard {...defaultProps} open={false} />);
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight" }));
    expect(defaultProps.onNext).not.toHaveBeenCalled();
  });

  it("applies slide animation class to step content", () => {
    render(<OnboardingWizard {...defaultProps} />);
    // Dialog renders in a portal, so query the entire document
    const animatedDiv = document.querySelector(".animate-in");
    expect(animatedDiv).not.toBeNull();
  });
});
