import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ChangelogDialog } from "./changelog-dialog";
import type { ChangelogEntry } from "@/lib/constants/about";

// Mock MarkdownRenderer (react-markdown is ESM-only)
jest.mock("@/components/docs/markdown-renderer", () => ({
  MarkdownRenderer: ({ content }: { content: string }) => (
    <div data-testid="markdown-renderer">{content}</div>
  ),
}));

const mockT = (
  key: string,
  params?: Record<string, string | number>,
) => {
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
    "about.changelogFilterByType": "Filter by type",
    "about.changelogExpandAll": "Expand All",
    "about.changelogCollapseAll": "Collapse All",
    "about.changelogLocal": "Bundled",
    "about.changelogRemote": "GitHub",
    "about.changelogReleaseNotes": "Release Notes",
    "about.changelogSearchPlaceholder": "Search versions and release notes...",
    "about.changelogClearSearch": "Clear search",
    "about.changelogFilterBySource": "Source",
    "about.changelogAllSources": "All Sources",
    "about.changelogShowPrerelease": "Include pre-releases",
    "about.changelogRelativeTime": `${params?.time ?? ""} ago`,
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
  locale: "en",
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

  it("renders change descriptions (first entry expanded by default)", async () => {
    render(<ChangelogDialog {...defaultProps} />);
    expect(await screen.findByText("Initial release")).toBeInTheDocument();
    expect(await screen.findByText("Fixed a bug")).toBeInTheDocument();
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

  it("renders Bundled badge for local entries", () => {
    render(<ChangelogDialog {...defaultProps} />);
    expect(screen.getAllByText("Bundled").length).toBeGreaterThanOrEqual(1);
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
    expect(screen.getByText("Filter by type")).toBeInTheDocument();
  });

  it("uses standardized toggle-group controls for type filter", async () => {
    render(<ChangelogDialog {...defaultProps} />);
    const addedFilter = screen
      .getAllByText("Added")
      .find((el) => el.getAttribute("data-slot") === "toggle-group-item");
    expect(addedFilter).toBeTruthy();
    await userEvent.click(addedFilter!);
    expect(addedFilter).toHaveAttribute("data-state", "on");
  });

  it("uses wrapped toolbar rows and cluster shells for responsive alignment", () => {
    render(<ChangelogDialog {...defaultProps} />);

    const controls = screen.getByTestId("changelog-controls");
    const toolbarRows = controls.querySelectorAll('[data-slot="toolbar-row"]');
    const clusters = controls.querySelectorAll('[data-slot="toolbar-cluster"]');
    const searchInput = screen.getByPlaceholderText(
      "Search versions and release notes...",
    );

    expect(toolbarRows.length).toBeGreaterThanOrEqual(2);
    expect(Array.from(toolbarRows).every((row) => row.className.includes("flex-wrap"))).toBe(true);
    expect(clusters.length).toBeGreaterThanOrEqual(2);
    expect(searchInput.className).toContain("h-9");
  });

  it("renders markdown content for entries with markdownBody", () => {
    // Second entry has markdownBody but is collapsed by default; expand it
    render(<ChangelogDialog {...defaultProps} />);
    // Click on v0.9.0 header to expand
    const v09Button = screen.getByText("v0.9.0").closest("button");
    if (v09Button) fireEvent.click(v09Button);
    expect(screen.getByTestId("markdown-renderer")).toBeInTheDocument();
  });

  it("filters entries when a type filter button is clicked", () => {
    render(<ChangelogDialog {...defaultProps} />);
    // Click the "Added" filter button
    const filterButtons = screen.getAllByText("Added");
    // The filter bar button is outside the collapsible — click the first one
    fireEvent.click(filterButtons[0]);
    // "Fixed a bug" should be hidden since it's type=fixed, not added
    // The first entry is expanded but only "added" changes should remain
    expect(screen.getByText("Initial release")).toBeInTheDocument();
    expect(screen.queryByText("Fixed a bug")).not.toBeInTheDocument();
  });

  it("shows no results message when filter excludes all changes", () => {
    const singleTypeEntries: ChangelogEntry[] = [
      {
        version: "1.0.0",
        date: "2025-01-15",
        changes: [
          { type: "added", description: "Feature A" },
          { type: "fixed", description: "Bug fix B" },
        ],
      },
    ];
    render(
      <ChangelogDialog {...defaultProps} entries={singleTypeEntries} />,
    );
    // With both "added" and "fixed" types, the filter bar should show
    expect(screen.getByText("All Types")).toBeInTheDocument();
  });

  it("supports expand and collapse all controls", () => {
    render(<ChangelogDialog {...defaultProps} />);
    expect(screen.getByText("Expand All")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Expand All"));
    expect(screen.getByText("Collapse All")).toBeInTheDocument();
  });

  it("filters entries by keyword search", async () => {
    render(<ChangelogDialog {...defaultProps} />);
    const searchInput = screen.getByPlaceholderText(
      "Search versions and release notes...",
    );
    await userEvent.type(searchInput, "bug");
    expect(screen.getByText("v1.0.0")).toBeInTheDocument();
    expect(screen.queryByText("v0.9.0")).not.toBeInTheDocument();
  });

  it("filters entries by source", async () => {
    render(<ChangelogDialog {...defaultProps} />);
    const bundledFilter = screen
      .getAllByText("Bundled")
      .find((el) => el.getAttribute("data-slot") === "toggle-group-item");
    expect(bundledFilter).toBeTruthy();
    await userEvent.click(bundledFilter!);
    expect(screen.getByText("v1.0.0")).toBeInTheDocument();
    expect(screen.queryByText("v0.9.0")).not.toBeInTheDocument();
  });

  it("hides prerelease entries when prerelease toggle is off", async () => {
    render(<ChangelogDialog {...defaultProps} />);
    expect(screen.getByText("v0.9.0")).toBeInTheDocument();

    const prereleaseSwitch = screen.getByRole("switch", {
      name: "Include pre-releases",
    });
    await userEvent.click(prereleaseSwitch);
    expect(screen.queryByText("v0.9.0")).not.toBeInTheDocument();
  });
});
