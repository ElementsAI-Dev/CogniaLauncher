import { render } from "@testing-library/react";
import { EnvDetailPageClient } from "./env-detail-page";

jest.mock("@/components/providers/locale-provider", () => ({
  useLocale: () => ({ t: (key: string) => key }),
}));

jest.mock("@/lib/tauri", () => ({
  isTauri: () => false,
  envList: jest.fn(() => Promise.resolve([])),
  envDetectSystem: jest.fn(() => Promise.resolve(null)),
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

describe("EnvDetailPage", () => {
  it("renders without crashing", () => {
    const { container } = render(<EnvDetailPageClient envType="node" />);
    expect(container).toBeInTheDocument();
  });
});
