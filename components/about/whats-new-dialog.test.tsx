import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { WhatsNewDialog } from "./whats-new-dialog";
import type { ChangelogEntry } from "@/lib/constants/about";

const mockOpenDialog = jest.fn();

// Mock MarkdownRenderer (react-markdown is ESM-only)
jest.mock("@/components/docs/markdown-renderer", () => ({
  MarkdownRenderer: ({ content }: { content: string }) => (
    <div data-testid="markdown-renderer">{content}</div>
  ),
}));

jest.mock("@/lib/stores/feedback", () => ({
  useFeedbackStore: () => ({
    openDialog: mockOpenDialog,
  }),
}));

jest.mock("@/lib/constants/changelog-utils", () => ({
  getTypeColor: (type: string) => `mock-color-${type}`,
  getTypeLabel: (type: string, t: (k: string) => string) => {
    const map: Record<string, string> = {
      added: t("about.changelogAdded"),
      fixed: t("about.changelogFixed"),
      changed: t("about.changelogChanged"),
    };
    return map[type] || type;
  },
}));

const mockT = (key: string, params?: Record<string, string | number>) => {
  const translations: Record<string, string> = {
    "about.changelogWhatsNew": "What's New",
    "about.changelogWhatsNewDesc": "See what changed in recent versions",
    "about.changelogWhatsNewScope": `Showing ${params?.count ?? 0} newer versions since v${params?.version ?? ""}`,
    "about.changelogWhatsNewEmptyTitle": "Release details unavailable",
    "about.changelogWhatsNewEmptyDesc": "We couldn't load detailed notes for this update yet.",
    "about.changelogPrerelease": "Pre-release",
    "about.changelogViewOnGithub": "View on GitHub",
    "about.changelogShowAll": "Show All",
    "about.changelogGotIt": "Got It",
    "about.changelogReportIssue": "Report issue",
    "about.changelogLocal": "Bundled",
    "about.changelogRemote": "GitHub",
    "about.changelogReleaseNotes": "Release Notes",
    "about.changelogAdded": "Added",
    "about.changelogFixed": "Fixed",
    "about.changelogChanged": "Changed",
    "about.changelogRelativeTime": "1d ago",
  };
  return translations[key] || key;
};

const entries: ChangelogEntry[] = [
  {
    version: "1.1.0",
    date: "2025-02-01",
    source: "local",
    changes: [
      { type: "added", description: "New dashboard widgets" },
      { type: "fixed", description: "Fixed crash on startup" },
    ],
  },
  {
    version: "1.0.0",
    date: "2025-01-15",
    source: "remote",
    prerelease: true,
    url: "https://github.com/test/releases/tag/v1.0.0",
    markdownBody: "## Highlights\nFirst stable release",
    changes: [
      { type: "changed", description: "Updated theme engine" },
    ],
  },
];

const defaultProps = {
  open: true,
  onOpenChange: jest.fn(),
  entries,
  locale: "en",
  previousVersion: "0.9.5",
  onDismiss: jest.fn(),
  onShowFullChangelog: jest.fn(),
  t: mockT,
};

describe("WhatsNewDialog", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns null when open is false", () => {
    const { container } = render(
      <WhatsNewDialog {...defaultProps} open={false} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("keeps the dialog open with an actionable fallback when entries are unavailable", () => {
    render(
      <WhatsNewDialog
        {...defaultProps}
        entries={[]}
        error="Remote changelog unavailable"
      />,
    );

    expect(screen.getByText("What's New")).toBeInTheDocument();
    expect(screen.getByText("Release details unavailable")).toBeInTheDocument();
    expect(
      screen.getByText("We couldn't load detailed notes for this update yet."),
    ).toBeInTheDocument();
    expect(screen.getByText("Show All")).toBeInTheDocument();
  });

  it("renders dialog title when open with entries", () => {
    render(<WhatsNewDialog {...defaultProps} />);
    expect(screen.getByText("What's New")).toBeInTheDocument();
  });

  it("renders dialog description", () => {
    render(<WhatsNewDialog {...defaultProps} />);
    expect(
      screen.getByText("See what changed in recent versions"),
    ).toBeInTheDocument();
  });

  it("renders upgrade scope summary", () => {
    render(<WhatsNewDialog {...defaultProps} />);
    expect(
      screen.getByText("Showing 2 newer versions since v0.9.5"),
    ).toBeInTheDocument();
  });

  it("shows loading skeleton when loading with empty entries", () => {
    render(
      <WhatsNewDialog {...defaultProps} entries={[]} loading={true} />,
    );
    // Dialog should render with title but no version entries
    expect(screen.getByText("What's New")).toBeInTheDocument();
    expect(screen.queryByText("v1.1.0")).not.toBeInTheDocument();
  });

  it("renders version entries with v prefix", () => {
    render(<WhatsNewDialog {...defaultProps} />);
    expect(screen.getByText("v1.1.0")).toBeInTheDocument();
    expect(screen.getByText("v1.0.0")).toBeInTheDocument();
  });

  it("renders dates as time elements", () => {
    render(<WhatsNewDialog {...defaultProps} />);
    const times = screen.getAllByText(/2025-/);
    expect(times.length).toBe(2);
  });

  it("renders pre-release badge for prerelease entries", () => {
    render(<WhatsNewDialog {...defaultProps} />);
    expect(screen.getByText("Pre-release")).toBeInTheDocument();
  });

  it("renders source badges for local and remote entries", () => {
    render(<WhatsNewDialog {...defaultProps} />);
    expect(screen.getByText("Bundled")).toBeInTheDocument();
    expect(screen.getByText("GitHub")).toBeInTheDocument();
  });

  it("renders change descriptions with type badges", () => {
    render(<WhatsNewDialog {...defaultProps} />);
    expect(screen.getByText("New dashboard widgets")).toBeInTheDocument();
    expect(screen.getByText("Fixed crash on startup")).toBeInTheDocument();
    expect(screen.getAllByText("Added").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Fixed").length).toBeGreaterThanOrEqual(1);
  });

  it("renders markdown content for entries with markdownBody", () => {
    render(<WhatsNewDialog {...defaultProps} />);
    expect(screen.getByTestId("markdown-renderer")).toBeInTheDocument();
    expect(
      screen.getByText(/First stable release/),
    ).toBeInTheDocument();
  });

  it("renders View on GitHub link for entries with url", () => {
    render(<WhatsNewDialog {...defaultProps} />);
    const link = screen.getByText("View on GitHub");
    expect(link).toBeInTheDocument();
    expect(link.closest("a")).toHaveAttribute(
      "href",
      "https://github.com/test/releases/tag/v1.0.0",
    );
    expect(link.closest("a")).toHaveAttribute("target", "_blank");
  });

  it("calls onDismiss when Got It button is clicked", async () => {
    render(<WhatsNewDialog {...defaultProps} />);
    await userEvent.click(screen.getByText("Got It"));
    expect(defaultProps.onDismiss).toHaveBeenCalledTimes(1);
  });

  it("calls onShowFullChangelog when Show All button is clicked", async () => {
    render(<WhatsNewDialog {...defaultProps} />);
    await userEvent.click(screen.getByText("Show All"));
    expect(defaultProps.onShowFullChangelog).toHaveBeenCalledTimes(1);
  });

  it("opens feedback dialog with release context for a What's New entry", async () => {
    render(<WhatsNewDialog {...defaultProps} />);

    const reportButtons = screen.getAllByRole("button", { name: "Report issue" });
    await userEvent.click(reportButtons[0]!);

    expect(mockOpenDialog).toHaveBeenCalledWith({
      category: "bug",
      releaseContext: {
        version: "1.1.0",
        date: "2025-02-01",
        source: "local",
        trigger: "whats_new",
        url: undefined,
      },
    });
  });

  it("does not render View on GitHub for entries without url", () => {
    const noUrlEntries: ChangelogEntry[] = [
      {
        version: "2.0.0",
        date: "2025-03-01",
        changes: [{ type: "added", description: "Something" }],
      },
    ];
    render(<WhatsNewDialog {...defaultProps} entries={noUrlEntries} />);
    expect(screen.queryByText("View on GitHub")).not.toBeInTheDocument();
  });
});
