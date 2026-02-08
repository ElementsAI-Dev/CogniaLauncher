import { render } from "@testing-library/react";
import { ProviderDetailHeader } from "./provider-detail-header";

jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: jest.fn(), back: jest.fn() }),
}));

jest.mock("../provider-icons", () => ({
  PROVIDER_ICONS: {},
}));

const defaultProps = {
  provider: {
    id: "npm",
    name: "npm",
    display_name: "npm",
    provider_type: "package_manager",
    capabilities: [],
    enabled: true,
    priority: 50,
    platforms: [],
    is_environment_provider: false,
  },
  isAvailable: true,
  isToggling: false,
  isCheckingStatus: false,
  onToggle: jest.fn(),
  onCheckStatus: jest.fn(),
  onRefresh: jest.fn(),
  t: (key: string) => key,
};

describe("ProviderDetailHeader", () => {
  it("renders without crashing", () => {
    const { container } = render(<ProviderDetailHeader {...defaultProps} />);
    expect(container).toBeInTheDocument();
  });
});
