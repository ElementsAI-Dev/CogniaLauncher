import { render, screen, act } from "@testing-library/react";
import { SplashScreen } from "./splash-screen";

jest.mock("@/components/providers/locale-provider", () => ({
  useLocale: () => ({
    t: (key: string) => key,
  }),
}));

const defaultProps = {
  phase: "initializing" as const,
  progress: 50,
  message: "splash.initializing",
  version: "1.0.0",
  onTransitionEnd: jest.fn(),
};

describe("SplashScreen", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("renders with role=status", () => {
    render(<SplashScreen {...defaultProps} />);
    expect(screen.getByRole("status")).toBeInTheDocument();
  });

  it("renders app name", () => {
    render(<SplashScreen {...defaultProps} />);
    expect(screen.getByText("CogniaLauncher")).toBeInTheDocument();
  });

  it("renders version when provided", () => {
    render(<SplashScreen {...defaultProps} />);
    expect(screen.getByText("v1.0.0")).toBeInTheDocument();
  });

  it("does not render version when null", () => {
    render(<SplashScreen {...defaultProps} version={null} />);
    expect(screen.queryByText(/^v/)).not.toBeInTheDocument();
  });

  it("renders progress bar with correct width", () => {
    const { container } = render(<SplashScreen {...defaultProps} progress={75} />);
    const bar = container.querySelector(".splash-progress");
    expect(bar).toHaveStyle({ width: "75%" });
  });

  it("renders status message", () => {
    render(<SplashScreen {...defaultProps} />);
    expect(screen.getByText("splash.initializing")).toBeInTheDocument();
  });

  it("applies fade-out class when phase is ready after delay", () => {
    const { container } = render(
      <SplashScreen {...defaultProps} phase="ready" />,
    );
    act(() => {
      jest.advanceTimersByTime(500);
    });
    const splash = container.querySelector(".splash-screen");
    expect(splash).toHaveClass("opacity-0");
  });

  it("calls onTransitionEnd after fade-out completes", () => {
    const onTransitionEnd = jest.fn();
    render(
      <SplashScreen
        {...defaultProps}
        phase="ready"
        onTransitionEnd={onTransitionEnd}
      />,
    );
    // 400ms delay for fadeOut state + 500ms for transition callback
    act(() => {
      jest.advanceTimersByTime(400);
    });
    act(() => {
      jest.advanceTimersByTime(500);
    });
    expect(onTransitionEnd).toHaveBeenCalled();
  });

  it("treats web-mode phase as ready", () => {
    const { container } = render(
      <SplashScreen {...defaultProps} phase="web-mode" />,
    );
    act(() => {
      jest.advanceTimersByTime(500);
    });
    const splash = container.querySelector(".splash-screen");
    expect(splash).toHaveClass("opacity-0");
  });
});
