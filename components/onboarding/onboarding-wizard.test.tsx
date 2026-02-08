import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { OnboardingWizard } from "./onboarding-wizard";

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
});
