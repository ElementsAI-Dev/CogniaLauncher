import { render, screen } from "@testing-library/react";
import { ChangelogDialog } from "./changelog-dialog";

const mockT = (key: string) => {
  const translations: Record<string, string> = {
    "about.changelog": "Changelog",
    "about.changelogDescription": "Recent changes and updates",
    "about.changelogAdded": "Added",
    "about.changelogChanged": "Changed",
    "about.changelogFixed": "Fixed",
    "about.changelogRemoved": "Removed",
  };
  return translations[key] || key;
};

const entries = [
  {
    version: "1.0.0",
    date: "2025-01-15",
    changes: [
      { type: "added" as const, description: "Initial release" },
      { type: "fixed" as const, description: "Fixed a bug" },
    ],
  },
  {
    version: "0.9.0",
    date: "2025-01-01",
    changes: [
      { type: "changed" as const, description: "Updated UI" },
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

  it("renders change descriptions", () => {
    render(<ChangelogDialog {...defaultProps} />);
    expect(screen.getByText("Initial release")).toBeInTheDocument();
    expect(screen.getByText("Fixed a bug")).toBeInTheDocument();
    expect(screen.getByText("Updated UI")).toBeInTheDocument();
  });

  it("renders type badges", () => {
    render(<ChangelogDialog {...defaultProps} />);
    expect(screen.getByText("Added")).toBeInTheDocument();
    expect(screen.getByText("Fixed")).toBeInTheDocument();
    expect(screen.getByText("Changed")).toBeInTheDocument();
  });

  it("does not render content when closed", () => {
    render(<ChangelogDialog {...defaultProps} open={false} />);
    expect(screen.queryByText("Changelog")).not.toBeInTheDocument();
  });
});
