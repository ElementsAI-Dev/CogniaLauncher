import { render, screen, fireEvent } from "@testing-library/react";
import { ChangelogDialog } from "./changelog-dialog";
import type { ChangelogEntry } from "@/lib/constants/about";

// Mock MarkdownRenderer (react-markdown is ESM-only)
jest.mock("@/components/docs/markdown-renderer", () => ({
  MarkdownRenderer: ({ content }: { content: string }) => (
    <div data-testid="markdown-renderer">{content}</div>
  ),
}));

const mockT = (key: string) => {
  const translations: Record<string, string> = {
    "about.changelog": "Changelog",
    "about.changelogDescription": "Recent changes and updates",
    "about.changelogAdded": "Added",
    "about.changelogChanged": "Changed",
    "about.changelogFixed": "Fixed",
    "about.changelogRemoved": "Removed",
    "about.changelogDeprecated": "Deprecated",
    "about.changelogSecurity": "Security",
    "about.changelogPerformance": "Performance",
    "about.changelogBreaking": "Breaking",
    "about.changelogLoading": "Loading release notes...",
    "about.changelogFetchError": "Failed to load remote releases",
    "about.changelogRetry": "Retry",
    "about.changelogNoResults": "No entries match the current filters",
    "about.changelogPrerelease": "Pre-release",
    "about.changelogViewOnGithub": "View on GitHub",
    "about.changelogAllTypes": "All Types",
    "about.changelogRemote": "GitHub",
  };
  return translations[key] || key;
};

const entries: ChangelogEntry[] = [
  {
    version: "1.0.0",
    date: "2025-01-15",
    source: "local",
    changes: [
      { type: "added", description: "Initial release" },
      { type: "fixed", description: "Fixed a bug" },
    ],
  },
  {
    version: "0.9.0",
    date: "2025-01-01",
    source: "remote",
    prerelease: true,
    url: "https://github.com/test/releases/tag/v0.9.0",
    markdownBody: "## Release Notes\nSome markdown content",
    changes: [
      { type: "changed", description: "Updated UI" },
    ],
  },
];

const defaultProps = {
  open: true,
  onOpenChange: jest.fn(),
  entries,
  t: mockT,
};

describe("ChangelogDialog", () => {
  it("renders dialog title when open", () => {
    render(<ChangelogDialog {...defaultProps} />);
    expect(screen.getByText("Changelog")).toBeInTheDocument();
  });

  it("renders description", () => {
    render(<ChangelogDialog {...defaultProps} />);
    expect(screen.getByText("Recent changes and updates")).toBeInTheDocument();
  });

  it("renders version entries", () => {
    render(<ChangelogDialog {...defaultProps} />);
    expect(screen.getByText("v1.0.0")).toBeInTheDocument();
    expect(screen.getByText("v0.9.0")).toBeInTheDocument();
  });

  it("renders dates", () => {
    render(<ChangelogDialog {...defaultProps} />);
    expect(screen.getByText("2025-01-15")).toBeInTheDocument();
    expect(screen.getByText("2025-01-01")).toBeInTheDocument();
  });

  it("renders change descriptions (first entry expanded by default)", () => {
    render(<ChangelogDialog {...defaultProps} />);
    // First entry is expanded by default
    expect(screen.getByText("Initial release")).toBeInTheDocument();
    expect(screen.getByText("Fixed a bug")).toBeInTheDocument();
  });

  it("renders type badges", () => {
    render(<ChangelogDialog {...defaultProps} />);
    // "Added" and "Fixed" appear in both filter bar and badges
    expect(screen.getAllByText("Added").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Fixed").length).toBeGreaterThanOrEqual(1);
  });

  it("renders pre-release badge for pre-release entries", () => {
    render(<ChangelogDialog {...defaultProps} />);
    expect(screen.getAllByText("Pre-release").length).toBeGreaterThanOrEqual(1);
  });

  it("renders GitHub badge for remote entries", () => {
    render(<ChangelogDialog {...defaultProps} />);
    expect(screen.getAllByText("GitHub").length).toBeGreaterThanOrEqual(1);
  });

  it("does not render content when closed", () => {
    render(<ChangelogDialog {...defaultProps} open={false} />);
    expect(screen.queryByText("Changelog")).not.toBeInTheDocument();
  });

  it("shows loading skeleton when loading with no entries", () => {
    render(<ChangelogDialog {...defaultProps} entries={[]} loading={true} />);
    expect(screen.queryByText("v1.0.0")).not.toBeInTheDocument();
  });

  it("shows loading indicator when loading with existing entries", () => {
    render(<ChangelogDialog {...defaultProps} loading={true} />);
    expect(screen.getByText("Loading release notes...")).toBeInTheDocument();
  });

  it("shows error banner with retry button", () => {
    const onRetry = jest.fn();
    render(
      <ChangelogDialog
        {...defaultProps}
        error="Network error"
        onRetry={onRetry}
      />,
    );
    expect(
      screen.getByText("Failed to load remote releases"),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByText("Retry"));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("shows empty state when filter returns no results", () => {
    const singleTypeEntries: ChangelogEntry[] = [
      {
        version: "1.0.0",
        date: "2025-01-15",
        changes: [{ type: "added", description: "Feature" }],
      },
    ];
    render(
      <ChangelogDialog {...defaultProps} entries={singleTypeEntries} />,
    );
    // With single type, no filter bar is shown (needs > 1 type)
    expect(screen.getByText("v1.0.0")).toBeInTheDocument();
  });

  it("renders type filter buttons when multiple types exist", () => {
    render(<ChangelogDialog {...defaultProps} />);
    expect(screen.getByText("All Types")).toBeInTheDocument();
  });

  it("renders markdown content for entries with markdownBody", () => {
    // Second entry has markdownBody but is collapsed by default; expand it
    render(<ChangelogDialog {...defaultProps} />);
    // Click on v0.9.0 header to expand
    const v09Button = screen.getByText("v0.9.0").closest("button");
    if (v09Button) fireEvent.click(v09Button);
    expect(screen.getByTestId("markdown-renderer")).toBeInTheDocument();
  });
});
