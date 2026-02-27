import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BubbleHint } from "./bubble-hint";
import type { BubbleHintDef } from "@/types/onboarding";

jest.mock("@/components/providers/locale-provider", () => ({
  useLocale: () => ({
    t: (key: string) => {
      const translations: Record<string, string> = {
        "onboarding.hints.dashboardCustomizeTitle": "Customize Dashboard",
        "onboarding.hints.dashboardCustomizeDesc": "Click to customize widgets",
        "onboarding.hints.dismiss": "Dismiss",
      };
      return translations[key] || key;
    },
  }),
}));

const mockHint: BubbleHintDef = {
  id: "test-hint",
  target: '[data-hint="test-target"]',
  titleKey: "onboarding.hints.dashboardCustomizeTitle",
  descKey: "onboarding.hints.dashboardCustomizeDesc",
  side: "bottom",
  showAfterOnboarding: true,
  delay: 0,
};

describe("BubbleHint", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("does not render when target element is not found", () => {
    const { container } = render(
      <BubbleHint hint={mockHint} onDismiss={jest.fn()} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("calls onDismiss with hint id when dismiss button is clicked", async () => {
    // Create a target element in the DOM
    const target = document.createElement("div");
    target.setAttribute("data-hint", "test-target");
    target.style.width = "100px";
    target.style.height = "50px";
    document.body.appendChild(target);

    // Mock IntersectionObserver to immediately report visible
    const mockObserve = jest.fn();
    const mockDisconnect = jest.fn();
    const originalIO = window.IntersectionObserver;
    window.IntersectionObserver = jest.fn((callback) => {
      // Simulate element being visible
      setTimeout(() => {
        callback(
          [{ isIntersecting: true }] as IntersectionObserverEntry[],
          {} as IntersectionObserver,
        );
      }, 0);
      return {
        observe: mockObserve,
        disconnect: mockDisconnect,
        unobserve: jest.fn(),
        root: null,
        rootMargin: "",
        thresholds: [],
        takeRecords: () => [],
      };
    }) as unknown as typeof IntersectionObserver;

    const onDismiss = jest.fn();
    render(<BubbleHint hint={mockHint} onDismiss={onDismiss} />);

    // Wait for the hint to appear
    await screen.findByText("Customize Dashboard", {}, { timeout: 2000 });

    // Find and click dismiss button
    const dismissBtn = screen.getByRole("button", { name: "Dismiss" });
    await userEvent.click(dismissBtn);

    expect(onDismiss).toHaveBeenCalledWith("test-hint");

    // Cleanup
    document.body.removeChild(target);
    window.IntersectionObserver = originalIO;
  });

  it("renders hint title and description when target is visible", async () => {
    const target = document.createElement("div");
    target.setAttribute("data-hint", "test-target");
    target.style.width = "100px";
    target.style.height = "50px";
    document.body.appendChild(target);

    const mockObserve = jest.fn();
    const mockDisconnect = jest.fn();
    const originalIO = window.IntersectionObserver;
    window.IntersectionObserver = jest.fn((callback) => {
      setTimeout(() => {
        callback(
          [{ isIntersecting: true }] as IntersectionObserverEntry[],
          {} as IntersectionObserver,
        );
      }, 0);
      return {
        observe: mockObserve,
        disconnect: mockDisconnect,
        unobserve: jest.fn(),
        root: null,
        rootMargin: "",
        thresholds: [],
        takeRecords: () => [],
      };
    }) as unknown as typeof IntersectionObserver;

    render(<BubbleHint hint={mockHint} onDismiss={jest.fn()} />);

    await screen.findByText("Customize Dashboard", {}, { timeout: 2000 });
    expect(screen.getByText("Click to customize widgets")).toBeInTheDocument();

    document.body.removeChild(target);
    window.IntersectionObserver = originalIO;
  });

  it("renders with role=status for accessibility", async () => {
    const target = document.createElement("div");
    target.setAttribute("data-hint", "test-target");
    target.style.width = "100px";
    target.style.height = "50px";
    document.body.appendChild(target);

    const originalIO = window.IntersectionObserver;
    window.IntersectionObserver = jest.fn((callback) => {
      setTimeout(() => {
        callback(
          [{ isIntersecting: true }] as IntersectionObserverEntry[],
          {} as IntersectionObserver,
        );
      }, 0);
      return {
        observe: jest.fn(),
        disconnect: jest.fn(),
        unobserve: jest.fn(),
        root: null,
        rootMargin: "",
        thresholds: [],
        takeRecords: () => [],
      };
    }) as unknown as typeof IntersectionObserver;

    render(<BubbleHint hint={mockHint} onDismiss={jest.fn()} />);

    await screen.findByText("Customize Dashboard", {}, { timeout: 2000 });
    expect(screen.getByRole("status")).toBeInTheDocument();

    document.body.removeChild(target);
    window.IntersectionObserver = originalIO;
  });

  it("does not render when target is not intersecting", () => {
    const target = document.createElement("div");
    target.setAttribute("data-hint", "test-target");
    document.body.appendChild(target);

    const originalIO = window.IntersectionObserver;
    window.IntersectionObserver = jest.fn((callback) => {
      setTimeout(() => {
        callback(
          [{ isIntersecting: false }] as IntersectionObserverEntry[],
          {} as IntersectionObserver,
        );
      }, 0);
      return {
        observe: jest.fn(),
        disconnect: jest.fn(),
        unobserve: jest.fn(),
        root: null,
        rootMargin: "",
        thresholds: [],
        takeRecords: () => [],
      };
    }) as unknown as typeof IntersectionObserver;

    const { container } = render(
      <BubbleHint hint={mockHint} onDismiss={jest.fn()} />,
    );
    // Not visible since isIntersecting is false
    expect(container.querySelector('[role="status"]')).toBeNull();

    document.body.removeChild(target);
    window.IntersectionObserver = originalIO;
  });

  it("accepts different side prop values", async () => {
    const target = document.createElement("div");
    target.setAttribute("data-hint", "test-target");
    target.style.width = "100px";
    target.style.height = "50px";
    document.body.appendChild(target);

    const originalIO = window.IntersectionObserver;
    window.IntersectionObserver = jest.fn((callback) => {
      setTimeout(() => {
        callback(
          [{ isIntersecting: true }] as IntersectionObserverEntry[],
          {} as IntersectionObserver,
        );
      }, 0);
      return {
        observe: jest.fn(),
        disconnect: jest.fn(),
        unobserve: jest.fn(),
        root: null,
        rootMargin: "",
        thresholds: [],
        takeRecords: () => [],
      };
    }) as unknown as typeof IntersectionObserver;

    const topHint = { ...mockHint, side: "top" as const };
    render(<BubbleHint hint={topHint} onDismiss={jest.fn()} />);
    await screen.findByText("Customize Dashboard", {}, { timeout: 2000 });
    expect(screen.getByRole("status")).toBeInTheDocument();

    document.body.removeChild(target);
    window.IntersectionObserver = originalIO;
  });
});
