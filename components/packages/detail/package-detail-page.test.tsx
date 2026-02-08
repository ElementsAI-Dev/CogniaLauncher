import { render } from "@testing-library/react";
import { PackageDetailPage } from "./package-detail-page";

jest.mock("@/components/providers/locale-provider", () => ({
  useLocale: () => ({ t: (key: string) => key }),
}));

jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: jest.fn(), back: jest.fn() }),
}));

jest.mock("@/hooks/use-packages", () => ({
  usePackages: () => ({
    loading: false,
    error: null,
    installedPackages: [],
    pinnedPackages: [],
    installing: [],
    fetchPackageInfo: jest.fn(() => Promise.resolve(null)),
    fetchInstalledPackages: jest.fn(() => Promise.resolve([])),
    installPackages: jest.fn(() => Promise.resolve()),
    uninstallPackages: jest.fn(() => Promise.resolve()),
    pinPackage: jest.fn(() => Promise.resolve()),
    unpinPackage: jest.fn(() => Promise.resolve()),
    rollbackPackage: jest.fn(() => Promise.resolve()),
    resolveDependencies: jest.fn(() => Promise.resolve(null)),
    getPackageHistory: jest.fn(() => Promise.resolve([])),
    refresh: jest.fn(),
  }),
}));

jest.mock("@/lib/stores/packages", () => ({
  usePackageStore: () => ({
    bookmarkedPackages: [],
    toggleBookmark: jest.fn(),
  }),
}));

jest.mock("@/lib/tauri", () => ({
  isTauri: () => false,
}));

jest.mock("sonner", () => ({
  toast: { success: jest.fn(), error: jest.fn() },
}));

describe("PackageDetailPage", () => {
  it("renders without crashing", () => {
    const { container } = render(
      <PackageDetailPage providerId="npm" packageName="express" />,
    );
    expect(container).toBeInTheDocument();
  });
});
