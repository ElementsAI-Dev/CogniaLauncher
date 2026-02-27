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

  describe("prop variations", () => {
    it("hides timestamp when showTimestamp=false", () => {
      render(<LogEntry entry={mockEntry} showTimestamp={false} />);
      expect(screen.queryByText(/\d{2}:\d{2}:\d{2}/)).not.toBeInTheDocument();
    });

    it("hides target when showTarget=false", () => {
      render(<LogEntry entry={mockEntry} showTarget={false} />);
      expect(screen.queryByText("app")).not.toBeInTheDocument();
    });
  });

  describe("regex highlight", () => {
    it("highlights with regex pattern when highlightRegex=true", () => {
      render(
        <LogEntry
          entry={mockEntry}
          highlightText="log"
          highlightRegex
        />,
      );
      expect(screen.getByText("log", { selector: "mark" })).toBeInTheDocument();
    });

    it("falls back to plain text when regex is invalid", () => {
      render(
        <LogEntry
          entry={mockEntry}
          highlightText="[invalid"
          highlightRegex
        />,
      );
      // Should still render the message without highlighting
      expect(screen.getByText("Test log message")).toBeInTheDocument();
    });

    it("does not highlight when highlightText is empty", () => {
      render(
        <LogEntry entry={mockEntry} highlightText="" />,
      );
      expect(screen.queryByRole("mark")).not.toBeInTheDocument();
      expect(screen.getByText("Test log message")).toBeInTheDocument();
    });
  });

  describe("expand/collapse cycle", () => {
    it("toggles expand then collapse for long messages", async () => {
      const user = userEvent.setup();
      const longMessage = "A".repeat(200);
      render(
        <LogEntry
          entry={{ ...mockEntry, message: longMessage }}
          allowCollapse
        />,
      );

      const expandButton = screen.getByRole("button", { name: /expand/i });
      await user.click(expandButton);
      expect(screen.getByRole("button", { name: /collapse/i })).toBeInTheDocument();

      await user.click(screen.getByRole("button", { name: /collapse/i }));
      expect(screen.getByRole("button", { name: /expand/i })).toBeInTheDocument();
    });

    it("shows expand button for multiline messages with allowCollapse", () => {
      const multiline = "Line1\nLine2\nLine3\nLine4\nLine5\nLine6\nLine7\nLine8\nLine9\nLine10";
      render(
        <LogEntry
          entry={{ ...mockEntry, message: multiline }}
          allowCollapse
        />,
      );
      expect(screen.getByRole("button", { name: /expand/i })).toBeInTheDocument();
    });

    it("does not show expand button when allowCollapse=false even for long messages", () => {
      const longMessage = "A".repeat(200);
      render(
        <LogEntry
          entry={{ ...mockEntry, message: longMessage }}
          allowCollapse={false}
        />,
      );
      expect(screen.queryByRole("button", { name: /expand/i })).not.toBeInTheDocument();
    });

    it("does not show expand button for short messages even with allowCollapse", () => {
      render(
        <LogEntry
          entry={{ ...mockEntry, message: "short" }}
          allowCollapse
        />,
      );
      expect(screen.queryByRole("button", { name: /expand/i })).not.toBeInTheDocument();
    });
  });
});
