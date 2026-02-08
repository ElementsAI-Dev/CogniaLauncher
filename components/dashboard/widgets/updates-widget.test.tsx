import { render, screen } from "@testing-library/react";
import { UpdatesWidget } from "./updates-widget";

jest.mock("@/components/providers/locale-provider", () => ({
  useLocale: () => ({ t: (key: string) => key }),
}));

jest.mock("@/lib/stores/packages", () => ({
  usePackageStore: (selector: (s: Record<string, unknown>) => unknown) =>
    selector({
      availableUpdates: [],
      isCheckingUpdates: false,
      updateCheckProgress: 0,
      lastUpdateCheck: null,
      setIsCheckingUpdates: jest.fn(),
      setAvailableUpdates: jest.fn(),
      setUpdateCheckProgress: jest.fn(),
      setLastUpdateCheck: jest.fn(),
    }),
}));

jest.mock("@/lib/tauri", () => ({
  isTauri: () => false,
  listenUpdateCheckProgress: jest.fn(() => Promise.resolve(jest.fn())),
}));

jest.mock("next/link", () => {
  const MockLink = ({ children, ...props }: { children: React.ReactNode; href: string }) => (
    <a {...props}>{children}</a>
  );
  MockLink.displayName = "MockLink";
  return MockLink;
});

describe("UpdatesWidget", () => {
  it("renders updates title", () => {
    render(<UpdatesWidget />);
    expect(screen.getByText("dashboard.widgets.updatesAvailable")).toBeInTheDocument();
  });
});
