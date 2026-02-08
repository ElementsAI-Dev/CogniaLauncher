import { render } from "@testing-library/react";
import { ProviderHealthTab } from "./provider-health-tab";

jest.mock("@/components/providers/locale-provider", () => ({
  useLocale: () => ({ t: (key: string) => key }),
}));

describe("ProviderHealthTab", () => {
  it("renders without crashing", () => {
    const { container } = render(
      <ProviderHealthTab
        healthResult={null}
        loadingHealth={false}
        onRunHealthCheck={jest.fn(() => Promise.resolve(null))}
        t={(key: string) => key}
      />,
    );
    expect(container).toBeInTheDocument();
  });
});
