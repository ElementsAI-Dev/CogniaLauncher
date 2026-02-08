import { render } from "@testing-library/react";
import { PackageOverviewCard } from "./package-overview-card";

jest.mock("@/components/providers/locale-provider", () => ({
  useLocale: () => ({ t: (key: string) => key }),
}));

jest.mock("@/lib/tauri", () => ({
  isTauri: () => false,
  openExternal: jest.fn(),
}));

jest.mock("sonner", () => ({
  toast: { success: jest.fn(), error: jest.fn() },
}));

const defaultProps = {
  packageInfo: null,
  installedPkg: null,
  isInstalled: false,
  isPinned: false,
  isBookmarked: false,
  isInstalling: false,
  hasUpdate: false,
  latestVersion: null,
  onInstall: jest.fn(() => Promise.resolve()),
  onUninstall: jest.fn(() => Promise.resolve()),
  onPin: jest.fn(() => Promise.resolve()),
  onUnpin: jest.fn(() => Promise.resolve()),
  onBookmark: jest.fn(),
  onRollback: jest.fn(() => Promise.resolve()),
};

describe("PackageOverviewCard", () => {
  it("renders without crashing", () => {
    const { container } = render(<PackageOverviewCard {...defaultProps} />);
    expect(container).toBeInTheDocument();
  });
});
