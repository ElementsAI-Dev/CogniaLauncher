import { render } from "@testing-library/react";
import { WslDistroTerminal } from "./wsl-distro-terminal";

jest.mock("@/components/providers/locale-provider", () => ({
  useLocale: () => ({ t: (key: string) => key }),
}));

jest.mock("@/lib/tauri", () => ({
  isTauri: () => false,
}));

describe("WslDistroTerminal", () => {
  it("renders without crashing", () => {
    const { container } = render(
      <WslDistroTerminal
        distroName="Ubuntu"
        isRunning={false}
        onExec={jest.fn(() => Promise.resolve({ exitCode: 0, stdout: "", stderr: "" }))}
        t={(key: string) => key}
      />,
    );
    expect(container).toBeInTheDocument();
  });
});
