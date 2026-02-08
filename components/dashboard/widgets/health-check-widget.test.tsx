import { render, screen } from "@testing-library/react";
import { HealthCheckWidget } from "./health-check-widget";

jest.mock("@/components/providers/locale-provider", () => ({
  useLocale: () => ({ t: (key: string) => key }),
}));

jest.mock("@/hooks/use-health-check", () => ({
  useHealthCheck: () => ({
    results: [],
    loading: false,
    runHealthCheck: jest.fn(),
  }),
}));

jest.mock("@/lib/tauri", () => ({
  isTauri: () => false,
}));

jest.mock("next/link", () => {
  const MockLink = ({ children, ...props }: { children: React.ReactNode; href: string }) => (
    <a {...props}>{children}</a>
  );
  MockLink.displayName = "MockLink";
  return MockLink;
});

describe("HealthCheckWidget", () => {
  it("renders health check title", () => {
    render(<HealthCheckWidget />);
    expect(screen.getByText("dashboard.widgets.healthCheck")).toBeInTheDocument();
  });
});
