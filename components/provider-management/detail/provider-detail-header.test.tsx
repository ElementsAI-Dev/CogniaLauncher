import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ProviderDetailHeader } from "./provider-detail-header";

const mockPush = jest.fn();
jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush, back: jest.fn() }),
}));

jest.mock("../provider-icon", () => ({
  ProviderIcon: ({ providerId }: { providerId: string }) => (
    <span data-testid={`provider-icon-${providerId}`} />
  ),
}));

const mockT = (key: string) => {
  const translations: Record<string, string> = {
    "providers.statusAvailable": "Available",
    "providers.statusUnavailable": "Unavailable",
    "providers.filterEnvironment": "Environment",
    "providers.checkStatus": "Check Status",
    "providers.checkStatusDesc": "Check provider status",
    "providers.refresh": "Refresh",
    "providers.enabled": "Enabled",
  };
  return translations[key] || key;
};

const defaultProps = {
  provider: {
    id: "npm",
    display_name: "npm",
    capabilities: ["install", "search"],
    enabled: true,
    priority: 50,
    platforms: ["windows", "linux"],
    is_environment_provider: false,
  },
  isAvailable: true as boolean | null,
  isToggling: false,
  isCheckingStatus: false,
  onToggle: jest.fn(),
  onCheckStatus: jest.fn(),
  onRefresh: jest.fn(),
  t: mockT,
};

describe("ProviderDetailHeader", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders without crashing", () => {
    const { container } = render(<ProviderDetailHeader {...defaultProps} />);
    expect(container).toBeInTheDocument();
  });

  it("renders provider display name and id", () => {
    render(<ProviderDetailHeader {...defaultProps} />);
    // "npm" appears as both display_name (h1) and id (p.font-mono)
    expect(screen.getAllByText("npm").length).toBeGreaterThanOrEqual(2);
  });

  it("renders provider icon", () => {
    render(<ProviderDetailHeader {...defaultProps} />);
    expect(screen.getByTestId("provider-icon-npm")).toBeInTheDocument();
  });

  it("shows Available badge when isAvailable is true", () => {
    render(<ProviderDetailHeader {...defaultProps} isAvailable={true} />);
    expect(screen.getByText("Available")).toBeInTheDocument();
  });

  it("shows Unavailable badge when isAvailable is false", () => {
    render(<ProviderDetailHeader {...defaultProps} isAvailable={false} />);
    expect(screen.getByText("Unavailable")).toBeInTheDocument();
  });

  it("does not show availability badge when isAvailable is null", () => {
    render(<ProviderDetailHeader {...defaultProps} isAvailable={null} />);
    expect(screen.queryByText("Available")).not.toBeInTheDocument();
    expect(screen.queryByText("Unavailable")).not.toBeInTheDocument();
  });

  it("shows environment badge for environment providers", () => {
    const envProvider = {
      ...defaultProps.provider,
      is_environment_provider: true,
    };
    render(<ProviderDetailHeader {...defaultProps} provider={envProvider} />);
    expect(screen.getByText("Environment")).toBeInTheDocument();
  });

  it("does not show environment badge for non-environment providers", () => {
    render(<ProviderDetailHeader {...defaultProps} />);
    expect(screen.queryByText("Environment")).not.toBeInTheDocument();
  });

  it("navigates back to providers on back button click", async () => {
    const user = userEvent.setup();
    render(<ProviderDetailHeader {...defaultProps} />);
    const buttons = screen.getAllByRole("button");
    // First button is the back button
    await user.click(buttons[0]);
    expect(mockPush).toHaveBeenCalledWith("/providers");
  });

  it("calls onCheckStatus when check status button is clicked", async () => {
    const user = userEvent.setup();
    render(<ProviderDetailHeader {...defaultProps} />);
    const checkButton = screen.getByText("Check Status").closest("button")!;
    await user.click(checkButton);
    expect(defaultProps.onCheckStatus).toHaveBeenCalled();
  });

  it("calls onRefresh when refresh button is clicked", async () => {
    const user = userEvent.setup();
    render(<ProviderDetailHeader {...defaultProps} />);
    const refreshButton = screen.getByText("Refresh").closest("button")!;
    await user.click(refreshButton);
    expect(defaultProps.onRefresh).toHaveBeenCalled();
  });

  it("renders toggle switch checked when provider is enabled", () => {
    render(<ProviderDetailHeader {...defaultProps} />);
    const switchEl = screen.getByRole("switch");
    expect(switchEl).toBeChecked();
  });

  it("renders toggle switch unchecked when provider is disabled", () => {
    const disabledProvider = { ...defaultProps.provider, enabled: false };
    render(<ProviderDetailHeader {...defaultProps} provider={disabledProvider} />);
    const switchEl = screen.getByRole("switch");
    expect(switchEl).not.toBeChecked();
  });

  it("disables switch when isToggling is true", () => {
    render(<ProviderDetailHeader {...defaultProps} isToggling={true} />);
    const switchEl = screen.getByRole("switch");
    expect(switchEl).toBeDisabled();
  });

  it("disables check status button when isCheckingStatus is true", () => {
    render(<ProviderDetailHeader {...defaultProps} isCheckingStatus={true} />);
    const checkButton = screen.getByText("Check Status").closest("button")!;
    expect(checkButton).toBeDisabled();
  });

  it("calls onToggle when switch is clicked", async () => {
    const user = userEvent.setup();
    render(<ProviderDetailHeader {...defaultProps} />);
    const switchEl = screen.getByRole("switch");
    await user.click(switchEl);
    expect(defaultProps.onToggle).toHaveBeenCalledWith(false);
  });
});
