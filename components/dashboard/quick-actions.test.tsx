import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QuickActions } from "./quick-actions";

const mockPush = jest.fn();
const mockOnRefreshAll = jest.fn();

jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

jest.mock("@/components/providers/locale-provider", () => ({
  useLocale: () => ({
    t: (key: string) => {
      const translations: Record<string, string> = {
        "dashboard.quickActions.title": "Quick Actions",
        "dashboard.quickActions.addEnvironment": "Add Environment",
        "dashboard.quickActions.installPackage": "Install Package",
        "dashboard.quickActions.refreshAll": "Refresh All",
        "dashboard.quickActions.manageCache": "Manage Cache",
        "dashboard.quickActions.openSettings": "Settings",
        "dashboard.quickActions.viewLogs": "View Logs",
        "dashboard.quickActions.moreActions": "More Actions",
      };
      return translations[key] || key;
    },
  }),
}));

describe("QuickActions", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders inline action buttons", () => {
    render(<QuickActions />);

    expect(
      screen.getByRole("button", { name: /add environment/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /refresh all/i }),
    ).toBeInTheDocument();
  });

  it("navigates to environments on Add Environment click", async () => {
    const user = userEvent.setup();
    render(<QuickActions />);

    await user.click(screen.getByRole("button", { name: /add environment/i }));

    expect(mockPush).toHaveBeenCalledWith("/environments");
  });

  it("calls onRefreshAll when provided", async () => {
    const user = userEvent.setup();
    render(<QuickActions onRefreshAll={mockOnRefreshAll} />);

    await user.click(screen.getByRole("button", { name: /refresh all/i }));

    expect(mockOnRefreshAll).toHaveBeenCalledTimes(1);
  });

  it("applies custom className", () => {
    const { container } = render(
      <QuickActions className="custom-class" />,
    );

    expect(container.firstChild).toHaveClass("custom-class");
  });

  it("navigates to packages on Install Package click", async () => {
    const user = userEvent.setup();
    render(<QuickActions />);

    await user.click(screen.getByRole("button", { name: /install package/i }));

    expect(mockPush).toHaveBeenCalledWith("/packages");
  });

  it("disables refresh button when isRefreshing is true", () => {
    render(<QuickActions isRefreshing={true} />);

    const refreshButton = screen.getByRole("button", { name: /refresh all/i });
    expect(refreshButton).toBeDisabled();
  });

  it("shows dropdown secondary actions", async () => {
    const user = userEvent.setup();
    render(<QuickActions />);

    const moreButton = screen.getByRole("button", { name: /more actions/i });
    await user.click(moreButton);

    expect(screen.getByText("Manage Cache")).toBeInTheDocument();
    expect(screen.getByText("Settings")).toBeInTheDocument();
    expect(screen.getByText("View Logs")).toBeInTheDocument();
  });

  it("navigates to cache page from secondary actions", async () => {
    const user = userEvent.setup();
    render(<QuickActions />);

    const moreButton = screen.getByRole("button", { name: /more actions/i });
    await user.click(moreButton);
    await user.click(screen.getByText("Manage Cache"));

    expect(mockPush).toHaveBeenCalledWith("/cache");
  });

  it("navigates to settings from secondary actions", async () => {
    const user = userEvent.setup();
    render(<QuickActions />);

    await user.click(screen.getByRole("button", { name: /more actions/i }));
    await user.click(screen.getByText("Settings"));

    expect(mockPush).toHaveBeenCalledWith("/settings");
  });

  it("navigates to logs from secondary actions", async () => {
    const user = userEvent.setup();
    render(<QuickActions />);

    await user.click(screen.getByRole("button", { name: /more actions/i }));
    await user.click(screen.getByText("View Logs"));

    expect(mockPush).toHaveBeenCalledWith("/logs");
  });

  it("shows a spinning refresh icon while refresh is in progress", () => {
    render(<QuickActions isRefreshing={true} />);

    const refreshButton = screen.getByRole("button", { name: /refresh all/i });
    const refreshIcon = refreshButton.querySelector("svg");

    expect(refreshIcon).toHaveClass("animate-spin");
  });
});
