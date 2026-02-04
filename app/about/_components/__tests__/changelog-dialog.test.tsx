import { render, screen } from "@testing-library/react";
import { ChangelogDialog } from "../changelog-dialog";
import { getChangelog } from "../../_constants/changelog";

const mockT = (key: string) => {
  const translations: Record<string, string> = {
    "about.changelog": "Changelog",
    "about.changelogDescription": "View all version updates and changes",
    "about.changelogAdded": "Added",
    "about.changelogChanged": "Changed",
    "about.changelogFixed": "Fixed",
    "about.changelogRemoved": "Removed",
  };

  return translations[key] || key;
};

const mockEntries = getChangelog("en");

describe("ChangelogDialog", () => {
  const mockOnOpenChange = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("visibility", () => {
    it("renders dialog when open is true", () => {
      render(
        <ChangelogDialog
          open={true}
          onOpenChange={mockOnOpenChange}
          entries={mockEntries}
          t={mockT}
        />
      );

      expect(screen.getByRole("dialog")).toBeInTheDocument();
    });

    it("does not render dialog when open is false", () => {
      render(
        <ChangelogDialog
          open={false}
          onOpenChange={mockOnOpenChange}
          entries={mockEntries}
          t={mockT}
        />
      );

      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
  });

  describe("content", () => {
    it("displays changelog title", () => {
      render(
        <ChangelogDialog
          open={true}
          onOpenChange={mockOnOpenChange}
          entries={mockEntries}
          t={mockT}
        />
      );

      expect(screen.getByText("Changelog")).toBeInTheDocument();
    });

    it("displays changelog description", () => {
      render(
        <ChangelogDialog
          open={true}
          onOpenChange={mockOnOpenChange}
          entries={mockEntries}
          t={mockT}
        />
      );

      expect(screen.getByText("View all version updates and changes")).toBeInTheDocument();
    });

    it("displays version entries", () => {
      render(
        <ChangelogDialog
          open={true}
          onOpenChange={mockOnOpenChange}
          entries={mockEntries}
          t={mockT}
        />
      );

      // Should display at least one version
      expect(screen.getByText(/v0\.1\.0/)).toBeInTheDocument();
    });

    it("displays change type badges", () => {
      render(
        <ChangelogDialog
          open={true}
          onOpenChange={mockOnOpenChange}
          entries={mockEntries}
          t={mockT}
        />
      );

      // Should have Added badges for initial release
      expect(screen.getAllByText("Added").length).toBeGreaterThan(0);
    });
  });

  describe("accessibility", () => {
    it("has dialog role", () => {
      render(
        <ChangelogDialog
          open={true}
          onOpenChange={mockOnOpenChange}
          entries={mockEntries}
          t={mockT}
        />
      );

      expect(screen.getByRole("dialog")).toBeInTheDocument();
    });
  });
});
