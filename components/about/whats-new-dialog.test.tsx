import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { WhatsNewDialog } from "./whats-new-dialog";
import type { ChangelogEntry } from "@/lib/constants/about";

// Mock MarkdownRenderer (react-markdown is ESM-only)
jest.mock("@/components/docs/markdown-renderer", () => ({
  MarkdownRenderer: ({ content }: { content: string }) => (
    <div data-testid="markdown-renderer">{content}</div>
  ),
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

const mockT = (key: string) => {
  const translations: Record<string, string> = {
    "about.changelogWhatsNew": "What's New",
    "about.changelogWhatsNewDesc": "See what changed in recent versions",
    "about.changelogPrerelease": "Pre-release",
    "about.changelogViewOnGithub": "View on GitHub",
    "about.changelogShowAll": "Show All",
    "about.changelogGotIt": "Got It",
    "about.changelogAdded": "Added",
    "about.changelogFixed": "Fixed",
    "about.changelogChanged": "Changed",
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

  it("returns null when open but entries empty and not loading", () => {
    const { container } = render(
      <WhatsNewDialog {...defaultProps} entries={[]} />,
    );
    expect(container.firstChild).toBeNull();
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
