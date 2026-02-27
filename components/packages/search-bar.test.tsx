import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SearchBar } from "./search-bar";

jest.mock("@/components/providers/locale-provider", () => ({
  useLocale: () => ({
    t: (key: string) => {
      const translations: Record<string, string> = {
        "packages.searchPlaceholder": "Search packages...",
        "packages.loadingSuggestions": "Loading...",
        "packages.suggestions": "Suggestions",
        "packages.recentSearches": "Recent Searches",
        "packages.providers": "Providers",
        "packages.filterByProvider": "Filter by Provider",
        "packages.filters": "Filters",
        "packages.installedOnly": "Installed Only",
        "packages.notInstalledFilter": "Not Installed",
        "packages.hasUpdatesFilter": "Has Updates",
        "packages.sortRelevance": "Relevance",
        "packages.sortName": "Name",
        "packages.sortProvider": "Provider",
        "packages.activeFilters": "Active filters",
        "packages.clearAllFilters": "Clear all",
        "common.clear": "Clear",
      };
      return translations[key] || key;
    },
  }),
}));

jest.mock("@/hooks/use-mobile", () => ({
  useDebounce: (value: string) => value,
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
    enabled: true,
  },
];

const defaultProps = {
  providers: mockProviders,
  onSearch: jest.fn(),
  onGetSuggestions: jest.fn().mockResolvedValue([]),
  loading: false,
};

describe("SearchBar", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
  });

  it("renders search input", () => {
    render(<SearchBar {...defaultProps} />);
    expect(
      screen.getByPlaceholderText("Search packages..."),
    ).toBeInTheDocument();
  });

  it("calls onSearch when Enter is pressed", async () => {
    const user = userEvent.setup();
    render(<SearchBar {...defaultProps} />);

    const input = screen.getByPlaceholderText("Search packages...");
    await user.type(input, "numpy{Enter}");

    expect(defaultProps.onSearch).toHaveBeenCalledWith(
      "numpy",
      expect.any(Object),
    );
  });

  it("shows clear button when input has value", async () => {
    const user = userEvent.setup();
    render(<SearchBar {...defaultProps} />);

    const input = screen.getByPlaceholderText("Search packages...");
    await user.type(input, "test");

    expect(screen.getByLabelText("Clear")).toBeInTheDocument();
  });

  it("clears input when clear button is clicked", async () => {
    const user = userEvent.setup();
    render(<SearchBar {...defaultProps} />);

    const input = screen.getByPlaceholderText("Search packages...");
    await user.type(input, "test");
    await user.click(screen.getByLabelText("Clear"));

    expect(input).toHaveValue("");
  });

  it("shows provider filter dropdown", async () => {
    const user = userEvent.setup();
    render(<SearchBar {...defaultProps} />);

    await user.click(screen.getByText("Providers"));

    expect(screen.getByText("pip")).toBeInTheDocument();
    expect(screen.getByText("Conda")).toBeInTheDocument();
  });

  it("shows suggestions when typing", async () => {
    const mockSuggestions = [
      { text: "numpy", suggestion_type: "package", provider: "pip" },
    ];
    const props = {
      ...defaultProps,
      onGetSuggestions: jest.fn().mockResolvedValue(mockSuggestions),
    };

    const user = userEvent.setup();
    render(<SearchBar {...props} />);

    const input = screen.getByPlaceholderText("Search packages...");
    await user.type(input, "nu");

    await waitFor(() => {
      expect(screen.getByText("numpy")).toBeInTheDocument();
    });
  });

  it("saves search to history", async () => {
    const user = userEvent.setup();
    render(<SearchBar {...defaultProps} />);

    const input = screen.getByPlaceholderText("Search packages...");
    await user.type(input, "pandas{Enter}");

    expect(localStorage.getItem("cognia-search-history")).toContain("pandas");
  });

  it("disables search button when query is empty", () => {
    render(<SearchBar {...defaultProps} />);
    const buttons = screen.getAllByRole("button");
    // The last button is the search button
    const searchButton = buttons[buttons.length - 1];
    expect(searchButton).toBeDisabled();
  });

  it("disables search button when loading", async () => {
    const user = userEvent.setup();
    render(<SearchBar {...defaultProps} loading={true} />);
    const input = screen.getByPlaceholderText("Search packages...");
    await user.type(input, "test");
    // Search button should be disabled while loading
  });

  it("closes dropdown on Escape", async () => {
    const user = userEvent.setup();
    render(<SearchBar {...defaultProps} />);
    const input = screen.getByPlaceholderText("Search packages...");
    await user.click(input); // Focus to open dropdown
    await user.keyboard("{Escape}");
  });

  it("handles suggestion click", async () => {
    const mockSuggestions = [
      { text: "numpy", suggestion_type: "package", provider: "pip" },
    ];
    const props = {
      ...defaultProps,
      onGetSuggestions: jest.fn().mockResolvedValue(mockSuggestions),
    };
    const user = userEvent.setup();
    render(<SearchBar {...props} />);
    const input = screen.getByPlaceholderText("Search packages...");
    await user.type(input, "nu");
    await waitFor(() => {
      expect(screen.getByText("numpy")).toBeInTheDocument();
    });
    await user.click(screen.getByText("numpy"));
    expect(props.onSearch).toHaveBeenCalled();
  });

  it("loads history from localStorage", async () => {
    localStorage.setItem("cognia-search-history", JSON.stringify(["react", "vue"]));
    const user = userEvent.setup();
    render(<SearchBar {...defaultProps} />);
    const input = screen.getByPlaceholderText("Search packages...");
    await user.click(input);
    await waitFor(() => {
      expect(screen.getByText("react")).toBeInTheDocument();
      expect(screen.getByText("vue")).toBeInTheDocument();
    });
  });

  it("clicks history item to search", async () => {
    localStorage.setItem("cognia-search-history", JSON.stringify(["flask"]));
    const user = userEvent.setup();
    render(<SearchBar {...defaultProps} />);
    const input = screen.getByPlaceholderText("Search packages...");
    await user.click(input);
    await waitFor(() => {
      expect(screen.getByText("flask")).toBeInTheDocument();
    });
    await user.click(screen.getByText("flask"));
    expect(defaultProps.onSearch).toHaveBeenCalledWith("flask", expect.any(Object));
  });

  it("clears search history", async () => {
    localStorage.setItem("cognia-search-history", JSON.stringify(["flask"]));
    const user = userEvent.setup();
    render(<SearchBar {...defaultProps} />);
    const input = screen.getByPlaceholderText("Search packages...");
    await user.click(input);
    await waitFor(() => {
      expect(screen.getByText("Clear")).toBeInTheDocument();
    });
    // The "Clear" link in the history section
    const clearLinks = screen.getAllByText("Clear");
    await user.click(clearLinks[clearLinks.length - 1]);
    expect(localStorage.getItem("cognia-search-history")).toBeNull();
  });
});
