import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MirrorsStep } from "./mirrors-step";

const mockT = (key: string) => {
  const translations: Record<string, string> = {
    "onboarding.mirrorsTitle": "Mirror Configuration",
    "onboarding.mirrorsDesc": "Choose download mirrors",
    "onboarding.mirrorsDefault": "Default",
    "onboarding.mirrorsDefaultDesc": "Use official sources",
    "onboarding.mirrorsChinaPreset": "China Preset",
    "onboarding.mirrorsChinaPresetDesc": "Optimized for China",
    "onboarding.mirrorsCustom": "Custom",
    "onboarding.mirrorsCustomDesc": "Configure manually",
    "onboarding.mirrorsHint": "You can change this later",
  };
  return translations[key] || key;
};

describe("MirrorsStep", () => {
  it("renders title", () => {
    render(<MirrorsStep t={mockT} />);
    expect(screen.getByText("Mirror Configuration")).toBeInTheDocument();
  });

  it("renders all three preset options", () => {
    render(<MirrorsStep t={mockT} />);
    expect(screen.getByText("Default")).toBeInTheDocument();
    expect(screen.getByText("China Preset")).toBeInTheDocument();
    expect(screen.getByText("Custom")).toBeInTheDocument();
  });

  it("renders preset descriptions", () => {
    render(<MirrorsStep t={mockT} />);
    expect(screen.getByText("Use official sources")).toBeInTheDocument();
    expect(screen.getByText("Optimized for China")).toBeInTheDocument();
  });

  it("renders hint text", () => {
    render(<MirrorsStep t={mockT} />);
    expect(screen.getByText("You can change this later")).toBeInTheDocument();
  });

  it("selects default preset initially", () => {
    const { container } = render(<MirrorsStep t={mockT} />);
    const labels = container.querySelectorAll("label");
    expect(labels[0].className).toContain("border-primary");
  });

  it("changes selection when clicked", async () => {
    const { container } = render(<MirrorsStep t={mockT} />);
    await userEvent.click(screen.getByText("China Preset"));
    const labels = container.querySelectorAll("label");
    expect(labels[1].className).toContain("border-primary");
  });
});
