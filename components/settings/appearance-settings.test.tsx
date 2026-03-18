import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AppearanceSettings } from "./appearance-settings";
import { buildWindowEffectRuntimeState } from "@/lib/theme/window-effects";

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
    backgroundScale: 100,
    setBackgroundScale: jest.fn(),
    backgroundPositionX: 50,
    setBackgroundPositionX: jest.fn(),
    backgroundPositionY: 50,
    setBackgroundPositionY: jest.fn(),
    resetBackgroundTuning: jest.fn(),
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
  windowEffect: "auto" as const,
  setWindowEffect: jest.fn(),
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
      "settings.backgroundImage": "Background Image",
      "settings.backgroundImageDesc": "Set a custom background image",
      "settings.backgroundEnabled": "Enable Background",
      "settings.backgroundEnabledDesc": "Show background image",
      "settings.backgroundOpacity": "Image Opacity",
      "settings.backgroundOpacityDesc": "Adjust visibility",
      "settings.backgroundBlur": "Blur Amount",
      "settings.backgroundBlurDesc": "Apply blur effect",
      "settings.backgroundFit": "Image Fit",
      "settings.backgroundFitDesc": "How the image fills the screen",
      "settings.backgroundFitCover": "Cover",
      "settings.backgroundFitContain": "Contain",
      "settings.backgroundFitFill": "Stretch",
      "settings.backgroundFitTile": "Tile",
      "settings.backgroundScale": "Image Scale",
      "settings.backgroundScaleDesc": "Scale image",
      "settings.backgroundPositionX": "Horizontal Position",
      "settings.backgroundPositionXDesc": "Adjust horizontal anchor",
      "settings.backgroundPositionY": "Vertical Position",
      "settings.backgroundPositionYDesc": "Adjust vertical anchor",
      "settings.backgroundSelect": "Select Image",
      "settings.backgroundClear": "Clear Image",
      "settings.backgroundResetTuning": "Reset Image Tuning",
      "settings.backgroundDropPasteHint": "Drop an image here or paste from clipboard",
      "settings.windowEffect": "Window Effect",
      "settings.windowEffectDesc": "Apply native OS transparency effect",
      "settings.windowEffectAuto": "Auto (Recommended)",
      "settings.windowEffectNone": "None",
      "settings.windowEffectMica": "Mica (Windows 11)",
      "settings.windowEffectMicaTabbed": "Mica Tabbed (Windows 11)",
      "settings.windowEffectAcrylic": "Acrylic (Windows)",
      "settings.windowEffectBlur": "Blur (Windows)",
      "settings.windowEffectVibrancy": "Vibrancy (macOS)",
      "settings.windowEffectDesktopOnly": "Native window effects are available in the desktop app only.",
      "settings.windowEffectUnsupported": "The configured window effect is not supported on this runtime.",
      "settings.windowEffectConfiguredBadge": "Configured",
      "settings.windowEffectEffectiveBadge": "Effective",
      "settings.windowEffectRuntimeCardTitle": "Native Window Transparency",
      "settings.windowEffectRuntimeCardDesc": "Control native window translucency with runtime-aware options.",
    };
    return translations[key] || key;
  },
  windowEffectRuntime: buildWindowEffectRuntimeState({
    requested: "auto",
    supported: ["auto", "none", "mica", "mica-tabbed", "acrylic", "blur"],
    desktop: true,
  }),
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

  it("calls setReducedMotion when reduced motion is toggled", () => {
    const setReducedMotion = jest.fn();
    render(
      <AppearanceSettings {...defaultProps} setReducedMotion={setReducedMotion} />,
    );

    const switches = screen.getAllByRole("switch");
    // Reduced motion is the only switch in AppearanceSettings (background has its own)
    fireEvent.click(switches[0]);

    expect(setReducedMotion).toHaveBeenCalledWith(true);
  });

  it("renders background settings section embedded", () => {
    render(<AppearanceSettings {...defaultProps} />);

    expect(screen.getByText("Background Image")).toBeInTheDocument();
  });

  it("renders interface density options", () => {
    render(<AppearanceSettings {...defaultProps} />);

    expect(screen.getByText("Interface Density")).toBeInTheDocument();
  });

  it("renders all border radius options", () => {
    render(<AppearanceSettings {...defaultProps} />);

    expect(screen.getByText("Border Radius")).toBeInTheDocument();
    // Check that radius toggle items are present
    const radioItems = screen.getAllByRole("radio");
    // 6 accent colors + 6 border radius options = 12 radios
    expect(radioItems.length).toBeGreaterThanOrEqual(12);
  });

  it("renders theme select with current value", () => {
    render(<AppearanceSettings {...defaultProps} theme="dark" />);

    // The theme label should still be present
    expect(screen.getByText("Theme")).toBeInTheDocument();
  });

  it("renders window effect selector", () => {
    render(<AppearanceSettings {...defaultProps} />);
    expect(screen.getByText("Window Effect")).toBeInTheDocument();
  });

  it("renders window effect with current value", () => {
    render(<AppearanceSettings {...defaultProps} windowEffect="mica" />);
    expect(screen.getByText("Window Effect")).toBeInTheDocument();
  });

  it("shows desktop-only feedback when native window effects are unavailable", () => {
    render(
      <AppearanceSettings
        {...defaultProps}
        windowEffectRuntime={buildWindowEffectRuntimeState({
          requested: "auto",
          supported: [],
          desktop: false,
        })}
      />,
    );

    expect(
      screen.getByText("Native window effects are available in the desktop app only."),
    ).toBeInTheDocument();
  });

  it("shows unsupported configured effect feedback while keeping actionable runtime options", () => {
    render(
      <AppearanceSettings
        {...defaultProps}
        windowEffect="mica"
        windowEffectRuntime={buildWindowEffectRuntimeState({
          requested: "mica",
          supported: ["auto", "none", "vibrancy"],
          desktop: true,
        })}
      />,
    );

    expect(
      screen.getByText("The configured window effect is not supported on this runtime."),
    ).toBeInTheDocument();
    expect(screen.getByText(/Configured:/)).toBeInTheDocument();
  });

  it("wires theme, locale, chart theme, density and window effect controls to setters", async () => {
    const setTheme = jest.fn();
    const setLocale = jest.fn();
    const setChartColorTheme = jest.fn();
    const setInterfaceDensity = jest.fn();
    const setWindowEffect = jest.fn();

    render(
      <AppearanceSettings
        {...defaultProps}
        setTheme={setTheme}
        setLocale={setLocale}
        setChartColorTheme={setChartColorTheme}
        setInterfaceDensity={setInterfaceDensity}
        setWindowEffect={setWindowEffect}
      />,
    );

    await userEvent.click(screen.getByRole("combobox", { name: "Theme" }));
    await userEvent.click(screen.getByRole("option", { name: "settings.dark" }));
    await userEvent.click(screen.getByRole("combobox", { name: "Language" }));
    await userEvent.click(screen.getByRole("option", { name: "settings.chinese" }));
    await userEvent.click(screen.getByRole("combobox", { name: "Chart Color Theme" }));
    await userEvent.click(screen.getByRole("option", { name: "settings.chartThemeOcean" }));
    await userEvent.click(screen.getByRole("combobox", { name: "Interface Density" }));
    await userEvent.click(screen.getByRole("option", { name: "Spacious" }));
    await userEvent.click(screen.getByRole("combobox", { name: "Window Effect" }));
    await userEvent.click(screen.getByRole("option", { name: "Mica (Windows 11)" }));

    expect(setTheme).toHaveBeenCalledWith("dark");
    expect(setLocale).toHaveBeenCalledWith("zh");
    expect(setChartColorTheme).toHaveBeenCalledWith("ocean");
    expect(setInterfaceDensity).toHaveBeenCalledWith("spacious");
    expect(setWindowEffect).toHaveBeenCalledWith("mica");
  });

  it("wires accent color and radius controls to setters", async () => {
    const setAccentColor = jest.fn();
    const setInterfaceRadius = jest.fn();

    render(
      <AppearanceSettings
        {...defaultProps}
        setAccentColor={setAccentColor}
        setInterfaceRadius={setInterfaceRadius}
      />,
    );

    const accentOptions = screen.getAllByRole("radio", {
      name: /settings.selectAccentColor/i,
    });
    await userEvent.click(accentOptions[0]);
    await userEvent.click(screen.getByText("Round"));

    expect(setAccentColor).toHaveBeenCalled();
    expect(setInterfaceRadius).toHaveBeenCalled();
  });
});
