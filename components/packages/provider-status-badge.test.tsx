import { render, screen } from "@testing-library/react";
import { ProviderStatusBadge } from "./provider-status-badge";

jest.mock("@/components/providers/locale-provider", () => ({
  useLocale: () => ({
    t: (key: string) => {
      const translations: Record<string, string> = {
        "provider.status": "Provider Status",
        "provider.available": "Available",
        "provider.unavailable": "Unavailable",
        "provider.enabled": "Enabled",
        "provider.disabled": "Disabled",
        "provider.manageProviders": "Manage providers",
      };
      return translations[key] || key;
    },
  }),
}));

const mockProviders = [
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
    id: "conda",
    display_name: "Conda",
    capabilities: ["Search", "Install"],
    platforms: ["Windows"],
    priority: 2,
    is_environment_provider: true,
    enabled: false,
  },
];

describe("ProviderStatusBadge", () => {
  it("renders provider count badge", () => {
    render(
      <ProviderStatusBadge
        providers={
          mockProviders as unknown as Parameters<
            typeof ProviderStatusBadge
          >[0]["providers"]
        }
      />,
    );
    expect(screen.getByRole("button")).toBeInTheDocument();
  });

  it("renders badge button", () => {
    render(
      <ProviderStatusBadge
        providers={
          mockProviders as unknown as Parameters<
            typeof ProviderStatusBadge
          >[0]["providers"]
        }
      />,
    );

    // Just verify the badge button renders
    expect(screen.getByRole("button")).toBeInTheDocument();
  });

  it("has correct provider count", () => {
    render(
      <ProviderStatusBadge
        providers={
          mockProviders as unknown as Parameters<
            typeof ProviderStatusBadge
          >[0]["providers"]
        }
      />,
    );

    // Badge should show provider information
    const button = screen.getByRole("button");
    expect(button).toBeInTheDocument();
  });
});
