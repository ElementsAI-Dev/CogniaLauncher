import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  AppearanceWorkbench,
} from "./appearance-workbench";
import { DEFAULT_APPEARANCE_PRESET_ID, type AppearancePreset } from "@/lib/stores/appearance";

const mockT = (key: string) => {
  const translations: Record<string, string> = {
    "settings.customizationWorkbenchTitle": "Customization Workbench",
    "settings.customizationWorkbenchDesc": "Create and apply appearance presets",
    "settings.customizationWorkbenchChanged": "Differs from preset",
    "settings.customizationPresetSelect": "Preset",
    "settings.customizationPresetApply": "Apply Preset",
    "settings.customizationPresetName": "Preset Name",
    "settings.customizationPresetNamePlaceholder": "Enter preset name",
    "settings.customizationPresetSave": "Save Preset",
    "settings.customizationPresetRename": "Rename Preset",
    "settings.customizationPresetDelete": "Delete Preset",
    "settings.customizationResetAppearance": "Reset Appearance Group",
    "settings.customizationResetAppearanceHint": "Only appearance fields are reset.",
  };
  return translations[key] || key;
};

const presets: AppearancePreset[] = [
  {
    id: DEFAULT_APPEARANCE_PRESET_ID,
    name: "Default",
    config: {
      theme: "system",
      accentColor: "blue",
      chartColorTheme: "default",
      interfaceRadius: 0.625,
      interfaceDensity: "comfortable",
      reducedMotion: false,
      backgroundEnabled: false,
      backgroundOpacity: 20,
      backgroundBlur: 0,
      backgroundFit: "cover",
      backgroundScale: 100,
      backgroundPositionX: 50,
      backgroundPositionY: 50,
      windowEffect: "auto",
    },
  },
  {
    id: "night",
    name: "Night Drive",
    config: {
      theme: "dark",
      accentColor: "cyan",
      chartColorTheme: "vivid",
      interfaceRadius: 0.75,
      interfaceDensity: "compact",
      reducedMotion: true,
      backgroundEnabled: true,
      backgroundOpacity: 45,
      backgroundBlur: 10,
      backgroundFit: "cover",
      backgroundScale: 120,
      backgroundPositionX: 40,
      backgroundPositionY: 60,
      windowEffect: "mica",
    },
  },
];

describe("AppearanceWorkbench", () => {
  const defaultProps = {
    presets,
    activePresetId: DEFAULT_APPEARANCE_PRESET_ID,
    hasAppearanceChanges: false,
    onSelectPreset: jest.fn(),
    onApplyPreset: jest.fn(),
    onSavePreset: jest.fn(),
    onRenamePreset: jest.fn(),
    onDeletePreset: jest.fn(),
    onResetAppearance: jest.fn(),
    t: mockT,
    children: <div>Appearance content</div>,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders workbench content and child controls", () => {
    render(<AppearanceWorkbench {...defaultProps} />);

    expect(screen.getByText("Customization Workbench")).toBeInTheDocument();
    expect(screen.getByText("Create and apply appearance presets")).toBeInTheDocument();
    expect(screen.getByText("Appearance content")).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Preset" })).toBeInTheDocument();
  });

  it("shows divergence badge when appearance differs from active preset", () => {
    render(
      <AppearanceWorkbench
        {...defaultProps}
        hasAppearanceChanges={true}
      />,
    );

    expect(screen.getByText("Differs from preset")).toBeInTheDocument();
  });

  it("disables rename and delete for the default preset", () => {
    render(<AppearanceWorkbench {...defaultProps} />);

    expect(screen.getByRole("button", { name: "Rename Preset" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Delete Preset" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Save Preset" })).toBeEnabled();
  });

  it("allows selecting, applying, saving, and resetting presets", async () => {
    const onSelectPreset = jest.fn();
    const onApplyPreset = jest.fn();
    const onSavePreset = jest.fn();
    const onResetAppearance = jest.fn();

    render(
      <AppearanceWorkbench
        {...defaultProps}
        onSelectPreset={onSelectPreset}
        onApplyPreset={onApplyPreset}
        onSavePreset={onSavePreset}
        onResetAppearance={onResetAppearance}
      />,
    );

    await userEvent.click(screen.getByRole("combobox", { name: "Preset" }));
    await userEvent.click(screen.getByRole("option", { name: "Night Drive" }));

    expect(onSelectPreset).toHaveBeenCalledWith("night");

    await userEvent.click(screen.getByRole("button", { name: "Apply Preset" }));
    expect(onApplyPreset).toHaveBeenCalledWith(DEFAULT_APPEARANCE_PRESET_ID);

    await userEvent.clear(screen.getByRole("textbox", { name: "Preset Name" }));
    await userEvent.type(screen.getByRole("textbox", { name: "Preset Name" }), "  Fresh Start  ");
    await userEvent.click(screen.getByRole("button", { name: "Save Preset" }));

    expect(onSavePreset).toHaveBeenCalledWith("Fresh Start");

    await userEvent.click(screen.getByRole("button", { name: "Reset Appearance Group" }));
    expect(onResetAppearance).toHaveBeenCalled();
  });

  it("enables rename and delete for custom presets and trims the renamed label", async () => {
    const onRenamePreset = jest.fn();
    const onDeletePreset = jest.fn();

    render(
      <AppearanceWorkbench
        {...defaultProps}
        activePresetId="night"
        onRenamePreset={onRenamePreset}
        onDeletePreset={onDeletePreset}
      />,
    );

    const nameInput = screen.getByRole("textbox", { name: "Preset Name" });
    expect(nameInput).toHaveValue("Night Drive");
    expect(screen.getByRole("button", { name: "Rename Preset" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Delete Preset" })).toBeEnabled();

    await userEvent.clear(nameInput);
    await userEvent.type(nameInput, "  Neon Skyline  ");
    await userEvent.click(screen.getByRole("button", { name: "Rename Preset" }));
    await userEvent.click(screen.getByRole("button", { name: "Delete Preset" }));

    expect(onRenamePreset).toHaveBeenCalledWith("night", "Neon Skyline");
    expect(onDeletePreset).toHaveBeenCalledWith("night");
  });

  it("disables save when the draft name is empty after trimming", async () => {
    render(
      <AppearanceWorkbench
        {...defaultProps}
        activePresetId="night"
      />,
    );

    const input = screen.getByRole("textbox", { name: "Preset Name" });
    await userEvent.clear(input);
    await userEvent.type(input, "   ");

    expect(screen.getByRole("button", { name: "Save Preset" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Rename Preset" })).toBeDisabled();
  });
});
