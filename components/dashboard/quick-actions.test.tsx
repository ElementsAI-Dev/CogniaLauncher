import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QuickActions, QuickActionsInline } from "./quick-actions";

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
        "dashboard.quickActions.clearCache": "Clear Cache",
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

  it("renders quick actions card with title", () => {
    render(<QuickActions />);

    expect(screen.getByText("Quick Actions")).toBeInTheDocument();
  });

  it("renders primary action buttons", () => {
    render(<QuickActions />);

    expect(
      screen.getByRole("button", { name: /add environment/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /install package/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /refresh all/i }),
    ).toBeInTheDocument();
  });

  it("navigates to environments page when Add Environment is clicked", async () => {
    const user = userEvent.setup();
    render(<QuickActions />);

    await user.click(screen.getByRole("button", { name: /add environment/i }));

    expect(mockPush).toHaveBeenCalledWith("/environments");
  });

  it("navigates to packages page when Install Package is clicked", async () => {
    const user = userEvent.setup();
    render(<QuickActions />);

    await user.click(screen.getByRole("button", { name: /install package/i }));

    expect(mockPush).toHaveBeenCalledWith("/packages");
  });

  it("calls onRefreshAll when Refresh All is clicked", async () => {
    const user = userEvent.setup();
    render(<QuickActions onRefreshAll={mockOnRefreshAll} />);

    await user.click(screen.getByRole("button", { name: /refresh all/i }));

    expect(mockOnRefreshAll).toHaveBeenCalledTimes(1);
  });

  it("disables refresh button when isRefreshing is true", () => {
    render(<QuickActions isRefreshing={true} />);

    const refreshButton = screen.getByRole("button", { name: /refresh all/i });
    expect(refreshButton).toBeDisabled();
  });

  it("shows more actions in dropdown menu", async () => {
    const user = userEvent.setup();
    render(<QuickActions />);

    const moreButton = screen.getByRole("button", { name: /more actions/i });
    await user.click(moreButton);

    expect(screen.getByText("Clear Cache")).toBeInTheDocument();
    expect(screen.getByText("Settings")).toBeInTheDocument();
    expect(screen.getByText("View Logs")).toBeInTheDocument();
  });
});

describe("QuickActionsInline", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders inline action buttons", () => {
    render(<QuickActionsInline />);

    expect(
      screen.getByRole("button", { name: /add environment/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /refresh all/i }),
    ).toBeInTheDocument();
  });

  it("navigates to environments on Add Environment click", async () => {
    const user = userEvent.setup();
    render(<QuickActionsInline />);

    await user.click(screen.getByRole("button", { name: /add environment/i }));

    expect(mockPush).toHaveBeenCalledWith("/environments");
  });

  it("calls onRefreshAll when provided", async () => {
    const user = userEvent.setup();
    render(<QuickActionsInline onRefreshAll={mockOnRefreshAll} />);

    await user.click(screen.getByRole("button", { name: /refresh all/i }));

    expect(mockOnRefreshAll).toHaveBeenCalledTimes(1);
  });

  it("applies custom className", () => {
    const { container } = render(
      <QuickActionsInline className="custom-class" />,
    );

    expect(container.firstChild).toHaveClass("custom-class");
  });
});
