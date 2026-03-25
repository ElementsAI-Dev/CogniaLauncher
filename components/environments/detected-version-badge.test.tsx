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
      <DetectedVersionBadge {...defaultProps} source="tool_versions_file" />,
    );
    expect(screen.getByText(/tool versions file/)).toBeInTheDocument();
  });

  it("preserves provider-specific manifest source labels", () => {
    render(
      <DetectedVersionBadge
        {...defaultProps}
        version="vcpkg manifest"
        source="vcpkg.json"
        sourceType="manifest"
      />,
    );
    expect(screen.getByText(/vcpkg manifest.*\(vcpkg\.json\)/)).toBeInTheDocument();
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

  it("shows mismatch warning when current version is not compatible", () => {
    render(
      <DetectedVersionBadge
        {...defaultProps}
        currentVersion="10.0.0"
        version="1"
      />,
    );
    expect(screen.getByText("environments.versionMismatch")).toBeInTheDocument();
  });

  it("does not show mismatch warning for v-prefix compatible versions", () => {
    render(
      <DetectedVersionBadge
        {...defaultProps}
        currentVersion="20.10.0"
        version="v20.10.0"
      />,
    );
    expect(
      screen.queryByText("environments.versionMismatch"),
    ).not.toBeInTheDocument();
  });
});
