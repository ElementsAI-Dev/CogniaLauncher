import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ProviderCard } from "./provider-card";
import type { ProviderInfo } from "@/lib/tauri";

const mockT = (key: string) => {
  const translations: Record<string, string> = {
    "providers.filterEnvironment": "Environment",
    "providers.statusAvailable": "Available",
    "providers.statusUnavailable": "Unavailable",
    "providers.platforms": "Supported Platforms",
    "providers.capabilities": "Capabilities",
    "providers.enabled": "Enabled",
    "providers.checkStatus": "Check Status",
    "providers.priority": "Priority",
  };
  return translations[key] || key;
};

const mockProvider: ProviderInfo = {
  id: "npm",
  display_name: "npm",
  capabilities: ["install", "uninstall", "search", "update", "list"],
  platforms: ["windows", "linux", "macos"],
  priority: 100,
  is_environment_provider: false,
  enabled: true,
};

const mockEnvironmentProvider: ProviderInfo = {
  id: "nvm",
  display_name: "Node Version Manager",
  capabilities: ["install", "uninstall", "version_switch", "multi_version"],
  platforms: ["linux", "macos"],
  priority: 90,
  is_environment_provider: true,
  enabled: true,
};

describe("ProviderCard", () => {
  const mockOnToggle = jest.fn();
  const mockOnCheckStatus = jest.fn().mockResolvedValue(true);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders provider information correctly", () => {
    render(
      <ProviderCard
        provider={mockProvider}
        isToggling={false}
        onToggle={mockOnToggle}
        onCheckStatus={mockOnCheckStatus}
        t={mockT}
      />,
    );

    expect(screen.getAllByText("npm").length).toBeGreaterThan(0);
    expect(screen.getByText("Supported Platforms")).toBeInTheDocument();
    expect(screen.getByText("Capabilities")).toBeInTheDocument();
    expect(screen.getByText("install")).toBeInTheDocument();
    expect(screen.getByText("Priority: 100")).toBeInTheDocument();
  });

  it("shows environment badge for environment providers", () => {
    render(
      <ProviderCard
        provider={mockEnvironmentProvider}
        isToggling={false}
        onToggle={mockOnToggle}
        onCheckStatus={mockOnCheckStatus}
        t={mockT}
      />,
    );

    expect(screen.getByText("Environment")).toBeInTheDocument();
    expect(screen.getByText("Node Version Manager")).toBeInTheDocument();
  });

  it("shows availability status when provided", () => {
    render(
      <ProviderCard
        provider={mockProvider}
        isAvailable={true}
        isToggling={false}
        onToggle={mockOnToggle}
        onCheckStatus={mockOnCheckStatus}
        t={mockT}
      />,
    );

    expect(screen.getByText("Available")).toBeInTheDocument();
  });

  it("shows unavailable status when not available", () => {
    render(
      <ProviderCard
        provider={mockProvider}
        isAvailable={false}
        isToggling={false}
        onToggle={mockOnToggle}
        onCheckStatus={mockOnCheckStatus}
        t={mockT}
      />,
    );

    expect(screen.getByText("Unavailable")).toBeInTheDocument();
  });

  it("calls onToggle when switch is clicked", async () => {
    const user = userEvent.setup();
    render(
      <ProviderCard
        provider={mockProvider}
        isToggling={false}
        onToggle={mockOnToggle}
        onCheckStatus={mockOnCheckStatus}
        t={mockT}
      />,
    );

    const switchElement = screen.getByRole("switch");
    await user.click(switchElement);

    expect(mockOnToggle).toHaveBeenCalledWith("npm", false);
  });

  it("disables switch when toggling", () => {
    render(
      <ProviderCard
        provider={mockProvider}
        isToggling={true}
        onToggle={mockOnToggle}
        onCheckStatus={mockOnCheckStatus}
        t={mockT}
      />,
    );

    const switchElement = screen.getByRole("switch");
    expect(switchElement).toBeDisabled();
  });

  it("calls onCheckStatus when check button is clicked", async () => {
    const user = userEvent.setup();
    render(
      <ProviderCard
        provider={mockProvider}
        isToggling={false}
        onToggle={mockOnToggle}
        onCheckStatus={mockOnCheckStatus}
        t={mockT}
      />,
    );

    // Open the dropdown menu first (sr-only text uses the translation key)
    const menuTrigger = screen.getByText("providers.moreActions").closest("button")!;
    await user.click(menuTrigger);

    // Click the check status menu item
    const checkItem = await screen.findByText("Check Status");
    await user.click(checkItem);

    await waitFor(() => {
      expect(mockOnCheckStatus).toHaveBeenCalledWith("npm");
    });
  });

  it("renders all platforms correctly", () => {
    render(
      <ProviderCard
        provider={mockProvider}
        isToggling={false}
        onToggle={mockOnToggle}
        onCheckStatus={mockOnCheckStatus}
        t={mockT}
      />,
    );

    expect(screen.getByText("windows")).toBeInTheDocument();
    expect(screen.getByText("linux")).toBeInTheDocument();
    expect(screen.getByText("macos")).toBeInTheDocument();
  });

  it("renders all capabilities as badges", () => {
    render(
      <ProviderCard
        provider={mockProvider}
        isToggling={false}
        onToggle={mockOnToggle}
        onCheckStatus={mockOnCheckStatus}
        t={mockT}
      />,
    );

    expect(screen.getByText("install")).toBeInTheDocument();
    expect(screen.getByText("uninstall")).toBeInTheDocument();
    expect(screen.getByText("search")).toBeInTheDocument();
    expect(screen.getByText("update")).toBeInTheDocument();
    expect(screen.getByText("list")).toBeInTheDocument();
  });

  it("applies reduced opacity when provider is disabled", () => {
    const disabledProvider = { ...mockProvider, enabled: false };
    const { container } = render(
      <ProviderCard
        provider={disabledProvider}
        isToggling={false}
        onToggle={mockOnToggle}
        onCheckStatus={mockOnCheckStatus}
        t={mockT}
      />,
    );

    const card = container.querySelector('[class*="opacity-60"]');
    expect(card).toBeInTheDocument();
  });
});
