import { render } from "@testing-library/react";
import { ProviderUpdatesTab } from "./provider-updates-tab";

jest.mock("@/components/providers/locale-provider", () => ({
  useLocale: () => ({ t: (key: string) => key }),
}));

jest.mock("@/lib/tauri", () => ({
  isTauri: () => false,
}));

jest.mock("sonner", () => ({
  toast: { success: jest.fn(), error: jest.fn() },
}));

describe("ProviderUpdatesTab", () => {
  it("renders without crashing", () => {
    const { container } = render(
      <ProviderUpdatesTab
        providerId="npm"
        availableUpdates={[]}
        loadingUpdates={false}
        onCheckUpdates={jest.fn(() => Promise.resolve([]))}
        onRefreshPackages={jest.fn(() => Promise.resolve([]))}
        t={(key: string) => key}
      />,
    );
    expect(container).toBeInTheDocument();
  });
});
