import { render } from "@testing-library/react";
import { CacheDetailPageClient } from "./cache-detail-page";

jest.mock("@/components/providers/locale-provider", () => ({
  useLocale: () => ({ t: (key: string) => key }),
}));

jest.mock("@/lib/tauri", () => ({
  isTauri: () => false,
  cacheList: jest.fn(() => Promise.resolve([])),
  cacheGetStats: jest.fn(() => Promise.resolve(null)),
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

describe("CacheDetailPage", () => {
  it("renders without crashing", () => {
    const { container } = render(<CacheDetailPageClient cacheType="provider" />);
    expect(container).toBeInTheDocument();
  });
});
