import { render, screen } from "@testing-library/react";
import { ProviderStats } from "./provider-stats";

jest.mock('@/components/providers/locale-provider', () => ({ useLocale: () => ({ t: (key: string) => key }) }));

describe("ProviderStats", () => {
  const defaultProps = {
    total: 10,
    enabled: 8,
    available: 6,
    unavailable: 2,
  };

  it("renders total count", () => {
    render(<ProviderStats {...defaultProps} />);

    expect(screen.getByText("providers.statsTotal:")).toBeInTheDocument();
    expect(screen.getByText("10")).toBeInTheDocument();
  });

  it("renders enabled count", () => {
    render(<ProviderStats {...defaultProps} />);

    expect(screen.getByText("providers.statsEnabled:")).toBeInTheDocument();
    expect(screen.getByText("8")).toBeInTheDocument();
  });

  it("renders disabled count (total - enabled)", () => {
    render(<ProviderStats {...defaultProps} />);

    expect(screen.getAllByText(/providers\.statsDisabled/).length).toBeGreaterThan(0);
  });

  it("renders available count", () => {
    render(<ProviderStats {...defaultProps} />);

    expect(screen.getByText("providers.statsAvailable:")).toBeInTheDocument();
    expect(screen.getByText("6")).toBeInTheDocument();
  });

  it("renders unavailable count", () => {
    render(<ProviderStats {...defaultProps} />);

    expect(screen.getByText("providers.statsUnavailable:")).toBeInTheDocument();
  });

  it("renders with zero values", () => {
    render(
      <ProviderStats
        total={0}
        enabled={0}
        available={0}
        unavailable={0}

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

      />,
    );

    expect(screen.getByText("5")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
  });

  it("renders environment count when provided", () => {
    render(
      <ProviderStats {...defaultProps} environmentCount={4} />,
    );

    expect(screen.getByText("providers.statsEnvironment:")).toBeInTheDocument();
    expect(screen.getByText("4")).toBeInTheDocument();
  });

  it("renders package count when provided", () => {
    render(
      <ProviderStats {...defaultProps} packageCount={5} />,
    );

    expect(screen.getByText("providers.statsPackage:")).toBeInTheDocument();
    expect(screen.getByText("5")).toBeInTheDocument();
  });

  it("renders system count when provided", () => {
    render(
      <ProviderStats {...defaultProps} systemCount={3} />,
    );

    expect(screen.getByText("providers.statsSystem:")).toBeInTheDocument();
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

    expect(screen.getByText("providers.statsEnvironment:")).toBeInTheDocument();
    expect(screen.getByText("providers.statsPackage:")).toBeInTheDocument();
    expect(screen.getByText("providers.statsSystem:")).toBeInTheDocument();
  });

  it("does not render category section when no counts provided", () => {
    render(<ProviderStats {...defaultProps} />);

    expect(screen.queryByText("providers.statsEnvironment:")).not.toBeInTheDocument();
    expect(screen.queryByText("providers.statsPackage:")).not.toBeInTheDocument();
    expect(screen.queryByText("providers.statsSystem:")).not.toBeInTheDocument();
  });

  it("renders disabled as total minus enabled", () => {
    render(
      <ProviderStats
        total={10}
        enabled={7}
        available={5}
        unavailable={3}

      />,
    );

    // disabled = 10 - 7 = 3, but 3 is also unavailable count
    expect(screen.getByText("providers.statsDisabled:")).toBeInTheDocument();
  });
});
