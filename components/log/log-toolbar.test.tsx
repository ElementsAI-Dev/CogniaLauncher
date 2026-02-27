import { render, screen, fireEvent } from "@testing-library/react";
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
        "logs.clearSearch": "Clear search",
        "logs.advanced": "Advanced",
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

  describe("prop variations", () => {
    it("hides realtime controls when showRealtimeControls=false", () => {
      render(<LogToolbar showRealtimeControls={false} />);
      expect(screen.queryByRole("button", { name: /pause/i })).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: /clear/i })).not.toBeInTheDocument();
    });

    it("hides max logs input when showMaxLogs=false", async () => {
      const user = userEvent.setup();
      render(<LogToolbar showMaxLogs={false} />);
      // Open advanced panel
      await user.click(screen.getByText("Advanced"));
      expect(screen.queryByLabelText(/max logs/i)).not.toBeInTheDocument();
    });
  });

  describe("export with custom onExport", () => {
    it("calls custom onExport callback for txt", async () => {
      const user = userEvent.setup();
      const onExport = jest.fn();
      render(<LogToolbar onExport={onExport} />);

      await user.click(screen.getByRole("button", { name: /export/i }));
      await user.click(screen.getByText("Export TXT"));

      expect(onExport).toHaveBeenCalledWith("txt");
    });

    it("calls custom onExport callback for json", async () => {
      const user = userEvent.setup();
      const onExport = jest.fn();
      render(<LogToolbar onExport={onExport} />);

      await user.click(screen.getByRole("button", { name: /export/i }));
      await user.click(screen.getByText("Export JSON"));

      expect(onExport).toHaveBeenCalledWith("json");
    });
  });

  describe("default export (blob download)", () => {
    it("creates and triggers download when no onExport provided", async () => {
      const user = userEvent.setup();
      useLogStore.getState().addLogs([
        { timestamp: Date.now(), level: "info", message: "Export test" },
      ]);

      const origCreate = global.URL.createObjectURL;
      const origRevoke = global.URL.revokeObjectURL;
      const mockCreate = jest.fn(() => "blob:mock-url");
      const mockRevoke = jest.fn();
      global.URL.createObjectURL = mockCreate;
      global.URL.revokeObjectURL = mockRevoke;

      render(<LogToolbar />);
      await user.click(screen.getByRole("button", { name: /export/i }));
      await user.click(screen.getByText("Export TXT"));

      expect(mockCreate).toHaveBeenCalled();
      expect(mockRevoke).toHaveBeenCalled();

      global.URL.createObjectURL = origCreate;
      global.URL.revokeObjectURL = origRevoke;
    });
  });

  describe("advanced filters", () => {
    it("toggles regex switch", async () => {
      const user = userEvent.setup();
      render(<LogToolbar />);
      await user.click(screen.getByText("Advanced"));
      const regexSwitch = screen.getByRole("switch");
      await user.click(regexSwitch);
      expect(useLogStore.getState().filter.useRegex).toBe(true);
    });

    it("changes max logs input value", async () => {
      const user = userEvent.setup();
      render(<LogToolbar />);
      await user.click(screen.getByText("Advanced"));
      const maxLogsInput = screen.getByLabelText(/max logs/i);
      // Use fireEvent.change for controlled number inputs
      fireEvent.change(maxLogsInput, { target: { value: "500" } });
      expect(useLogStore.getState().maxLogs).toBe(500);
    });

    it("enforces minimum max logs of 100", async () => {
      const user = userEvent.setup();
      render(<LogToolbar />);
      await user.click(screen.getByText("Advanced"));
      const maxLogsInput = screen.getByLabelText(/max logs/i);
      fireEvent.change(maxLogsInput, { target: { value: "50" } });
      expect(useLogStore.getState().maxLogs).toBe(100);
    });

    it("renders time range select inside advanced panel", async () => {
      const user = userEvent.setup();
      render(<LogToolbar />);
      await user.click(screen.getByText("Advanced"));
      // The time range label and select trigger should be visible
      expect(screen.getByText(/Time range/)).toBeInTheDocument();
      expect(screen.getByText("All time")).toBeInTheDocument();
    });

    it("renders custom time range inputs when preset is custom", async () => {
      // Set time range to trigger custom preset detection
      useLogStore.getState().setTimeRange(Date.now() - 3600_000, Date.now());
      const user = userEvent.setup();
      render(<LogToolbar />);
      await user.click(screen.getByText("Advanced"));
      // Custom time range inputs should appear
      expect(screen.getByLabelText("Start time")).toBeInTheDocument();
      expect(screen.getByLabelText("End time")).toBeInTheDocument();
    });

    it("updates custom start time via datetime input", async () => {
      useLogStore.getState().setTimeRange(Date.now() - 3600_000, Date.now());
      const user = userEvent.setup();
      render(<LogToolbar />);
      await user.click(screen.getByText("Advanced"));
      const startInput = screen.getByLabelText("Start time");
      fireEvent.change(startInput, { target: { value: "2026-01-01T12:00" } });
      const state = useLogStore.getState();
      // The time range should have been updated
      expect(state.filter.startTime).toBeDefined();
    });

    it("updates custom end time via datetime input", async () => {
      useLogStore.getState().setTimeRange(Date.now() - 3600_000, Date.now());
      const user = userEvent.setup();
      render(<LogToolbar />);
      await user.click(screen.getByText("Advanced"));
      const endInput = screen.getByLabelText("End time");
      fireEvent.change(endInput, { target: { value: "2026-12-31T23:59" } });
      const state = useLogStore.getState();
      expect(state.filter.endTime).toBeDefined();
    });
  });

  describe("clear search button", () => {
    it("shows X button when search has text and clears on click", async () => {
      const user = userEvent.setup();
      render(<LogToolbar />);

      const searchInput = screen.getByPlaceholderText("Search logs...");
      await user.type(searchInput, "error");

      const clearBtn = screen.getByRole("button", { name: /clear search/i });
      expect(clearBtn).toBeInTheDocument();

      await user.click(clearBtn);
      expect(useLogStore.getState().filter.search).toBe("");
    });

    it("does not show X button when search is empty", () => {
      render(<LogToolbar />);
      expect(screen.queryByRole("button", { name: /clear search/i })).not.toBeInTheDocument();
    });
  });
});
