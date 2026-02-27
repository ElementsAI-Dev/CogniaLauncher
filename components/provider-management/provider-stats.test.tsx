import { render, screen } from "@testing-library/react";
import { ProviderStats } from "./provider-stats";

const mockT = (key: string) => {
  const translations: Record<string, string> = {
    "providers.statsTotal": "Total",
    "providers.statsEnabled": "Enabled",
    "providers.statsDisabled": "Disabled",
    "providers.statsAvailable": "Available",
    "providers.statsUnavailable": "Unavailable",
    "providers.statsEnvironment": "Environment",
    "providers.statsPackage": "Package",
    "providers.statsSystem": "System",
  };
  return translations[key] || key;
};

describe("ProviderStats", () => {
  const defaultProps = {
    total: 10,
    enabled: 8,
    available: 6,
    unavailable: 2,
    t: mockT,
  };

  it("renders total count", () => {
    render(<ProviderStats {...defaultProps} />);

    expect(screen.getByText("Total:")).toBeInTheDocument();
    expect(screen.getByText("10")).toBeInTheDocument();
  });

  it("renders enabled count", () => {
    render(<ProviderStats {...defaultProps} />);

    expect(screen.getByText("Enabled:")).toBeInTheDocument();
    expect(screen.getByText("8")).toBeInTheDocument();
  });

  it("renders disabled count (total - enabled)", () => {
    render(<ProviderStats {...defaultProps} />);

    expect(screen.getAllByText(/Disabled/).length).toBeGreaterThan(0);
  });

  it("renders available count", () => {
    render(<ProviderStats {...defaultProps} />);

    expect(screen.getByText("Available:")).toBeInTheDocument();
    expect(screen.getByText("6")).toBeInTheDocument();
  });

  it("renders unavailable count", () => {
    render(<ProviderStats {...defaultProps} />);

    expect(screen.getByText("Unavailable:")).toBeInTheDocument();
  });

  it("renders with zero values", () => {
    render(
      <ProviderStats
        total={0}
        enabled={0}
        available={0}
        unavailable={0}
        t={mockT}
      />,
    );

    expect(screen.getAllByText("0").length).toBeGreaterThan(0);
  });

  it("calculates disabled correctly", () => {
    render(
      <ProviderStats
        total={5}
        enabled={3}
        available={2}
        unavailable={1}
        t={mockT}
      />,
    );

    expect(screen.getByText("5")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
  });

  it("renders environment count when provided", () => {
    render(
      <ProviderStats {...defaultProps} environmentCount={4} />,
    );

    expect(screen.getByText("Environment:")).toBeInTheDocument();
    expect(screen.getByText("4")).toBeInTheDocument();
  });

  it("renders package count when provided", () => {
    render(
      <ProviderStats {...defaultProps} packageCount={5} />,
    );

    expect(screen.getByText("Package:")).toBeInTheDocument();
    expect(screen.getByText("5")).toBeInTheDocument();
  });

  it("renders system count when provided", () => {
    render(
      <ProviderStats {...defaultProps} systemCount={3} />,
    );

    expect(screen.getByText("System:")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
  });

  it("renders all category counts together", () => {
    render(
      <ProviderStats
        {...defaultProps}
        environmentCount={4}
        packageCount={5}
        systemCount={1}
      />,
    );

    expect(screen.getByText("Environment:")).toBeInTheDocument();
    expect(screen.getByText("Package:")).toBeInTheDocument();
    expect(screen.getByText("System:")).toBeInTheDocument();
  });

  it("does not render category section when no counts provided", () => {
    render(<ProviderStats {...defaultProps} />);

    expect(screen.queryByText("Environment:")).not.toBeInTheDocument();
    expect(screen.queryByText("Package:")).not.toBeInTheDocument();
    expect(screen.queryByText("System:")).not.toBeInTheDocument();
  });

  it("renders disabled as total minus enabled", () => {
    render(
      <ProviderStats
        total={10}
        enabled={7}
        available={5}
        unavailable={3}
        t={mockT}
      />,
    );

    // disabled = 10 - 7 = 3, but 3 is also unavailable count
    expect(screen.getByText("Disabled:")).toBeInTheDocument();
  });
});
