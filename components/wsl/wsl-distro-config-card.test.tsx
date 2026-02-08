import { render } from "@testing-library/react";
import { WslDistroConfigCard } from "./wsl-distro-config-card";

jest.mock("@/components/providers/locale-provider", () => ({
  useLocale: () => ({ t: (key: string) => key }),
}));

describe("WslDistroConfigCard", () => {
  it("renders without crashing", () => {
    const { container } = render(
      <WslDistroConfigCard
        distroName="Ubuntu"
        getDistroConfig={jest.fn(() => Promise.resolve(null))}
        setDistroConfigValue={jest.fn(() => Promise.resolve())}
        t={(key: string) => key}
      />,
    );
    expect(container).toBeInTheDocument();
  });
});
