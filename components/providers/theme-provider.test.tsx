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
let mockReducedMotion = false;

jest.mock("@/lib/stores/appearance", () => ({
  useAppearanceStore: jest.fn((selector) => {
    const state = {
      accentColor: mockAccentColor,
      reducedMotion: mockReducedMotion,
    };
    return typeof selector === "function" ? selector(state) : state;
  }),
}));

// Mock the colors module
jest.mock("@/lib/theme/colors", () => ({
  applyAccentColor: jest.fn(),
  removeAccentColor: jest.fn(),
}));

import { applyAccentColor } from "@/lib/theme/colors";

describe("ThemeProvider", () => {
  beforeEach(() => {
    mockTheme = "light";
    mockAccentColor = "blue";
    mockReducedMotion = false;
    jest.clearAllMocks();
    document.documentElement.classList.remove("no-transitions");
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

  it("passes through ThemeProvider props", () => {
    render(
      <ThemeProvider attribute="class" defaultTheme="dark" enableSystem>
        <div>Content</div>
      </ThemeProvider>,
    );

    expect(screen.getByTestId("next-themes-provider")).toBeInTheDocument();
  });
});
