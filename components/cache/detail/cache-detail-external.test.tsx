import { render } from "@testing-library/react";
import { CacheDetailExternalView } from "./cache-detail-external";

jest.mock("@/components/providers/locale-provider", () => ({
  useLocale: () => ({ t: (key: string) => key }),
}));

jest.mock("@/lib/tauri", () => ({
  isTauri: () => false,
  cacheExternalList: jest.fn(() => Promise.resolve([])),
  cacheExternalGetMonitoring: jest.fn(() => Promise.resolve(false)),
}));

jest.mock("next/link", () => {
  const MockLink = ({ children, ...props }: { children: React.ReactNode; href: string }) => (
    <a {...props}>{children}</a>
  );
  MockLink.displayName = "MockLink";
  return MockLink;
});

jest.mock("sonner", () => ({
  toast: { success: jest.fn(), error: jest.fn() },
}));

describe("CacheDetailExternal", () => {
  it("renders without crashing", () => {
    const { container } = render(<CacheDetailExternalView />);
    expect(container).toBeInTheDocument();
  });
});
