import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { UpdateCheckerCard } from "./update-checker";
import { useEnvironments } from "@/hooks/use-environments";

jest.mock("@/hooks/use-environments", () => ({
  useEnvironments: jest.fn(),
}));

const mockUseEnvironments = useEnvironments as unknown as jest.Mock;
const mockFetchAvailableVersions = jest.fn();

describe("UpdateCheckerCard", () => {
  const mockT = (key: string, params?: Record<string, string | number>) => {
    const translations: Record<string, string> = {
      "environments.updates.title": "Update Checker",
      "environments.updates.description": "Check for newer versions",
      "environments.updates.check": "Check for Updates",
      "environments.updates.clickToCheck": "Click to check for updates",
      "environments.updates.checking": "Checking...",
      "environments.updates.upToDate": "Up to date",
      "environments.updates.available": `${params?.count || 0} updates available`,
      "environments.updates.latestStable": "Latest stable",
    };
    return translations[key] || key;
  };

  const defaultEnv = {
    env_type: "node",
    provider: "fnm",
    provider_id: "fnm",
    available: true,
    current_version: "18.0.0",
    installed_versions: [],
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockUseEnvironments.mockReturnValue({
      fetchAvailableVersions: mockFetchAvailableVersions,
    });
  });

  it("renders full card with title and description", () => {
    render(<UpdateCheckerCard env={defaultEnv} t={mockT} />);
    expect(screen.getByText("Update Checker")).toBeInTheDocument();
    expect(screen.getByText("Check for newer versions")).toBeInTheDocument();
  });

  it("renders check button", () => {
    render(<UpdateCheckerCard env={defaultEnv} t={mockT} />);
    expect(screen.getByText("Check for Updates")).toBeInTheDocument();
  });

  it("shows click-to-check message initially", () => {
    render(<UpdateCheckerCard env={defaultEnv} t={mockT} />);
    expect(screen.getByText("Click to check for updates")).toBeInTheDocument();
  });

  it("disables check button when no current version", () => {
    render(
      <UpdateCheckerCard
        env={{ ...defaultEnv, current_version: null }}
        t={mockT}
      />,
    );
    const buttons = screen.getAllByText("Check for Updates");
    const btn = buttons[0].closest("button");
    expect(btn).toBeDisabled();
  });

  it("shows up-to-date when no newer versions found", async () => {
    mockFetchAvailableVersions.mockResolvedValue([
      { version: "18.0.0", deprecated: false, yanked: false },
    ]);
    render(<UpdateCheckerCard env={defaultEnv} t={mockT} />);
    fireEvent.click(screen.getAllByText("Check for Updates")[0]);

    await waitFor(() => {
      expect(screen.getByText("Up to date")).toBeInTheDocument();
    });
  });

  it("shows update available when newer versions exist", async () => {
    mockFetchAvailableVersions.mockResolvedValue([
      { version: "20.0.0", deprecated: false, yanked: false },
      { version: "18.0.0", deprecated: false, yanked: false },
    ]);
    render(<UpdateCheckerCard env={defaultEnv} t={mockT} />);
    fireEvent.click(screen.getAllByText("Check for Updates")[0]);

    await waitFor(() => {
      expect(screen.getByText("1 updates available")).toBeInTheDocument();
    });
  });

  it("handles fetch error gracefully", async () => {
    mockFetchAvailableVersions.mockRejectedValue(new Error("Network error"));
    render(<UpdateCheckerCard env={defaultEnv} t={mockT} />);
    fireEvent.click(screen.getAllByText("Check for Updates")[0]);

    await waitFor(() => {
      // Should show checked state (up to date) even on error
      expect(screen.getByText("Up to date")).toBeInTheDocument();
    });
  });

  // Compact mode tests
  it("renders compact mode with check button", () => {
    render(<UpdateCheckerCard env={defaultEnv} t={mockT} compact />);
    expect(screen.getByText("Check for Updates")).toBeInTheDocument();
    // Should not have the full card structure
    expect(screen.queryByText("Update Checker")).toBeNull();
  });

  it("shows compact up-to-date badge after check", async () => {
    mockFetchAvailableVersions.mockResolvedValue([
      { version: "18.0.0", deprecated: false, yanked: false },
    ]);
    render(<UpdateCheckerCard env={defaultEnv} t={mockT} compact />);
    fireEvent.click(screen.getByText("Check for Updates"));

    await waitFor(() => {
      expect(screen.getByText("Up to date")).toBeInTheDocument();
    });
  });

  it("shows compact update badge when updates available", async () => {
    mockFetchAvailableVersions.mockResolvedValue([
      { version: "20.0.0", deprecated: false, yanked: false },
      { version: "18.0.0", deprecated: false, yanked: false },
    ]);
    render(<UpdateCheckerCard env={defaultEnv} t={mockT} compact />);
    fireEvent.click(screen.getByText("Check for Updates"));

    await waitFor(() => {
      expect(screen.getByText("20.0.0")).toBeInTheDocument();
    });
  });
});
