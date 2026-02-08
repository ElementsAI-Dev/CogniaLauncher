import { render } from "@testing-library/react";
import { ProviderHistoryTab } from "./provider-history-tab";

jest.mock("@/components/providers/locale-provider", () => ({
  useLocale: () => ({ t: (key: string) => key }),
}));

describe("ProviderHistoryTab", () => {
  it("renders without crashing", () => {
    const { container } = render(
      <ProviderHistoryTab
        installHistory={[]}
        loadingHistory={false}
        onRefreshHistory={jest.fn(() => Promise.resolve([]))}
        t={(key: string) => key}
      />,
    );
    expect(container).toBeInTheDocument();
  });
});
