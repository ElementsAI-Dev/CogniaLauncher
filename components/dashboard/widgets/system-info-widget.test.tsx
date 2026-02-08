import { render, screen } from "@testing-library/react";
import { SystemInfoWidget } from "./system-info-widget";

jest.mock("@/components/providers/locale-provider", () => ({
  useLocale: () => ({ t: (key: string) => key }),
}));

const platformInfo = {
  os: "Windows",
  osVersion: "11",
  arch: "x86_64",
  hostname: "test-pc",
  cpuModel: "Intel i7",
  cpuCores: 8,
  totalMemory: 17179869184,
  availableMemory: 8589934592,
};

describe("SystemInfoWidget", () => {
  it("renders loading state when platformInfo is null", () => {
    render(<SystemInfoWidget platformInfo={null} cogniaDir={null} />);
    expect(screen.getByText("dashboard.widgets.systemInfo")).toBeInTheDocument();
  });

  it("renders system info when platformInfo is provided", () => {
    render(
      <SystemInfoWidget platformInfo={platformInfo as never} cogniaDir="C:\\Users\\test\\.cognia" />,
    );
    expect(screen.getByText("dashboard.widgets.systemInfo")).toBeInTheDocument();
  });
});
