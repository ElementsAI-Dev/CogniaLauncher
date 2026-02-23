import { render, screen } from "@testing-library/react";
import { AppearanceSettings } from "./appearance-settings";

jest.mock("@/lib/stores/appearance", () => ({
  useAppearanceStore: jest.fn(() => ({
    backgroundEnabled: false,
    setBackgroundEnabled: jest.fn(),
    backgroundOpacity: 20,
    setBackgroundOpacity: jest.fn(),
    backgroundBlur: 0,
    setBackgroundBlur: jest.fn(),
    backgroundFit: "cover",
    setBackgroundFit: jest.fn(),
    clearBackground: jest.fn(),
  })),
}));

jest.mock("@/lib/theme/background", () => ({
  getBackgroundImage: jest.fn(() => null),
  removeBackgroundImage: jest.fn(),
  setBackgroundImageData: jest.fn(),
  notifyBackgroundChange: jest.fn(),
  compressImage: jest.fn(() => Promise.resolve("data:image/jpeg;base64,test")),
  BG_CHANGE_EVENT: "cognia-bg-change",
}));

jest.mock("@/lib/tauri", () => ({
  isTauri: jest.fn(() => false),
}));

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
  chartColorTheme: "default" as const,
  setChartColorTheme: jest.fn(),
  interfaceRadius: 0.625 as const,
  setInterfaceRadius: jest.fn(),
  interfaceDensity: "comfortable" as const,
  setInterfaceDensity: jest.fn(),
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
      "settings.chartColorTheme": "Chart Color Theme",
      "settings.interfaceRadius": "Border Radius",
      "settings.interfaceDensity": "Interface Density",
      "settings.reducedMotion": "Reduced Motion",
      "settings.radiusSharp": "Sharp",
      "settings.radiusSlight": "Slight",
      "settings.radiusMedium": "Medium",
      "settings.radiusDefault": "Default",
      "settings.radiusRound": "Round",
      "settings.radiusFull": "Full",
      "settings.densityCompact": "Compact",
      "settings.densityComfortable": "Comfortable",
      "settings.densitySpacious": "Spacious",
    };
    return translations[key] || key;
  },
};

describe("AppearanceSettings", () => {
  it("renders appearance settings content", () => {
    render(<AppearanceSettings {...defaultProps} />);
    // Title/description are now provided by parent CollapsibleSection
    expect(screen.getByText("Theme")).toBeInTheDocument();
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

  it("renders chart color theme selection", () => {
    render(<AppearanceSettings {...defaultProps} />);
    expect(screen.getByText("Chart Color Theme")).toBeInTheDocument();
  });

  it("renders border radius picker", () => {
    render(<AppearanceSettings {...defaultProps} />);
    expect(screen.getByText("Border Radius")).toBeInTheDocument();
  });

  it("renders interface density selector", () => {
    render(<AppearanceSettings {...defaultProps} />);
    expect(screen.getByText("Interface Density")).toBeInTheDocument();
  });

  it("renders reduced motion toggle", () => {
    render(<AppearanceSettings {...defaultProps} />);
    expect(screen.getByText("Reduced Motion")).toBeInTheDocument();
  });
});
