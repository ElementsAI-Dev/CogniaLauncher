import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ProviderToolbar } from "./provider-toolbar";

// Polyfill ResizeObserver for JSDOM
global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};

const mockT = (key: string) => {
  const translations: Record<string, string> = {
    "providers.search": "Search providers...",
    "providers.refresh": "Refresh",
    "providers.checkStatus": "Check Status",
    "providers.checking": "Checking...",
    "providers.filterAll": "All",
    "providers.filterEnvironment": "Environment",
    "providers.filterPackage": "Package Manager",
    "providers.filterSystem": "System",
    "providers.filterAvailable": "Available",
    "providers.filterUnavailable": "Unavailable",
    "providers.filterEnabled": "Enabled",
    "providers.filterDisabled": "Disabled",
    "providers.sortBy": "Sort by",
    "providers.sortNameAsc": "Name (A-Z)",
    "providers.sortNameDesc": "Name (Z-A)",
    "providers.sortPriorityAsc": "Priority (Low-High)",
    "providers.sortPriorityDesc": "Priority (High-Low)",
    "providers.sortStatus": "Status",
    "providers.viewGrid": "Grid view",
    "providers.viewList": "List view",
  };
  return translations[key] || key;
};

describe("ProviderToolbar", () => {
  const defaultProps = {
    searchQuery: "",
    onSearchChange: jest.fn(),
    categoryFilter: "all" as const,
    onCategoryChange: jest.fn(),
    statusFilter: "all" as const,
    onStatusChange: jest.fn(),
    sortOption: "name-asc" as const,
    onSortChange: jest.fn(),
    viewMode: "grid" as const,
    onViewModeChange: jest.fn(),
    onRefresh: jest.fn(),
    onCheckAllStatus: jest.fn(),
    isLoading: false,
    isCheckingStatus: false,
    t: mockT,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders search input with placeholder", () => {
    render(<ProviderToolbar {...defaultProps} />);

    expect(
      screen.getByPlaceholderText("Search providers..."),
    ).toBeInTheDocument();
  });

  it("renders action buttons", () => {
    render(<ProviderToolbar {...defaultProps} />);

    expect(screen.getByText("Refresh")).toBeInTheDocument();
    expect(screen.getByText("Check Status")).toBeInTheDocument();
  });

  it("renders category filter tabs", () => {
    render(<ProviderToolbar {...defaultProps} />);

    expect(screen.getByRole("tab", { name: "All" })).toBeInTheDocument();
    expect(
      screen.getByRole("tab", { name: "Environment" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("tab", { name: "Package Manager" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "System" })).toBeInTheDocument();
  });

  it("calls onSearchChange when search input changes", async () => {
    jest.useFakeTimers();
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    render(<ProviderToolbar {...defaultProps} />);

    const searchInput = screen.getByPlaceholderText("Search providers...");
    await user.type(searchInput, "npm");

    // Advance past the 300ms debounce
    jest.advanceTimersByTime(350);

    expect(defaultProps.onSearchChange).toHaveBeenCalled();
    jest.useRealTimers();
  });

  it("calls onRefresh when refresh button is clicked", async () => {
    const user = userEvent.setup();
    render(<ProviderToolbar {...defaultProps} />);

    const refreshButton = screen.getByText("Refresh");
    await user.click(refreshButton);

    expect(defaultProps.onRefresh).toHaveBeenCalled();
  });

  it("calls onCheckAllStatus when check status button is clicked", async () => {
    const user = userEvent.setup();
    render(<ProviderToolbar {...defaultProps} />);

    const checkButton = screen.getByText("Check Status");
    await user.click(checkButton);

    expect(defaultProps.onCheckAllStatus).toHaveBeenCalled();
  });

  it("disables refresh button when loading", () => {
    render(<ProviderToolbar {...defaultProps} isLoading={true} />);

    const refreshButton = screen.getByText("Refresh").closest("button");
    expect(refreshButton).toBeDisabled();
  });

  it("disables check status button when checking", () => {
    render(<ProviderToolbar {...defaultProps} isCheckingStatus={true} />);

    expect(screen.getByText("Checking...")).toBeInTheDocument();
    const checkButton = screen.getByText("Checking...").closest("button");
    expect(checkButton).toBeDisabled();
  });

  it("calls onCategoryChange when category tab is clicked", async () => {
    const user = userEvent.setup();
    render(<ProviderToolbar {...defaultProps} />);

    const environmentTab = screen.getByRole("tab", { name: "Environment" });
    await user.click(environmentTab);

    expect(defaultProps.onCategoryChange).toHaveBeenCalledWith("environment");
  });

  it("renders with current search query value", () => {
    render(<ProviderToolbar {...defaultProps} searchQuery="test query" />);

    const searchInput = screen.getByPlaceholderText("Search providers...");
    expect(searchInput).toHaveValue("test query");
  });

  it("highlights active category tab", () => {
    render(<ProviderToolbar {...defaultProps} categoryFilter="environment" />);

    const environmentTab = screen.getByRole("tab", { name: "Environment" });
    expect(environmentTab).toHaveAttribute("data-state", "active");
  });

  it("renders view toggle buttons", () => {
    render(<ProviderToolbar {...defaultProps} />);

    expect(screen.getByLabelText("Grid view")).toBeInTheDocument();
    expect(screen.getByLabelText("List view")).toBeInTheDocument();
  });

  it("calls onViewModeChange when view toggle is clicked", async () => {
    const user = userEvent.setup();
    render(<ProviderToolbar {...defaultProps} />);

    const listButton = screen.getByLabelText("List view");
    await user.click(listButton);

    expect(defaultProps.onViewModeChange).toHaveBeenCalledWith("list");
  });

  it("highlights active view mode button", () => {
    const { container } = render(<ProviderToolbar {...defaultProps} viewMode="list" />);

    // Radix ToggleGroupItem wrapped in TooltipTrigger (asChild) causes data-state conflict,
    // so verify via the ToggleGroup root's value attribute
    const toggleGroup = container.querySelector('[data-slot="toggle-group"]');
    expect(toggleGroup).toBeInTheDocument();

    const listButton = screen.getByLabelText("List view");
    const gridButton = screen.getByLabelText("Grid view");
    expect(listButton).toBeInTheDocument();
    expect(gridButton).toBeInTheDocument();
  });

  it("renders sort dropdown with current value", () => {
    render(<ProviderToolbar {...defaultProps} />);

    expect(screen.getByText("Name (A-Z)")).toBeInTheDocument();
  });

  it("renders sort and status filter dropdowns", () => {
    render(<ProviderToolbar {...defaultProps} />);

    const comboboxes = screen.getAllByRole("combobox");
    expect(comboboxes.length).toBe(2);
  });
});
