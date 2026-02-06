import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LogToolbar } from "./log-toolbar";
import { useLogStore } from "@/lib/stores/log";

// Mock locale provider
jest.mock("@/components/providers/locale-provider", () => ({
  useLocale: () => ({
    t: (key: string) => {
      const translations: Record<string, string> = {
        "logs.searchPlaceholder": "Search logs...",
        "logs.filter": "Filter",
        "logs.logLevels": "Log Levels",
        "logs.pause": "Pause",
        "logs.resume": "Resume",
        "logs.autoScrollOn": "Auto-scroll enabled",
        "logs.autoScrollOff": "Auto-scroll disabled",
        "logs.export": "Export logs",
        "logs.exportTxt": "Export TXT",
        "logs.exportJson": "Export JSON",
        "logs.timeRange": "Time range",
        "logs.timeRangeAll": "All time",
        "logs.timeRangeLastHour": "Last hour",
        "logs.timeRangeLast24Hours": "Last 24 hours",
        "logs.timeRangeLast7Days": "Last 7 days",
        "logs.timeRangeCustom": "Custom range",
        "logs.timeRangeStart": "Start time",
        "logs.timeRangeEnd": "End time",
        "logs.timeRangeTo": "to",
        "logs.regex": "Regex",
        "logs.maxLogs": "Max logs",
        "logs.clear": "Clear logs",
        "logs.total": "Total",
        "logs.paused": "Paused",
        "logs.entries": "entries",
      };
      return translations[key] || key;
    },
  }),
}));

describe("LogToolbar", () => {
  beforeEach(() => {
    // Reset store state
    useLogStore.setState({
      logs: [],
      maxLogs: 1000,
      filter: {
        levels: ["info", "warn", "error"],
        search: "",
        useRegex: false,
        startTime: null,
        endTime: null,
      },
      autoScroll: true,
      paused: false,
      drawerOpen: false,
      logFiles: [],
      selectedLogFile: null,
    });
  });

  it("renders search input", () => {
    render(<LogToolbar />);
    expect(screen.getByPlaceholderText("Search logs...")).toBeInTheDocument();
  });

  it("renders filter button", () => {
    render(<LogToolbar />);
    expect(screen.getByRole("button", { name: /filter/i })).toBeInTheDocument();
  });

  it("renders pause button", () => {
    render(<LogToolbar />);
    expect(screen.getByRole("button", { name: /pause/i })).toBeInTheDocument();
  });

  it("renders export button", () => {
    render(<LogToolbar />);
    expect(screen.getByRole("button", { name: /export/i })).toBeInTheDocument();
  });

  it("shows export format menu", async () => {
    const user = userEvent.setup();
    render(<LogToolbar />);

    const exportButton = screen.getByRole("button", { name: /export/i });
    await user.click(exportButton);

    expect(screen.getByText("Export TXT")).toBeInTheDocument();
    expect(screen.getByText("Export JSON")).toBeInTheDocument();
  });

  it("renders clear button", () => {
    render(<LogToolbar />);
    expect(screen.getByRole("button", { name: /clear/i })).toBeInTheDocument();
  });

  describe("search functionality", () => {
    it("updates search filter on input", async () => {
      const user = userEvent.setup();
      render(<LogToolbar />);

      const searchInput = screen.getByPlaceholderText("Search logs...");
      await user.type(searchInput, "error");

      expect(useLogStore.getState().filter.search).toBe("error");
    });

    it("clears search when input is cleared", async () => {
      const user = userEvent.setup();
      useLogStore.setState({
        ...useLogStore.getState(),
        filter: { ...useLogStore.getState().filter, search: "test" },
      });

      render(<LogToolbar />);
      const searchInput = screen.getByPlaceholderText("Search logs...");
      await user.clear(searchInput);

      expect(useLogStore.getState().filter.search).toBe("");
    });
  });

  describe("pause/resume functionality", () => {
    it("toggles pause state when clicked", async () => {
      const user = userEvent.setup();
      render(<LogToolbar />);

      expect(useLogStore.getState().paused).toBe(false);

      const pauseButton = screen.getByRole("button", { name: /pause/i });
      await user.click(pauseButton);

      expect(useLogStore.getState().paused).toBe(true);
    });

    it("shows resume button when paused", async () => {
      const user = userEvent.setup();
      render(<LogToolbar />);

      const pauseButton = screen.getByRole("button", { name: /pause/i });
      await user.click(pauseButton);

      expect(
        screen.getByRole("button", { name: /resume/i }),
      ).toBeInTheDocument();
    });
  });

  describe("auto-scroll functionality", () => {
    it("toggles auto-scroll when clicked", async () => {
      const user = userEvent.setup();
      render(<LogToolbar />);

      expect(useLogStore.getState().autoScroll).toBe(true);

      const autoScrollButton = screen.getByRole("button", {
        name: /auto-scroll/i,
      });
      await user.click(autoScrollButton);

      expect(useLogStore.getState().autoScroll).toBe(false);
    });
  });

  describe("clear functionality", () => {
    it("clears logs when clear button is clicked", async () => {
      const user = userEvent.setup();

      // Add some logs first
      useLogStore.getState().addLogs([
        { timestamp: Date.now(), level: "info", message: "Test 1" },
        { timestamp: Date.now(), level: "info", message: "Test 2" },
      ]);
      expect(useLogStore.getState().logs.length).toBe(2);

      render(<LogToolbar />);

      const clearButton = screen.getByRole("button", { name: /clear/i });
      await user.click(clearButton);

      expect(useLogStore.getState().logs.length).toBe(0);
    });
  });

  describe("stats display", () => {
    it("displays total log count", () => {
      useLogStore.getState().addLogs([
        { timestamp: Date.now(), level: "info", message: "Test 1" },
        { timestamp: Date.now(), level: "error", message: "Test 2" },
      ]);

      render(<LogToolbar />);
      expect(screen.getByText(/2/)).toBeInTheDocument();
    });

    it("displays paused indicator when paused", async () => {
      const user = userEvent.setup();
      render(<LogToolbar />);

      const pauseButton = screen.getByRole("button", { name: /pause/i });
      await user.click(pauseButton);

      // Check that paused state is indicated (may be via button label change or text)
      expect(
        screen.getByRole("button", { name: /resume/i }),
      ).toBeInTheDocument();
    });
  });
});
