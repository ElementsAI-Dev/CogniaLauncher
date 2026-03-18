import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { EnvironmentList } from "./environment-list";
import type { EnvironmentInfo } from "@/lib/tauri";

// Mock next/navigation
const mockPush = jest.fn();
const mockSetWorkflowContext = jest.fn();
const mockGetLogicalEnvType = jest.fn((envType: string) => `${envType}-logical`);

jest.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}));

jest.mock("@/lib/stores/environment", () => ({
  getLogicalEnvType: (...args: Parameters<typeof mockGetLogicalEnvType>) =>
    mockGetLogicalEnvType(...args),
  useEnvironmentStore: (selector: (state: { setWorkflowContext: typeof mockSetWorkflowContext }) => unknown) =>
    selector({
      setWorkflowContext: mockSetWorkflowContext,
    }),
}));

// Mock locale provider
jest.mock("@/components/providers/locale-provider", () => ({
  useLocale: () => ({
    t: (key: string) => {
      const translations: Record<string, string> = {
        "dashboard.environmentList.title": "Environments",
        "dashboard.environmentList.all": "All",
        "dashboard.environmentList.available": "Available",
        "dashboard.environmentList.unavailable": "Unavailable",
        "dashboard.environmentList.noResults":
          "No environments match the filter",
        "dashboard.environmentList.showMore": "Show more",
        "dashboard.environmentList.showLess": "Show less",
        "dashboard.activeEnvironmentsDesc":
          "Currently available environment managers",
        "dashboard.noEnvironments": "No environments detected",
        "dashboard.packageList.viewAll": "View All",
        "dashboard.quickActions.addEnvironment": "Add Environment",
        "dashboard.widgets.sectionLoading": "Loading data for this widget",
        "dashboard.widgets.sectionNeedsAttention": "This widget needs attention",
        "dashboard.widgets.retry": "Retry",
        "environments.details.versions": "versions",
        "common.none": "None",
      };
      return translations[key] || key;
    },
  }),
}));

const mockEnvironments: EnvironmentInfo[] = [
  {
    env_type: "node",
    provider: "nvm",
    provider_id: "nvm",
    available: true,
    current_version: "20.0.0",
    installed_versions: [
      {
        version: "18.0.0",
        install_path: "/path",
        size: null,
        installed_at: null,
        is_current: false,
      },
      {
        version: "20.0.0",
        install_path: "/path",
        size: null,
        installed_at: null,
        is_current: true,
      },
    ],
    total_size: 0,
    version_count: 2,
  },
  {
    env_type: "python",
    provider: "pyenv",
    provider_id: "pyenv",
    available: false,
    current_version: null,
    installed_versions: [],
    total_size: 0,
    version_count: 0,
  },
  {
    env_type: "rust",
    provider: "rustup",
    provider_id: "rustup",
    available: true,
    current_version: "1.70.0",
    installed_versions: [
      {
        version: "1.70.0",
        install_path: "/path",
        size: null,
        installed_at: null,
        is_current: true,
      },
    ],
    total_size: 0,
    version_count: 1,
  },
];

describe("EnvironmentList", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders environment list title", () => {
    render(<EnvironmentList environments={mockEnvironments} />);

    expect(screen.getByText("Environments")).toBeInTheDocument();
  });

  it("renders environments", () => {
    render(<EnvironmentList environments={mockEnvironments} />);

    expect(screen.getByText("node")).toBeInTheDocument();
    expect(screen.getByText("nvm")).toBeInTheDocument();
  });

  it("shows empty state when no environments", () => {
    render(<EnvironmentList environments={[]} />);

    // Default filter is "available", so empty list shows "no results" message
    expect(screen.getByText("No environments match the filter")).toBeInTheDocument();
  });

  it("shows only available environments by default", () => {
    render(<EnvironmentList environments={mockEnvironments} />);

    // Default filter is "available", so only available environments are shown
    expect(screen.getByText("node")).toBeInTheDocument();
    expect(screen.getByText("rust")).toBeInTheDocument();
    // python is unavailable and should NOT be shown
    expect(screen.queryByText("python")).not.toBeInTheDocument();
  });

  it("navigates to environment details when clicked", () => {
    render(<EnvironmentList environments={mockEnvironments} />);

    const envItem = screen.getByText("node").closest("button");
    if (envItem) {
      fireEvent.click(envItem);
    }

    expect(mockGetLogicalEnvType).toHaveBeenCalledWith("node");
    expect(mockSetWorkflowContext).toHaveBeenCalledWith({
      envType: "node-logical",
      origin: "dashboard",
      returnHref: "/",
      updatedAt: expect.any(Number),
    });
    expect(mockPush).toHaveBeenCalledWith("/environments/node-logical");
  });

  it("shows version badge for current version", () => {
    render(<EnvironmentList environments={mockEnvironments} />);

    expect(screen.getByText("20.0.0")).toBeInTheDocument();
  });

  it("limits displayed environments based on initialLimit", () => {
    // Default filter is "available": node and rust are available (2 items)
    // With initialLimit=1, we should see "Show more"
    render(
      <EnvironmentList environments={mockEnvironments} initialLimit={1} />,
    );

    expect(screen.getByText("Show more")).toBeInTheDocument();
  });

  it("expands list when Show more is clicked", () => {
    render(
      <EnvironmentList environments={mockEnvironments} initialLimit={1} />,
    );

    const showMoreButton = screen.getByText("Show more");
    fireEvent.click(showMoreButton);

    // Should now show "Show less"
    expect(screen.getByText("Show less")).toBeInTheDocument();
  });

  it("shows all environments and unavailable details when filter switches to unavailable", async () => {
    const user = userEvent.setup();
    render(<EnvironmentList environments={mockEnvironments} />);

    await user.click(screen.getByRole("combobox"));
    await user.click(screen.getByRole("option", { name: "Unavailable" }));

    expect(screen.getByText("python")).toBeInTheDocument();
    expect(screen.queryByText("node")).not.toBeInTheDocument();
    expect(screen.getByText("None")).toBeInTheDocument();
    expect(screen.queryByText(/0 versions/i)).not.toBeInTheDocument();
  });

  it("shows no environments empty state when all filter is selected with an empty list", async () => {
    const user = userEvent.setup();
    render(<EnvironmentList environments={[]} />);

    await user.click(screen.getByRole("combobox"));
    await user.click(screen.getByRole("option", { name: "All" }));

    expect(screen.getByText("No environments detected")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /add environment/i }));
    expect(mockPush).toHaveBeenCalledWith("/environments");
  });

  it("reveals extra items after expanding the list", async () => {
    const user = userEvent.setup();
    const environments = [
      ...mockEnvironments,
      {
        env_type: "go",
        provider: "gvm",
        provider_id: "gvm",
        available: true,
        current_version: "1.22.0",
        installed_versions: [
          {
            version: "1.22.0",
            install_path: "/path",
            size: null,
            installed_at: null,
            is_current: true,
          },
        ],
        total_size: 0,
        version_count: 1,
      },
    ] satisfies EnvironmentInfo[];

    render(<EnvironmentList environments={environments} initialLimit={1} />);

    expect(screen.queryByText("go")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /show more/i }));

    expect(screen.getByText("go")).toBeInTheDocument();
  });

  it("navigates to environments page when View All is clicked", () => {
    render(<EnvironmentList environments={mockEnvironments} />);

    const viewAllButton = screen.getByText("View All");
    fireEvent.click(viewAllButton);

    expect(mockPush).toHaveBeenCalledWith("/environments");
  });

  it("shows local loading state when data is pending", () => {
    render(<EnvironmentList environments={[]} isLoading={true} />);

    expect(screen.getByText("Loading data for this widget")).toBeInTheDocument();
  });

  it("shows recovery action when the widget has an error", () => {
    const onRecover = jest.fn();
    render(<EnvironmentList environments={[]} error="Environment load failed" onRecover={onRecover} />);

    fireEvent.click(screen.getByText("Retry"));
    expect(onRecover).toHaveBeenCalledTimes(1);
  });
});
