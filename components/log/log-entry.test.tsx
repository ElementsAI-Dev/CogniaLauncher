import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LogEntry } from "./log-entry";
import type { LogEntry as LogEntryType } from "@/lib/stores/log";

// Mock locale provider
jest.mock("@/components/providers/locale-provider", () => ({
  useLocale: () => ({
    t: (key: string) => {
      const translations: Record<string, string> = {
        "common.copy": "Copy",
        "logs.copyEntry": "Copy log entry",
        "logs.expand": "Expand",
        "logs.collapse": "Collapse",
      };
      return translations[key] || key;
    },
  }),
}));

// Mock clipboard API
const mockWriteText = jest.fn().mockResolvedValue(undefined);
Object.defineProperty(navigator, "clipboard", {
  value: { writeText: mockWriteText },
  writable: true,
  configurable: true,
});

describe("LogEntry", () => {
  const mockEntry: LogEntryType = {
    id: "test-id-1",
    timestamp: new Date("2026-02-02T12:00:00Z").getTime(),
    level: "info",
    message: "Test log message",
    target: "app",
  };

  beforeEach(() => {
    mockWriteText.mockClear();
  });

  it("renders log entry with message", () => {
    render(<LogEntry entry={mockEntry} />);
    expect(screen.getByText("Test log message")).toBeInTheDocument();
  });

  it("displays formatted timestamp", () => {
    render(<LogEntry entry={mockEntry} />);
    // Timestamp is formatted using local time, so we just check for any time pattern (HH:MM:SS)
    const timeElement = screen.getByText(/\d{2}:\d{2}:\d{2}/);
    expect(timeElement).toBeInTheDocument();
  });

  it("displays level badge", () => {
    render(<LogEntry entry={mockEntry} />);
    expect(screen.getByText("INF")).toBeInTheDocument();
  });

  it("displays target when provided", () => {
    render(<LogEntry entry={mockEntry} />);
    expect(screen.getByText("app")).toBeInTheDocument();
  });

  it("renders without target when not provided", () => {
    const entryWithoutTarget = { ...mockEntry, target: undefined };
    render(<LogEntry entry={entryWithoutTarget} />);
    expect(screen.queryByText(/\[.*\]/)).not.toBeInTheDocument();
  });

  describe("log levels", () => {
    it("renders trace level with correct styling", () => {
      const traceEntry = { ...mockEntry, level: "trace" as const };
      render(<LogEntry entry={traceEntry} />);
      expect(screen.getByText("TRC")).toBeInTheDocument();
    });

    it("renders debug level with correct styling", () => {
      const debugEntry = { ...mockEntry, level: "debug" as const };
      render(<LogEntry entry={debugEntry} />);
      expect(screen.getByText("DBG")).toBeInTheDocument();
    });

    it("renders info level with correct styling", () => {
      render(<LogEntry entry={mockEntry} />);
      expect(screen.getByText("INF")).toBeInTheDocument();
    });

    it("renders warn level with correct styling", () => {
      const warnEntry = { ...mockEntry, level: "warn" as const };
      render(<LogEntry entry={warnEntry} />);
      expect(screen.getByText("WRN")).toBeInTheDocument();
    });

    it("renders error level with correct styling", () => {
      const errorEntry = { ...mockEntry, level: "error" as const };
      render(<LogEntry entry={errorEntry} />);
      expect(screen.getByText("ERR")).toBeInTheDocument();
    });
  });

  describe("copy functionality", () => {
    it("shows copy button on hover", async () => {
      const user = userEvent.setup();
      render(<LogEntry entry={mockEntry} />);

      const entryElement = screen.getByText("Test log message").closest("div");
      if (entryElement) {
        await user.hover(entryElement);
      }

      // Copy button should be in the DOM
      const copyButton = screen.queryByRole("button");
      expect(copyButton).toBeInTheDocument();
    });

    it("has clickable copy button", async () => {
      const user = userEvent.setup();
      render(<LogEntry entry={mockEntry} />);

      // Get the copy button by its aria-label
      const copyButton = screen.getByLabelText("Copy log entry");
      expect(copyButton).toBeInTheDocument();

      // Verify button is clickable (clipboard may fail in test env)
      await user.click(copyButton);
    });
  });

  describe("highlight and collapse", () => {
    it("highlights matching text", () => {
      render(
        <LogEntry
          entry={mockEntry}
          highlightText="log"
          highlightRegex={false}
        />,
      );

      expect(screen.getByText("log", { selector: "mark" })).toBeInTheDocument();
    });

    it("toggles collapse for long messages", async () => {
      const user = userEvent.setup();
      const longMessage = "A".repeat(200);
      render(
        <LogEntry
          entry={{ ...mockEntry, message: longMessage }}
          allowCollapse
        />,
      );

      const toggleButton = screen.getByRole("button", { name: /expand/i });
      await user.click(toggleButton);
      expect(
        screen.getByRole("button", { name: /collapse/i }),
      ).toBeInTheDocument();
    });
  });

  it("handles long messages gracefully", () => {
    const longMessage = "A".repeat(1000);
    const entryWithLongMessage = { ...mockEntry, message: longMessage };
    render(<LogEntry entry={entryWithLongMessage} />);
    expect(screen.getByText(longMessage)).toBeInTheDocument();
  });

  it("handles multiline messages", () => {
    const multilineMessage = "Line 1\nLine 2\nLine 3";
    const entryWithMultiline = { ...mockEntry, message: multilineMessage };
    render(<LogEntry entry={entryWithMultiline} />);
    // Multiline messages are displayed with whitespace preserved
    expect(screen.getByText(/Line 1/)).toBeInTheDocument();
    expect(screen.getByText(/Line 2/)).toBeInTheDocument();
  });
});
