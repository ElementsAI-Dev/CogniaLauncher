import React from "react";
import { render, screen } from "@testing-library/react";
import { SettingsSkeleton } from "./settings-skeleton";
import {
  SettingItem,
  validateField,
  SwitchSettingItem,
  SelectSettingItem,
  SliderSettingItem,
  GeneralSettings,
  NetworkSettings,
  SecuritySettings,
  MirrorsSettings,
  AppearanceSettings,
  UpdateSettings,
  TraySettings,
  PathsSettings,
  ProviderSettings,
  SystemInfo,
  SettingsSkeleton as SkeletonFromIndex,
  AccentColorPicker,
  SettingsSearch,
  SettingsNav,
  CollapsibleSection,
  SECTION_ICONS,
} from "./index";

describe("Settings barrel exports (index.ts)", () => {
  it("should export all settings components", () => {
    expect(SettingItem).toBeDefined();
    expect(validateField).toBeDefined();
    expect(SwitchSettingItem).toBeDefined();
    expect(SelectSettingItem).toBeDefined();
    expect(SliderSettingItem).toBeDefined();
    expect(GeneralSettings).toBeDefined();
    expect(NetworkSettings).toBeDefined();
    expect(SecuritySettings).toBeDefined();
    expect(MirrorsSettings).toBeDefined();
    expect(AppearanceSettings).toBeDefined();
    expect(UpdateSettings).toBeDefined();
    expect(TraySettings).toBeDefined();
    expect(PathsSettings).toBeDefined();
    expect(ProviderSettings).toBeDefined();
    expect(SystemInfo).toBeDefined();
    expect(SkeletonFromIndex).toBeDefined();
    expect(AccentColorPicker).toBeDefined();
    expect(SettingsSearch).toBeDefined();
    expect(SettingsNav).toBeDefined();
    expect(CollapsibleSection).toBeDefined();
    expect(SECTION_ICONS).toBeDefined();
  });
});

describe("SettingsSkeleton", () => {
  it("should render skeleton cards", () => {
    render(<SettingsSkeleton />);

    // Check that multiple skeleton elements are rendered
    const skeletons = document.querySelectorAll('[class*="animate-pulse"]');

    expect(skeletons.length).toBeGreaterThan(0);
  });

  it("should render multiple card sections", () => {
    const { container } = render(<SettingsSkeleton />);

    // Check for card-like structures
    const cards = container.querySelectorAll('[class*="rounded"]');
    expect(cards.length).toBeGreaterThan(0);
  });

  it("should be accessible with proper structure", () => {
    const { container } = render(<SettingsSkeleton />);

    // Skeleton should be contained in a div
    expect(container.firstChild).toBeInstanceOf(HTMLElement);
  });

  it("should have aria-busy attribute", () => {
    render(<SettingsSkeleton />);

    const container = screen.getByLabelText("Loading settings");
    expect(container).toHaveAttribute("aria-busy", "true");
  });

  it("should use default loadingLabel when not provided", () => {
    render(<SettingsSkeleton />);

    expect(screen.getByLabelText("Loading settings")).toBeInTheDocument();
  });

  it("should use custom loadingLabel when provided", () => {
    render(<SettingsSkeleton loadingLabel="Custom loading" />);

    expect(screen.getByLabelText("Custom loading")).toBeInTheDocument();
  });

  it("should render at least 6 card sections", () => {
    const { container } = render(<SettingsSkeleton />);

    // The skeleton has General, Network, Security, Appearance, Update, Paths, Provider sections
    const spaceDivs = container.querySelectorAll(":scope > div > div");
    expect(spaceDivs.length).toBeGreaterThanOrEqual(6);
  });
});
