import { render, screen } from "@testing-library/react";
import { WelcomeStep } from "./welcome-step";

const mockT = (key: string) => {
  const translations: Record<string, string> = {
    "onboarding.welcomeTitle": "Welcome to CogniaLauncher",
    "onboarding.welcomeDesc": "Your package and environment manager",
    "onboarding.welcomeFeature1Title": "Multi-language",
    "onboarding.welcomeFeature1Desc": "Support for multiple languages",
    "onboarding.welcomeFeature2Title": "Package Management",
    "onboarding.welcomeFeature2Desc": "Manage packages easily",
    "onboarding.welcomeFeature3Title": "Fast",
    "onboarding.welcomeFeature3Desc": "Lightning fast performance",
    "onboarding.welcomeHint": "Let's get started",
  };
  return translations[key] || key;
};

describe("WelcomeStep", () => {
  it("renders welcome title", () => {
    render(<WelcomeStep t={mockT} />);
    expect(screen.getByText("Welcome to CogniaLauncher")).toBeInTheDocument();
  });

  it("renders welcome description", () => {
    render(<WelcomeStep t={mockT} />);
    expect(screen.getByText("Your package and environment manager")).toBeInTheDocument();
  });

  it("renders all three feature cards", () => {
    render(<WelcomeStep t={mockT} />);
    expect(screen.getByText("Multi-language")).toBeInTheDocument();
    expect(screen.getByText("Package Management")).toBeInTheDocument();
    expect(screen.getByText("Fast")).toBeInTheDocument();
  });

  it("renders feature descriptions", () => {
    render(<WelcomeStep t={mockT} />);
    expect(screen.getByText("Support for multiple languages")).toBeInTheDocument();
    expect(screen.getByText("Manage packages easily")).toBeInTheDocument();
  });

  it("renders hint text", () => {
    render(<WelcomeStep t={mockT} />);
    expect(screen.getByText("Let's get started")).toBeInTheDocument();
  });
});
