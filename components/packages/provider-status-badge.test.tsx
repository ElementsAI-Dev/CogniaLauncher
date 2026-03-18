import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ProviderStatusBadge } from "./provider-status-badge";
import type { ProviderInfo } from "@/lib/tauri";

const mockProviderEnable = jest.fn().mockResolvedValue(undefined);
const mockProviderDisable = jest.fn().mockResolvedValue(undefined);
const mockProviderStatus = jest.fn().mockImplementation(async (providerId: string) => ({
  id: providerId,
  display_name: providerId,
  installed: providerId !== "zig",
  platforms: ["Windows"],
  scope_state: providerId === "zig" ? "timeout" : "available",
  reason: providerId === "zig" ? "Timed out while probing provider" : null,
  reason_code: providerId === "zig" ? "health_check_timeout" : null,
  status: providerId === "zig" ? "unsupported" : "supported",
  update_supported: providerId !== "zig",
  update_reason: providerId === "zig" ? "Timed out while probing provider" : null,
  update_reason_code: providerId === "zig" ? "health_check_timeout" : null,
}));
const mockProviderStatusAll = jest.fn().mockResolvedValue([
  {
    id: "pip",
    display_name: "pip",
    installed: true,
    platforms: ["Windows"],
    scope_state: "available",
    reason: null,
    reason_code: null,
    status: "supported",
    update_supported: true,
    update_reason: null,
    update_reason_code: null,
  },
  {
    id: "npm",
    display_name: "NPM",
    installed: true,
    platforms: ["Windows"],
    scope_state: "available",
    reason: null,
    reason_code: null,
    status: "supported",
    update_supported: true,
    update_reason: null,
    update_reason_code: null,
  },
  {
    id: "zig",
    display_name: "Zig",
    installed: false,
    platforms: ["Windows"],
    scope_state: "timeout",
    reason: "Timed out while probing provider",
    reason_code: "health_check_timeout",
    status: "unsupported",
    update_supported: false,
    update_reason: "Timed out while probing provider",
    update_reason_code: "health_check_timeout",
  },
]);

jest.mock("@/components/providers/locale-provider", () => ({
  useLocale: () => ({
    t: (key: string) => {
      const translations: Record<string, string> = {
        "packages.providers": "Providers",
        "packages.providerManagement": "Provider Management",
        "packages.providerManagementDesc": "Enable or disable package providers",
        "packages.viewAll": "View All",
        "providers.checkStatus": "Check",
        "providers.checkAllStatus": "Check All Status",
        "providers.enableSuccess": "Provider enabled",
        "providers.disableSuccess": "Provider disabled",
        "providers.enableError": "Failed to enable",
        "providers.disableError": "Failed to disable",
        "providers.statusAvailable": "Available",
        "providers.statusUnavailable": "Unavailable",
        "providers.statusTimeout": "Timeout",
        "providers.statusUnsupported": "Unsupported",
      };
      return translations[key] || key;
    },
  }),
}));

jest.mock("@/lib/tauri", () => ({
  isTauri: () => false,
  providerEnable: (...args: unknown[]) => mockProviderEnable(...args),
  providerDisable: (...args: unknown[]) => mockProviderDisable(...args),
  providerStatus: (...args: unknown[]) => mockProviderStatus(...args),
  providerStatusAll: (...args: unknown[]) => mockProviderStatusAll(...args),
}));

jest.mock("sonner", () => ({
  toast: { success: jest.fn(), error: jest.fn() },
}));

const mockProviders: ProviderInfo[] = [
  {
    id: "pip",
    display_name: "pip",
    capabilities: ["Search", "Install"],
    platforms: ["Windows"],
    priority: 1,
    is_environment_provider: false,
    enabled: true,
  },
  {
    id: "npm",
    display_name: "NPM",
    capabilities: ["Search", "Install"],
    platforms: ["Windows"],
    priority: 2,
    is_environment_provider: false,
    enabled: true,
  },
  {
    id: "conda",
    display_name: "Conda",
    capabilities: ["Search", "Install"],
    platforms: ["Windows"],
    priority: 3,
    is_environment_provider: true,
    enabled: false,
  },
  {
    id: "zig",
    display_name: "Zig",
    capabilities: ["Search", "Install", "List", "VersionSwitch"],
    platforms: ["Windows"],
    priority: 4,
    is_environment_provider: true,
    enabled: true,
  },
];

describe("ProviderStatusBadge", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders trigger button", () => {
    render(<ProviderStatusBadge providers={mockProviders} />);
    expect(screen.getByRole("button")).toBeInTheDocument();
  });

  it("shows enabled/total count badge", () => {
    render(<ProviderStatusBadge providers={mockProviders} />);
    // 3 enabled out of 4 total
    expect(screen.getByText("3/4")).toBeInTheDocument();
  });

  it("opens popover with provider list on click", async () => {
    const user = userEvent.setup();
    render(<ProviderStatusBadge providers={mockProviders} />);

    await user.click(screen.getByRole("button"));
    expect(screen.getByText("Provider Management")).toBeInTheDocument();
  });

  it("shows package-surface providers in popover", async () => {
    const user = userEvent.setup();
    render(<ProviderStatusBadge providers={mockProviders} />);

    await user.click(screen.getByRole("button"));
    // pip and NPM should be listed, and zig should be included as a dual-role provider.
    expect(screen.getByText("NPM")).toBeInTheDocument();
    expect(screen.getByText("Zig")).toBeInTheDocument();
    expect(screen.getByText("Enable or disable package providers")).toBeInTheDocument();
  });

  it("filters out environment-only providers from list", async () => {
    const user = userEvent.setup();
    render(<ProviderStatusBadge providers={mockProviders} />);

    await user.click(screen.getByRole("button"));
    // Conda is environment provider, should not be in the list
    expect(screen.queryByText("Conda")).not.toBeInTheDocument();
    expect(screen.getByText("Zig")).toBeInTheDocument();
  });

  it("shows check all status button in popover", async () => {
    const user = userEvent.setup();
    render(<ProviderStatusBadge providers={mockProviders} />);

    await user.click(screen.getByRole("button"));
    expect(screen.getByRole("button", { name: /check all status/i })).toBeInTheDocument();
  });

  it("shows view all link", async () => {
    const user = userEvent.setup();
    render(<ProviderStatusBadge providers={mockProviders} />);

    await user.click(screen.getByRole("button"));
    expect(screen.getByText("View All")).toBeInTheDocument();
  });

  it("renders with empty providers", () => {
    render(<ProviderStatusBadge providers={[]} />);
    expect(screen.getByText("0/0")).toBeInTheDocument();
  });

  it("toggles provider via switch", async () => {
    const user = userEvent.setup();
    const onProviderToggle = jest.fn();
    const onRefresh = jest.fn();
    render(
      <ProviderStatusBadge
        providers={mockProviders}
        onProviderToggle={onProviderToggle}
        onRefresh={onRefresh}
      />,
    );
    await user.click(screen.getByRole("button"));
    // Toggle a switch (pip provider)
    const switches = screen.getAllByRole("switch");
    expect(switches.length).toBeGreaterThan(0);
    await user.click(switches[0]);
  });

  it("checks status for a provider", async () => {
    const user = userEvent.setup();
    render(<ProviderStatusBadge providers={mockProviders} />);
    await user.click(screen.getByRole("button"));
    // Click first "Check" button
    const checkButtons = screen.getAllByRole("button", { name: /check$/i });
    if (checkButtons.length > 0) {
      await user.click(checkButtons[0]);
    }
  });

  it("calls check all status for all enabled providers", async () => {
    const user = userEvent.setup();
    render(<ProviderStatusBadge providers={mockProviders} />);
    await user.click(screen.getByRole("button"));
    await user.click(screen.getByRole("button", { name: /check all status/i }));
  });

  it("loads structured provider statuses when the popover opens", async () => {
    const user = userEvent.setup();
    render(<ProviderStatusBadge providers={mockProviders} />);

    await user.click(screen.getByRole("button"));

    expect(mockProviderStatusAll).toHaveBeenCalled();
    expect(await screen.findByText("Timeout")).toBeInTheDocument();
  });

  it("refreshes structured provider status after toggling a provider", async () => {
    const user = userEvent.setup();
    render(<ProviderStatusBadge providers={mockProviders} />);

    await user.click(screen.getByRole("button"));
    const switches = screen.getAllByRole("switch");
    await user.click(switches[0]);

    expect(mockProviderDisable).toHaveBeenCalled();
    expect(mockProviderStatus).toHaveBeenCalled();
  });
});
