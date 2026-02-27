import { render, screen } from "@testing-library/react";
import { BubbleHintLayer } from "./bubble-hint-layer";

const mockDismissHint = jest.fn();

jest.mock("next/navigation", () => ({
  usePathname: jest.fn(() => "/"),
}));

jest.mock("@/lib/stores/onboarding", () => ({
  useOnboardingStore: jest.fn(() => ({
    completed: true,
    skipped: false,
    wizardOpen: false,
    tourActive: false,
    dismissedHints: [],
    hintsEnabled: true,
    dismissHint: mockDismissHint,
  })),
}));

jest.mock("./bubble-hint", () => ({
  BubbleHint: ({ hint }: { hint: { id: string; titleKey: string } }) => (
    <div data-testid={`bubble-hint-${hint.id}`}>{hint.titleKey}</div>
  ),
}));

jest.mock("@/lib/constants/onboarding", () => ({
  BUBBLE_HINTS: [
    {
      id: "hint-home",
      target: '[data-hint="home"]',
      titleKey: "hint.home.title",
      descKey: "hint.home.desc",
      side: "bottom",
      route: "/",
      showAfterOnboarding: true,
      delay: 500,
    },
    {
      id: "hint-settings",
      target: '[data-hint="settings"]',
      titleKey: "hint.settings.title",
      descKey: "hint.settings.desc",
      side: "right",
      route: "/settings",
      showAfterOnboarding: true,
      delay: 500,
    },
    {
      id: "hint-global",
      target: '[data-hint="global"]',
      titleKey: "hint.global.title",
      descKey: "hint.global.desc",
      side: "bottom",
      showAfterOnboarding: false,
      delay: 500,
    },
  ],
}));

const { useOnboardingStore } = jest.requireMock("@/lib/stores/onboarding");
const { usePathname } = jest.requireMock("next/navigation");

describe("BubbleHintLayer", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (usePathname as jest.Mock).mockReturnValue("/");
    (useOnboardingStore as jest.Mock).mockReturnValue({
      completed: true,
      skipped: false,
      wizardOpen: false,
      tourActive: false,
      dismissedHints: [],
      hintsEnabled: true,
      dismissHint: mockDismissHint,
    });
  });

  it("returns null when hintsEnabled is false", () => {
    (useOnboardingStore as jest.Mock).mockReturnValue({
      completed: true,
      skipped: false,
      wizardOpen: false,
      tourActive: false,
      dismissedHints: [],
      hintsEnabled: false,
      dismissHint: mockDismissHint,
    });
    const { container } = render(<BubbleHintLayer />);
    expect(container.firstChild).toBeNull();
  });

  it("returns null when wizardOpen is true", () => {
    (useOnboardingStore as jest.Mock).mockReturnValue({
      completed: true,
      skipped: false,
      wizardOpen: true,
      tourActive: false,
      dismissedHints: [],
      hintsEnabled: true,
      dismissHint: mockDismissHint,
    });
    const { container } = render(<BubbleHintLayer />);
    expect(container.firstChild).toBeNull();
  });

  it("returns null when tourActive is true", () => {
    (useOnboardingStore as jest.Mock).mockReturnValue({
      completed: true,
      skipped: false,
      wizardOpen: false,
      tourActive: true,
      dismissedHints: [],
      hintsEnabled: true,
      dismissHint: mockDismissHint,
    });
    const { container } = render(<BubbleHintLayer />);
    expect(container.firstChild).toBeNull();
  });

  it("renders hints matching the current route", () => {
    render(<BubbleHintLayer />);
    // hint-home matches route "/" and showAfterOnboarding + completed
    expect(screen.getByTestId("bubble-hint-hint-home")).toBeInTheDocument();
  });

  it("does not render hints for a different route", () => {
    render(<BubbleHintLayer />);
    // hint-settings requires route "/settings" but we're at "/"
    expect(screen.queryByTestId("bubble-hint-hint-settings")).not.toBeInTheDocument();
  });

  it("filters out dismissed hints", () => {
    (useOnboardingStore as jest.Mock).mockReturnValue({
      completed: true,
      skipped: false,
      wizardOpen: false,
      tourActive: false,
      dismissedHints: ["hint-home"],
      hintsEnabled: true,
      dismissHint: mockDismissHint,
    });
    render(<BubbleHintLayer />);
    expect(screen.queryByTestId("bubble-hint-hint-home")).not.toBeInTheDocument();
  });

  it("respects showAfterOnboarding requirement", () => {
    // hint-global has showAfterOnboarding: false, so it should show even if not completed
    (useOnboardingStore as jest.Mock).mockReturnValue({
      completed: false,
      skipped: false,
      wizardOpen: false,
      tourActive: false,
      dismissedHints: [],
      hintsEnabled: true,
      dismissHint: mockDismissHint,
    });
    render(<BubbleHintLayer />);
    // hint-global doesn't require onboarding and has no route, should render
    expect(screen.getByTestId("bubble-hint-hint-global")).toBeInTheDocument();
    // hint-home requires showAfterOnboarding: true but completed=false
    expect(screen.queryByTestId("bubble-hint-hint-home")).not.toBeInTheDocument();
  });

  it("limits to maxConcurrent hints", () => {
    // Make hint-global also visible (no route, showAfterOnboarding=false)
    // and hint-home visible (route=/, showAfterOnboarding=true, completed=true)
    render(<BubbleHintLayer maxConcurrent={1} />);
    // With maxConcurrent=1, only the first matching hint should render
    const allHints = screen.getAllByTestId(/^bubble-hint-/);
    expect(allHints.length).toBe(1);
  });

  it("renders multiple hints when maxConcurrent allows", () => {
    render(<BubbleHintLayer maxConcurrent={3} />);
    // hint-home (route /, showAfterOnboarding true, completed true)
    // hint-global (no route, showAfterOnboarding false)
    const allHints = screen.getAllByTestId(/^bubble-hint-/);
    expect(allHints.length).toBe(2);
  });
});
