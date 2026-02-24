import { render } from "@testing-library/react";
import { WslDistroOverview } from "./wsl-distro-overview";

jest.mock("@/components/providers/locale-provider", () => ({
  useLocale: () => ({ t: (key: string) => key }),
}));

jest.mock("@/lib/tauri", () => ({
  isTauri: () => false,
}));

describe("WslDistroOverview", () => {
  it("renders without crashing", () => {
    const { container } = render(
      <WslDistroOverview
        distroName="Ubuntu"
        distro={null}
        getDiskUsage={jest.fn(() => Promise.resolve(null))}
        getIpAddress={jest.fn(() => Promise.resolve(""))}
        getDistroConfig={jest.fn(() => Promise.resolve(null))}
        setDistroConfigValue={jest.fn(() => Promise.resolve())}
        detectDistroEnv={jest.fn(() => Promise.resolve(null))}
        t={(key: string) => key}
      />,
    );
    expect(container).toBeInTheDocument();
  });
});
