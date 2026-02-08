import { render } from "@testing-library/react";
import { ProviderEnvironmentTab } from "./provider-environment-tab";

jest.mock("@/components/providers/locale-provider", () => ({
  useLocale: () => ({ t: (key: string) => key }),
}));

jest.mock("@/lib/tauri", () => ({
  isTauri: () => false,
}));

describe("ProviderEnvironmentTab", () => {
  it("renders without crashing", () => {
    const { container } = render(
      <ProviderEnvironmentTab
        providerId="npm"
        environmentInfo={null}
        environmentProviderInfo={null}
        availableVersions={[]}
        loadingEnvironment={false}
        onRefreshEnvironment={jest.fn(() => Promise.resolve())}
        t={(key: string) => key}
      />,
    );
    expect(container).toBeInTheDocument();
  });
});
