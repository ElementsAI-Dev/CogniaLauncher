import { render } from "@testing-library/react";
import { WslDistroNetwork } from "./wsl-distro-network";

jest.mock("@/components/providers/locale-provider", () => ({
  useLocale: () => ({ t: (key: string) => key }),
}));

jest.mock("@/lib/tauri", () => ({
  isTauri: () => false,
}));

describe("WslDistroNetwork", () => {
  it("renders without crashing", () => {
    const { container } = render(
      <WslDistroNetwork
        distroName="Ubuntu"
        isRunning={false}
        getIpAddress={jest.fn(() => Promise.resolve(""))}
        onExec={jest.fn(() => Promise.resolve({ exitCode: 0, stdout: "", stderr: "" }))}
        t={(key: string) => key}
      />,
    );
    expect(container).toBeInTheDocument();
  });
});
