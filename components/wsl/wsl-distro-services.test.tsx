import { render } from "@testing-library/react";
import { WslDistroServices } from "./wsl-distro-services";

jest.mock("@/components/providers/locale-provider", () => ({
  useLocale: () => ({ t: (key: string) => key }),
}));

jest.mock("@/lib/tauri", () => ({
  isTauri: () => false,
}));

describe("WslDistroServices", () => {
  it("renders without crashing", () => {
    const { container } = render(
      <WslDistroServices
        distroName="Ubuntu"
        isRunning={false}
        onExec={jest.fn(() => Promise.resolve({ exitCode: 0, stdout: "", stderr: "" }))}
        t={(key: string) => key}
      />,
    );
    expect(container).toBeInTheDocument();
  });
});
