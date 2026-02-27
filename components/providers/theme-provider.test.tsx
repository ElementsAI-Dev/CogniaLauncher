import { render, screen, act } from "@testing-library/react";
import { ThemeProvider } from "./theme-provider";

// Mock next-themes
let mockTheme = "light";
const mockSetTheme = jest.fn();

jest.mock("next-themes", () => ({
  ThemeProvider: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="next-themes-provider">{children}</div>
  ),
  useTheme: () => ({
    theme: mockTheme,
    resolvedTheme: mockTheme,
    setTheme: mockSetTheme,
  }),
}));

// Mock appearance store
let mockAccentColor = "blue";
let mockChartColorTheme = "default";
let mockInterfaceRadius = 0.625;
let mockInterfaceDensity = "comfortable";
let mockReducedMotion = false;
let mockBackgroundEnabled = false;

jest.mock("@/lib/stores/appearance", () => ({
  useAppearanceStore: jest.fn((selector) => {
    const state = {
      accentColor: mockAccentColor,
      chartColorTheme: mockChartColorTheme,
      interfaceRadius: mockInterfaceRadius,
      interfaceDensity: mockInterfaceDensity,
      reducedMotion: mockReducedMotion,
      setReducedMotion: jest.fn(),
      backgroundEnabled: mockBackgroundEnabled,
    };
    return typeof selector === "function" ? selector(state) : state;
  }),
}));

// Mock the colors module
jest.mock("@/lib/theme/colors", () => ({
  applyAccentColor: jest.fn(),
  applyChartColorTheme: jest.fn(),
  removeAccentColor: jest.fn(),
}));

import { applyAccentColor, applyChartColorTheme } from "@/lib/theme/colors";

describe("ThemeProvider", () => {
  beforeEach(() => {
    mockTheme = "light";
    mockAccentColor = "blue";
    mockChartColorTheme = "default";
    mockInterfaceRadius = 0.625;
    mockInterfaceDensity = "comfortable";
    mockReducedMotion = false;
    mockBackgroundEnabled = false;
    jest.clearAllMocks();
    document.documentElement.style.cssText = "";
    delete document.documentElement.dataset.density;
    document.documentElement.classList.remove("no-transitions");
    delete document.documentElement.dataset.bgActive;
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: jest.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: jest.fn(),
        removeListener: jest.fn(),
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
        dispatchEvent: jest.fn(),
      })),
    });
  });

  it("renders children correctly", () => {
    render(
      <ThemeProvider>
        <div data-testid="child">Hello</div>
      </ThemeProvider>,
    );

    expect(screen.getByTestId("child")).toBeInTheDocument();
    expect(screen.getByText("Hello")).toBeInTheDocument();
  });

  it("wraps children with next-themes provider", () => {
    render(
      <ThemeProvider>
        <div>Content</div>
      </ThemeProvider>,
    );

    expect(screen.getByTestId("next-themes-provider")).toBeInTheDocument();
  });

  it("applies accent color on mount", async () => {
    render(
      <ThemeProvider>
        <div>Content</div>
      </ThemeProvider>,
    );

    // Wait for effect to run
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(applyAccentColor).toHaveBeenCalledWith("blue", false);
  });

  it("applies accent color with dark mode", async () => {
    mockTheme = "dark";

    render(
      <ThemeProvider>
        <div>Content</div>
      </ThemeProvider>,
    );

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(applyAccentColor).toHaveBeenCalledWith("blue", true);
  });

  it("applies no-transitions class when reduced motion is enabled", async () => {
    mockReducedMotion = true;

    render(
      <ThemeProvider>
        <div>Content</div>
      </ThemeProvider>,
    );

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(document.documentElement.classList.contains("no-transitions")).toBe(
      true,
    );
  });

  it("removes no-transitions class when reduced motion is disabled", async () => {
    mockReducedMotion = false;
    document.documentElement.classList.add("no-transitions");

    render(
      <ThemeProvider>
        <div>Content</div>
      </ThemeProvider>,
    );

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(document.documentElement.classList.contains("no-transitions")).toBe(
      false,
    );
  });

  it("applies chart color theme on mount", async () => {
    render(
      <ThemeProvider>
        <div>Content</div>
      </ThemeProvider>,
    );

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(applyChartColorTheme).toHaveBeenCalledWith("default", false);
  });

  it("applies chart color theme with dark mode", async () => {
    mockTheme = "dark";
    mockChartColorTheme = "ocean";

    render(
      <ThemeProvider>
        <div>Content</div>
      </ThemeProvider>,
    );

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(applyChartColorTheme).toHaveBeenCalledWith("ocean", true);
  });

  it("sets --radius CSS variable on mount", async () => {
    mockInterfaceRadius = 0.75;

    render(
      <ThemeProvider>
        <div>Content</div>
      </ThemeProvider>,
    );

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(document.documentElement.style.getPropertyValue("--radius")).toBe(
      "0.75rem",
    );
  });

  it("sets data-density attribute on mount", async () => {
    mockInterfaceDensity = "compact";

    render(
      <ThemeProvider>
        <div>Content</div>
      </ThemeProvider>,
    );

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(document.documentElement.dataset.density).toBe("compact");
  });

  it("passes through ThemeProvider props", () => {
    render(
      <ThemeProvider attribute="class" defaultTheme="dark" enableSystem>
        <div>Content</div>
      </ThemeProvider>,
    );

    expect(screen.getByTestId("next-themes-provider")).toBeInTheDocument();
  });

  it("sets data-bg-active attribute when backgroundEnabled is true", async () => {
    mockBackgroundEnabled = true;

    render(
      <ThemeProvider>
        <div>Content</div>
      </ThemeProvider>,
    );

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(document.documentElement.dataset.bgActive).toBe("");
  });

  it("syncs OS prefers-reduced-motion on first mount", async () => {
    mockReducedMotion = false;
    const mockSetReducedMotion = jest.fn();

    // Override mock to return a setReducedMotion we can track
    const { useAppearanceStore } = jest.requireMock("@/lib/stores/appearance");
    useAppearanceStore.mockImplementation((selector: unknown) => {
      const state = {
        accentColor: mockAccentColor,
        chartColorTheme: mockChartColorTheme,
        interfaceRadius: mockInterfaceRadius,
        interfaceDensity: mockInterfaceDensity,
        reducedMotion: false,
        setReducedMotion: mockSetReducedMotion,
        backgroundEnabled: mockBackgroundEnabled,
      };
      return typeof selector === "function" ? (selector as (s: typeof state) => unknown)(state) : state;
    });

    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: jest.fn().mockImplementation((query: string) => ({
        matches: true, // OS prefers reduced motion
        media: query,
        onchange: null,
        addListener: jest.fn(),
        removeListener: jest.fn(),
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
        dispatchEvent: jest.fn(),
      })),
    });

    render(
      <ThemeProvider>
        <div>Content</div>
      </ThemeProvider>,
    );

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(mockSetReducedMotion).toHaveBeenCalledWith(true);
  });

  it("listens for OS reduced-motion changes via media query", async () => {
    let changeHandler: ((e: { matches: boolean }) => void) | undefined;
    const mockSetReducedMotion = jest.fn();

    const { useAppearanceStore } = jest.requireMock("@/lib/stores/appearance");
    useAppearanceStore.mockImplementation((selector: unknown) => {
      const state = {
        accentColor: mockAccentColor,
        chartColorTheme: mockChartColorTheme,
        interfaceRadius: mockInterfaceRadius,
        interfaceDensity: mockInterfaceDensity,
        reducedMotion: false,
        setReducedMotion: mockSetReducedMotion,
        backgroundEnabled: mockBackgroundEnabled,
      };
      return typeof selector === "function" ? (selector as (s: typeof state) => unknown)(state) : state;
    });

    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: jest.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: jest.fn(),
        removeListener: jest.fn(),
        addEventListener: jest.fn((_event: string, handler: (e: { matches: boolean }) => void) => {
          changeHandler = handler;
        }),
        removeEventListener: jest.fn(),
        dispatchEvent: jest.fn(),
      })),
    });

    render(
      <ThemeProvider>
        <div>Content</div>
      </ThemeProvider>,
    );

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    // Simulate OS motion preference change
    act(() => {
      changeHandler?.({ matches: true });
    });

    expect(mockSetReducedMotion).toHaveBeenCalledWith(true);
  });

  it("removes data-bg-active attribute when backgroundEnabled is false", async () => {
    mockBackgroundEnabled = false;
    document.documentElement.dataset.bgActive = "";

    render(
      <ThemeProvider>
        <div>Content</div>
      </ThemeProvider>,
    );

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(document.documentElement.dataset.bgActive).toBeUndefined();
  });
});
