import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ThemeStep } from "./theme-step";

const mockT = (key: string) => {
  const translations: Record<string, string> = {
    "onboarding.themeTitle": "Choose Theme",
    "onboarding.themeDesc": "Select your preferred theme",
    "onboarding.themeLight": "Light",
    "onboarding.themeDark": "Dark",
    "onboarding.themeSystem": "System",
  };
  return translations[key] || key;
};

describe("ThemeStep", () => {
  const defaultProps = {
    theme: "system",
    setTheme: jest.fn(),
    t: mockT,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders title", () => {
    render(<ThemeStep {...defaultProps} />);
    expect(screen.getByText("Choose Theme")).toBeInTheDocument();
  });

  it("renders all three theme options", () => {
    render(<ThemeStep {...defaultProps} />);
    expect(screen.getByText("Light")).toBeInTheDocument();
    expect(screen.getByText("Dark")).toBeInTheDocument();
    expect(screen.getByText("System")).toBeInTheDocument();
  });

  it("calls setTheme when a theme is clicked", async () => {
    render(<ThemeStep {...defaultProps} />);
    await userEvent.click(screen.getByText("Dark"));
    expect(defaultProps.setTheme).toHaveBeenCalledWith("dark");
  });

  it("highlights active theme", () => {
    const { container } = render(<ThemeStep {...defaultProps} theme="light" />);
    const buttons = container.querySelectorAll("button");
    expect(buttons[0].className).toContain("border-primary");
  });
});
