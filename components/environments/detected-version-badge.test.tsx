import { render, screen } from "@testing-library/react";
import { DetectedVersionBadge } from "./detected-version-badge";

describe("DetectedVersionBadge", () => {
  const mockT = (key: string) => {
    const translations: Record<string, string> = {
      "environments.detected": "Detected",
    };
    return translations[key] || key;
  };

  const defaultProps = {
    version: "18.0.0",
    source: "nvmrc",
    t: mockT,
  };

  it("renders full badge with version and source", () => {
    render(<DetectedVersionBadge {...defaultProps} />);
    expect(screen.getByText(/Detected.*18\.0\.0.*\(nvmrc\)/)).toBeInTheDocument();
  });

  it("renders compact badge without source", () => {
    render(<DetectedVersionBadge {...defaultProps} compact />);
    const badge = screen.getByText(/Detected.*18\.0\.0/);
    expect(badge).toBeInTheDocument();
    expect(badge.textContent).not.toContain("(nvmrc)");
  });

  it("replaces underscores in source with spaces", () => {
    render(
      <DetectedVersionBadge {...defaultProps} source="tool_versions" />,
    );
    expect(screen.getByText(/tool versions/)).toBeInTheDocument();
  });

  it("renders Scan icon in full mode", () => {
    const { container } = render(<DetectedVersionBadge {...defaultProps} />);
    // Scan icon is rendered as an svg with lucide class
    expect(container.querySelector("svg")).toBeInTheDocument();
  });

  it("does not render Scan icon in compact mode", () => {
    const { container } = render(
      <DetectedVersionBadge {...defaultProps} compact />,
    );
    // Compact mode should not have the Scan icon svg
    expect(container.querySelector("svg")).toBeNull();
  });
});
