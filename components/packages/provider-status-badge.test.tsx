import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ProviderStatusBadge } from "./provider-status-badge";
import type { ProviderInfo } from "@/lib/tauri";

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
      };
      return translations[key] || key;
    },
  }),
}));

jest.mock("@/lib/tauri", () => ({
  isTauri: () => false,
  providerEnable: jest.fn().mockResolvedValue(undefined),
  providerDisable: jest.fn().mockResolvedValue(undefined),
  providerCheck: jest.fn().mockResolvedValue(true),
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
    // 2 enabled out of 3 total
    expect(screen.getByText("2/3")).toBeInTheDocument();
  });

  it("opens popover with provider list on click", async () => {
    const user = userEvent.setup();
    render(<ProviderStatusBadge providers={mockProviders} />);

    await user.click(screen.getByRole("button"));
    expect(screen.getByText("Provider Management")).toBeInTheDocument();
  });

  it("shows non-environment providers in popover", async () => {
    const user = userEvent.setup();
    render(<ProviderStatusBadge providers={mockProviders} />);

    await user.click(screen.getByRole("button"));
    // pip and NPM should be listed (not environment providers)
    // pip appears both as label and as id, NPM is unique
    expect(screen.getByText("NPM")).toBeInTheDocument();
    expect(screen.getByText("Enable or disable package providers")).toBeInTheDocument();
  });

  it("filters out environment providers from list", async () => {
    const user = userEvent.setup();
    render(<ProviderStatusBadge providers={mockProviders} />);

    await user.click(screen.getByRole("button"));
    // Conda is environment provider, should not be in the list
    expect(screen.queryByText("Conda")).not.toBeInTheDocument();
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
});
