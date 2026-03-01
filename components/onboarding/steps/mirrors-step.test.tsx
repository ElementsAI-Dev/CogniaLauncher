import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MirrorsStep } from "./mirrors-step";

const mockT = (key: string) => {
  const translations: Record<string, string> = {
    "onboarding.mirrorsTitle": "Mirror Configuration",
    "onboarding.mirrorsDesc": "Choose download mirrors",
    "settings.mirrorPresetDefault": "Default (Official)",
    "settings.mirrorPresetChina": "China Mirrors",
    "settings.mirrorPresetAliyun": "Aliyun Mirrors",
    "settings.mirrorPresetUstc": "USTC Mirrors",
    "onboarding.mirrorPresetDesc_default": "Use official sources",
    "onboarding.mirrorPresetDesc_china": "Optimized for China",
    "onboarding.mirrorPresetDesc_aliyun": "Aliyun mirrors",
    "onboarding.mirrorPresetDesc_ustc": "USTC mirrors",
    "onboarding.mirrorsHint": "You can change this later",
  };
  return translations[key] || key;
};

describe("MirrorsStep", () => {
  const mockApplyPreset = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders title", () => {
    render(<MirrorsStep t={mockT} onApplyPreset={mockApplyPreset} />);
    expect(screen.getByText("Mirror Configuration")).toBeInTheDocument();
  });

  it("renders all four preset options", () => {
    render(<MirrorsStep t={mockT} onApplyPreset={mockApplyPreset} />);
    expect(screen.getByText("Default (Official)")).toBeInTheDocument();
    expect(screen.getByText("China Mirrors")).toBeInTheDocument();
    expect(screen.getByText("Aliyun Mirrors")).toBeInTheDocument();
    expect(screen.getByText("USTC Mirrors")).toBeInTheDocument();
  });

  it("renders preset descriptions", () => {
    render(<MirrorsStep t={mockT} onApplyPreset={mockApplyPreset} />);
    expect(screen.getByText("Use official sources")).toBeInTheDocument();
    expect(screen.getByText("Optimized for China")).toBeInTheDocument();
  });

  it("renders hint text", () => {
    render(<MirrorsStep t={mockT} onApplyPreset={mockApplyPreset} />);
    expect(screen.getByText("You can change this later")).toBeInTheDocument();
  });

  it("selects default preset initially", () => {
    const { container } = render(<MirrorsStep t={mockT} onApplyPreset={mockApplyPreset} />);
    const labels = container.querySelectorAll("label");
    expect(labels[0].className).toContain("border-primary");
  });

  it("changes selection when clicked and calls onApplyPreset", async () => {
    const { container } = render(<MirrorsStep t={mockT} onApplyPreset={mockApplyPreset} />);
    await userEvent.click(screen.getByText("China Mirrors"));
    const labels = container.querySelectorAll("label");
    expect(labels[1].className).toContain("border-primary");
    expect(mockApplyPreset).toHaveBeenCalledWith("china");
  });

  it("calls onApplyPreset with correct key for each preset", async () => {
    render(<MirrorsStep t={mockT} onApplyPreset={mockApplyPreset} />);
    await userEvent.click(screen.getByText("Aliyun Mirrors"));
    expect(mockApplyPreset).toHaveBeenCalledWith("aliyun");
    await userEvent.click(screen.getByText("USTC Mirrors"));
    expect(mockApplyPreset).toHaveBeenCalledWith("ustc");
  });

  it("renders description text", () => {
    render(<MirrorsStep t={mockT} onApplyPreset={mockApplyPreset} />);
    expect(screen.getByText("Choose download mirrors")).toBeInTheDocument();
  });
});
