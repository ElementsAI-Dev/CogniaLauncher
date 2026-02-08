import { render } from "@testing-library/react";
import { WslDistroFilesystem } from "./wsl-distro-filesystem";

jest.mock("@/components/providers/locale-provider", () => ({
  useLocale: () => ({ t: (key: string) => key }),
}));

jest.mock("@/lib/tauri", () => ({
  isTauri: () => false,
}));

describe("WslDistroFilesystem", () => {
  it("renders without crashing", () => {
    const { container } = render(
      <WslDistroFilesystem
        distroName="Ubuntu"
        onExec={jest.fn(() => Promise.resolve({ exitCode: 0, stdout: "", stderr: "" }))}
        t={(key: string) => key}
      />,
    );
    expect(container).toBeInTheDocument();
  });
});
