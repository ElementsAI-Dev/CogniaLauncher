import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LanguageStep } from "./language-step";

const mockT = (key: string) => {
  const translations: Record<string, string> = {
    "onboarding.languageTitle": "Choose Language",
    "onboarding.languageDesc": "Select your preferred language",
  };
  return translations[key] || key;
};

describe("LanguageStep", () => {
  const defaultProps = {
    locale: "en" as const,
    setLocale: jest.fn(),
    t: mockT,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders title", () => {
    render(<LanguageStep {...defaultProps} />);
    expect(screen.getByText("Choose Language")).toBeInTheDocument();
  });

  it("renders English and Chinese options", () => {
    render(<LanguageStep {...defaultProps} />);
    expect(screen.getAllByText("English").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("简体中文").length).toBeGreaterThanOrEqual(1);
  });

  it("calls setLocale when a language is clicked", async () => {
    render(<LanguageStep {...defaultProps} />);
    await userEvent.click(screen.getByText("简体中文"));
    expect(defaultProps.setLocale).toHaveBeenCalledWith("zh");
  });

  it("shows check mark for selected locale", () => {
    const { container } = render(<LanguageStep {...defaultProps} locale="en" />);
    const labels = container.querySelectorAll("label");
    expect(labels[0].className).toContain("border-primary");
  });
});
