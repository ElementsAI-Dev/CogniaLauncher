import { render } from "@testing-library/react";
import { HealthCheckPanel } from "./health-check-panel";

jest.mock("@/components/providers/locale-provider", () => ({
  useLocale: () => ({ t: (key: string) => key }),
}));

jest.mock("@/hooks/use-health-check", () => ({
  useHealthCheck: () => ({
    systemHealth: null,
    loading: false,
    error: null,
    checkAll: jest.fn(),
    getStatusColor: jest.fn(() => "green"),
  }),
}));

describe("HealthCheckPanel", () => {
  it("renders without crashing", () => {
    const { container } = render(<HealthCheckPanel />);
    expect(container).toBeInTheDocument();
  });
});
