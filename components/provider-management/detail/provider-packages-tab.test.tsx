import { render } from "@testing-library/react";
import { ProviderPackagesTab } from "./provider-packages-tab";

jest.mock("@/components/providers/locale-provider", () => ({
  useLocale: () => ({ t: (key: string) => key }),
}));

jest.mock("@/lib/tauri", () => ({
  isTauri: () => false,
}));

jest.mock("sonner", () => ({
  toast: { success: jest.fn(), error: jest.fn() },
}));

describe("ProviderPackagesTab", () => {
  it("renders without crashing", () => {
    const { container } = render(
      <ProviderPackagesTab
        providerId="npm"
        installedPackages={[]}
        searchResults={[]}
        searchQuery=""
        loadingPackages={false}
        loadingSearch={false}
        onSearchPackages={jest.fn(() => Promise.resolve([]))}
        onInstallPackage={jest.fn(() => Promise.resolve())}
        onUninstallPackage={jest.fn(() => Promise.resolve())}
        onRefreshPackages={jest.fn(() => Promise.resolve([]))}
        t={(key: string) => key}
      />,
    );
    expect(container).toBeInTheDocument();
  });
});
