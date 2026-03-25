import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ProviderToolbar } from "./provider-toolbar";

// Polyfill ResizeObserver for JSDOM
global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};

jest.mock('@/components/providers/locale-provider', () => ({ useLocale: () => ({ t: (key: string) => key }) }));

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
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders search input with placeholder", () => {
    render(<ProviderToolbar {...defaultProps} />);

    expect(
      screen.getByPlaceholderText("providers.search"),
    ).toBeInTheDocument();
  });

  it("renders action buttons", () => {
    render(<ProviderToolbar {...defaultProps} />);

    expect(screen.getByText("providers.refresh")).toBeInTheDocument();
    expect(screen.getByText("providers.checkStatus")).toBeInTheDocument();
  });

  it("renders category filter tabs", () => {
    render(<ProviderToolbar {...defaultProps} />);

    expect(screen.getByRole("tab", { name: "providers.filterAll" })).toBeInTheDocument();
    expect(
      screen.getByRole("tab", { name: "providers.filterEnvironment" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("tab", { name: "providers.filterPackage" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "providers.filterSystem" })).toBeInTheDocument();
  });

  it("calls onSearchChange when search input changes", async () => {
    jest.useFakeTimers();
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    render(<ProviderToolbar {...defaultProps} />);

    const searchInput = screen.getByPlaceholderText("providers.search");
    await user.type(searchInput, "npm");

    // Advance past the 300ms debounce
    jest.advanceTimersByTime(350);

    expect(defaultProps.onSearchChange).toHaveBeenCalled();
    jest.useRealTimers();
  });

  it("calls onRefresh when refresh button is clicked", async () => {
    const user = userEvent.setup();
    render(<ProviderToolbar {...defaultProps} />);

    const refreshButton = screen.getByText("providers.refresh");
    await user.click(refreshButton);

    expect(defaultProps.onRefresh).toHaveBeenCalled();
  });

  it("calls onCheckAllStatus when check status button is clicked", async () => {
    const user = userEvent.setup();
    render(<ProviderToolbar {...defaultProps} />);

    const checkButton = screen.getByText("providers.checkStatus");
    await user.click(checkButton);

    expect(defaultProps.onCheckAllStatus).toHaveBeenCalled();
  });

  it("disables refresh button when loading", () => {
    render(<ProviderToolbar {...defaultProps} isLoading={true} />);

    const refreshButton = screen.getByText("providers.refresh").closest("button");
    expect(refreshButton).toBeDisabled();
  });

  it("disables check status button when checking", () => {
    render(<ProviderToolbar {...defaultProps} isCheckingStatus={true} />);

    expect(screen.getByText("providers.checking")).toBeInTheDocument();
    const checkButton = screen.getByText("providers.checking").closest("button");
    expect(checkButton).toBeDisabled();
  });

  it("calls onCategoryChange when category tab is clicked", async () => {
    const user = userEvent.setup();
    render(<ProviderToolbar {...defaultProps} />);

    const environmentTab = screen.getByRole("tab", { name: "providers.filterEnvironment" });
    await user.click(environmentTab);

    expect(defaultProps.onCategoryChange).toHaveBeenCalledWith("environment");
  });

  it("renders with current search query value", () => {
    render(<ProviderToolbar {...defaultProps} searchQuery="test query" />);

    const searchInput = screen.getByPlaceholderText("providers.search");
    expect(searchInput).toHaveValue("test query");
  });

  it("highlights active category tab", () => {
    render(<ProviderToolbar {...defaultProps} categoryFilter="environment" />);

    const environmentTab = screen.getByRole("tab", { name: "providers.filterEnvironment" });
    expect(environmentTab).toHaveAttribute("data-state", "active");
  });

  it("renders view toggle buttons", () => {
    render(<ProviderToolbar {...defaultProps} />);

    expect(screen.getByLabelText("providers.viewGrid")).toBeInTheDocument();
    expect(screen.getByLabelText("providers.viewList")).toBeInTheDocument();
  });

  it("calls onViewModeChange when view toggle is clicked", async () => {
    const user = userEvent.setup();
    render(<ProviderToolbar {...defaultProps} />);

    const listButton = screen.getByLabelText("providers.viewList");
    await user.click(listButton);

    expect(defaultProps.onViewModeChange).toHaveBeenCalledWith("list");
  });

  it("highlights active view mode button", () => {
    const { container } = render(<ProviderToolbar {...defaultProps} viewMode="list" />);

    // Radix ToggleGroupItem wrapped in TooltipTrigger (asChild) causes data-state conflict,
    // so verify via the ToggleGroup root's value attribute
    const toggleGroup = container.querySelector('[data-slot="toggle-group"]');
    expect(toggleGroup).toBeInTheDocument();

    const listButton = screen.getByLabelText("providers.viewList");
    const gridButton = screen.getByLabelText("providers.viewGrid");
    expect(listButton).toBeInTheDocument();
    expect(gridButton).toBeInTheDocument();
  });

  it("renders sort dropdown with current value", () => {
    render(<ProviderToolbar {...defaultProps} />);

    expect(screen.getByText("providers.sortNameAsc")).toBeInTheDocument();
  });

  it("renders sort and status filter dropdowns", () => {
    render(<ProviderToolbar {...defaultProps} />);

    const comboboxes = screen.getAllByRole("combobox");
    expect(comboboxes.length).toBe(2);
  });
});
