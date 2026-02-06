import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ProviderListItem } from "./provider-list-item";

const mockT = (key: string) => {
  const translations: Record<string, string> = {
    "providers.filterEnvironment": "Environment",
    "providers.priority": "Priority",
    "providers.capabilities": "Capabilities",
    "providers.statusAvailable": "Available",
    "providers.statusUnavailable": "Unavailable",
    "providers.checkStatus": "Check Status",
    "providers.enabled": "Enabled",
  };
  return translations[key] || key;
};

const mockProvider = {
  id: "npm",
  display_name: "npm",
  capabilities: ["install", "uninstall", "search"],
  platforms: ["windows", "linux", "macos"],
  priority: 100,
  is_environment_provider: false,
  enabled: true,
};

const mockEnvironmentProvider = {
  id: "nvm",
  display_name: "Node Version Manager",
  capabilities: ["install", "version_switch", "multi_version"],
  platforms: ["linux", "macos"],
  priority: 90,
  is_environment_provider: true,
  enabled: true,
};

describe("ProviderListItem", () => {
  const defaultProps = {
    provider: mockProvider,
    isToggling: false,
    onToggle: jest.fn(),
    onCheckStatus: jest.fn().mockResolvedValue(true),
    t: mockT,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders provider name and id", () => {
    render(<ProviderListItem {...defaultProps} />);

    expect(screen.getByText("npm")).toBeInTheDocument();
    expect(screen.getByText("(npm)")).toBeInTheDocument();
  });

  it("renders provider priority", () => {
    render(<ProviderListItem {...defaultProps} />);

    expect(screen.getByText(/Priority: 100/)).toBeInTheDocument();
  });

  it("renders capabilities count", () => {
    render(<ProviderListItem {...defaultProps} />);

    expect(screen.getByText(/3 capabilities/)).toBeInTheDocument();
  });

  it("renders environment badge for environment providers", () => {
    render(
      <ProviderListItem {...defaultProps} provider={mockEnvironmentProvider} />,
    );

    expect(screen.getByText("Environment")).toBeInTheDocument();
  });

  it("does not render environment badge for non-environment providers", () => {
    render(<ProviderListItem {...defaultProps} />);

    expect(screen.queryByText("Environment")).not.toBeInTheDocument();
  });

  it("renders switch for enabling/disabling", () => {
    render(<ProviderListItem {...defaultProps} />);

    const switchElement = screen.getByRole("switch");
    expect(switchElement).toBeInTheDocument();
    expect(switchElement).toBeChecked();
  });

  it("calls onToggle when switch is clicked", async () => {
    const user = userEvent.setup();
    render(<ProviderListItem {...defaultProps} />);

    const switchElement = screen.getByRole("switch");
    await user.click(switchElement);

    expect(defaultProps.onToggle).toHaveBeenCalledWith("npm", false);
  });

  it("renders available badge when isAvailable is true", () => {
    render(<ProviderListItem {...defaultProps} isAvailable={true} />);

    expect(screen.getByText("Available")).toBeInTheDocument();
  });

  it("renders unavailable badge when isAvailable is false", () => {
    render(<ProviderListItem {...defaultProps} isAvailable={false} />);

    expect(screen.getByText("Unavailable")).toBeInTheDocument();
  });

  it("calls onCheckStatus when check button is clicked", async () => {
    const user = userEvent.setup();
    render(<ProviderListItem {...defaultProps} />);

    // The check status button uses Tooltip (not title attr), find by button role
    const buttons = screen.getAllByRole("button");
    const checkButton = buttons.find(
      (btn) => btn.className.includes("px-2"),
    );
    expect(checkButton).toBeDefined();
    await user.click(checkButton!);

    await waitFor(() => {
      expect(defaultProps.onCheckStatus).toHaveBeenCalledWith("npm");
    });
  });

  it("disables switch when isToggling is true", () => {
    render(<ProviderListItem {...defaultProps} isToggling={true} />);

    const switchElement = screen.getByRole("switch");
    expect(switchElement).toBeDisabled();
  });

  it("applies opacity when provider is disabled", () => {
    const disabledProvider = { ...mockProvider, enabled: false };
    const { container } = render(
      <ProviderListItem {...defaultProps} provider={disabledProvider} />,
    );

    const listItem = container.firstChild;
    expect(listItem).toHaveClass("opacity-60");
  });

  it("renders provider icon", () => {
    render(<ProviderListItem {...defaultProps} />);

    expect(screen.getByText("📦")).toBeInTheDocument();
  });
});
