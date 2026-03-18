import { render, screen, fireEvent } from "@testing-library/react";
import { WelcomeWidget } from "./welcome-widget";

jest.mock("@/components/providers/locale-provider", () => ({
  useLocale: () => ({ t: (key: string) => key }),
}));

const mockPush = jest.fn();
jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

const mockStartTour = jest.fn();
const mockOnboardingState = {
  completed: false,
  skipped: false,
  sessionState: 'idle' as const,
  canResume: false,
  tourCompleted: false,
  sessionSummary: {
    mode: null,
    locale: null,
    theme: null,
    mirrorPreset: 'default',
    detectedCount: 0,
    primaryEnvironment: null,
    manageableEnvironments: [],
    shellType: null,
    shellConfigured: null,
  },
  startTour: mockStartTour,
};

jest.mock("@/lib/stores/onboarding", () => ({
  useOnboardingStore: jest.fn((selector?: (state: typeof mockOnboardingState) => unknown) =>
    selector ? selector(mockOnboardingState) : mockOnboardingState,
  ),
}));

describe("WelcomeWidget", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockOnboardingState.completed = false;
    mockOnboardingState.skipped = false;
    mockOnboardingState.sessionState = 'idle';
    mockOnboardingState.canResume = false;
    mockOnboardingState.tourCompleted = false;
    mockOnboardingState.sessionSummary = {
      mode: null,
      locale: null,
      theme: null,
      mirrorPreset: 'default',
      detectedCount: 0,
      primaryEnvironment: null,
      manageableEnvironments: [],
      shellType: null,
      shellConfigured: null,
    };
  });

  it("renders when user has no environments and no packages", () => {
    const { container } = render(
      <WelcomeWidget hasEnvironments={false} hasPackages={false} />,
    );
    expect(container.firstChild).not.toBeNull();
  });

  it("renders a workspace-ready summary when user has both environments and packages", () => {
    render(
      <WelcomeWidget hasEnvironments={true} hasPackages={true} />,
    );
    expect(screen.getByText("dashboard.widgets.workspaceReadyTitle")).toBeInTheDocument();
    expect(screen.getByText("dashboard.widgets.workspaceReadyDesc")).toBeInTheDocument();
  });

  it("renders when user has environments but no packages", () => {
    const { container } = render(
      <WelcomeWidget hasEnvironments={true} hasPackages={false} />,
    );
    expect(container.firstChild).not.toBeNull();
  });

  it("renders when user has packages but no environments", () => {
    const { container } = render(
      <WelcomeWidget hasEnvironments={false} hasPackages={true} />,
    );
    expect(container.firstChild).not.toBeNull();
  });

  it("renders welcome title", () => {
    render(<WelcomeWidget hasEnvironments={false} hasPackages={false} />);
    expect(screen.getByText("dashboard.widgets.welcomeTitle")).toBeInTheDocument();
  });

  it("renders progress text", () => {
    render(<WelcomeWidget hasEnvironments={false} hasPackages={false} />);
    expect(screen.getByText("dashboard.widgets.welcomeProgress")).toBeInTheDocument();
  });

  it("renders all three steps", () => {
    render(<WelcomeWidget hasEnvironments={false} hasPackages={false} />);
    expect(screen.getByText("dashboard.widgets.welcomeStep1Title")).toBeInTheDocument();
    expect(screen.getByText("dashboard.widgets.welcomeStep2Title")).toBeInTheDocument();
    expect(screen.getByText("dashboard.widgets.welcomeStep3Title")).toBeInTheDocument();
  });

  it("renders step descriptions", () => {
    render(<WelcomeWidget hasEnvironments={false} hasPackages={false} />);
    expect(screen.getByText("dashboard.widgets.welcomeStep1Desc")).toBeInTheDocument();
    expect(screen.getByText("dashboard.widgets.welcomeStep2Desc")).toBeInTheDocument();
    expect(screen.getByText("dashboard.widgets.welcomeStep3Desc")).toBeInTheDocument();
  });

  it("navigates to environments when first step is clicked", () => {
    render(<WelcomeWidget hasEnvironments={false} hasPackages={false} />);
    const step1 = screen.getByText("dashboard.widgets.welcomeStep1Title").closest("button");
    if (step1) fireEvent.click(step1);
    expect(mockPush).toHaveBeenCalledWith("/environments");
  });

  it("navigates to packages when second step is clicked", () => {
    render(<WelcomeWidget hasEnvironments={false} hasPackages={false} />);
    const step2 = screen.getByText("dashboard.widgets.welcomeStep2Title").closest("button");
    if (step2) fireEvent.click(step2);
    expect(mockPush).toHaveBeenCalledWith("/packages");
  });

  it("navigates to settings when third step is clicked", () => {
    render(<WelcomeWidget hasEnvironments={false} hasPackages={false} />);
    const step3 = screen.getByText("dashboard.widgets.welcomeStep3Title").closest("button");
    if (step3) fireEvent.click(step3);
    expect(mockPush).toHaveBeenCalledWith("/settings");
  });

  it("accepts className prop", () => {
    const { container } = render(
      <WelcomeWidget hasEnvironments={false} hasPackages={false} className="custom" />,
    );
    expect(container.firstChild).toHaveClass("custom");
  });

  it("does not render Take Tour button before onboarding is completed or skipped", () => {
    render(<WelcomeWidget hasEnvironments={false} hasPackages={false} />);
    expect(screen.queryByText("dashboard.widgets.welcomeTakeTour")).not.toBeInTheDocument();
  });

  it("renders Take Tour button when onboarding was skipped and tour is still incomplete", () => {
    mockOnboardingState.skipped = true;

    render(<WelcomeWidget hasEnvironments={false} hasPackages={false} />);

    expect(screen.getByText("dashboard.widgets.welcomeTakeTour")).toBeInTheDocument();
  });

  it("calls startTour when Take Tour button is clicked from a valid shortcut state", () => {
    mockOnboardingState.completed = true;

    render(<WelcomeWidget hasEnvironments={false} hasPackages={false} />);
    const tourBtn = screen.getByText("dashboard.widgets.welcomeTakeTour").closest("button");
    if (tourBtn) fireEvent.click(tourBtn);
    expect(mockStartTour).toHaveBeenCalledTimes(1);
  });

  it("navigates from workspace-ready actions", () => {
    render(<WelcomeWidget hasEnvironments={true} hasPackages={true} />);

    fireEvent.click(screen.getByText("dashboard.widgets.welcomeReviewEnvironments"));
    fireEvent.click(screen.getByText("dashboard.widgets.welcomeReviewPackages"));

    expect(mockPush).toHaveBeenCalledWith("/environments");
    expect(mockPush).toHaveBeenCalledWith("/packages");
  });
});
