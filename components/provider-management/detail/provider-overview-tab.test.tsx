import { render } from "@testing-library/react";
import { ProviderOverviewTab } from "./provider-overview-tab";

jest.mock("@/components/providers/locale-provider", () => ({
  useLocale: () => ({ t: (key: string) => key }),
}));

describe("ProviderOverviewTab", () => {
  it("renders without crashing", () => {
    const provider = {
      id: "npm", name: "npm", display_name: "npm",
      provider_type: "package_manager", capabilities: [],
      enabled: true, priority: 50, platforms: [],
      is_environment_provider: false,
    };
    const { container } = render(
      <ProviderOverviewTab
        provider={provider as never}
        isAvailable={true}
        healthResult={null}
        environmentProviderInfo={null}
        installedCount={0}
        updatesCount={0}
        t={(key: string) => key}
      />,
    );
    expect(container).toBeInTheDocument();
  });
});
