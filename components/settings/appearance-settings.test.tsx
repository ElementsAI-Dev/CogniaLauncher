import { render, screen } from "@testing-library/react";
import { AppearanceSettings } from "./appearance-settings";

jest.mock("@/components/providers/locale-provider", () => ({
  useLocale: () => ({
    locale: "en",
    setLocale: jest.fn(),
    t: (key: string) => {
      const translations: Record<string, string> = {
        "settings.appearance": "Appearance",
        "settings.theme": "Theme",
        "settings.themeLight": "Light",
        "settings.themeDark": "Dark",
        "settings.themeSystem": "System",
        "settings.language": "Language",
        "settings.accentColor": "Accent Color",
        "settings.reducedMotion": "Reduced Motion",
      };
      return translations[key] || key;
    },
  }),
}));

const defaultProps = {
  theme: "system",
  setTheme: jest.fn(),
  locale: "en",
  setLocale: jest.fn(),
  accentColor: "blue" as const,
  setAccentColor: jest.fn(),
  reducedMotion: false,
  setReducedMotion: jest.fn(),
  t: (key: string) => {
    const translations: Record<string, string> = {
      "settings.appearance": "Appearance",
      "settings.appearanceDesc": "Customize appearance",
      "settings.theme": "Theme",
      "settings.themeLight": "Light",
      "settings.themeDark": "Dark",
      "settings.themeSystem": "System",
      "settings.language": "Language",
      "settings.accentColor": "Accent Color",
      "settings.reducedMotion": "Reduced Motion",
    };
    return translations[key] || key;
  },
};

describe("AppearanceSettings", () => {
  it("renders appearance settings section", () => {
    render(<AppearanceSettings {...defaultProps} />);
    expect(screen.getByText("Appearance")).toBeInTheDocument();
  });

  it("renders theme selection", () => {
    render(<AppearanceSettings {...defaultProps} />);
    expect(screen.getByText("Theme")).toBeInTheDocument();
  });

  it("renders language selection", () => {
    render(<AppearanceSettings {...defaultProps} />);
    expect(screen.getByText("Language")).toBeInTheDocument();
  });

  it("renders accent color picker", () => {
    render(<AppearanceSettings {...defaultProps} />);
    expect(screen.getByText("Accent Color")).toBeInTheDocument();
  });

  it("renders reduced motion toggle", () => {
    render(<AppearanceSettings {...defaultProps} />);
    expect(screen.getByText("Reduced Motion")).toBeInTheDocument();
  });
});
