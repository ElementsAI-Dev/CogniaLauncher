import { render, screen, fireEvent } from "@testing-library/react";
import { ActionsCard } from "../actions-card";

const mockT = (key: string) => {
  const translations: Record<string, string> = {
    "about.actions": "Actions",
    "about.checkForUpdates": "Check for Updates",
    "about.documentation": "Documentation",
    "about.reportBug": "Report Bug",
    "about.featureRequest": "Feature Request",
    "about.changelog": "Changelog",
    "about.openInNewTab": "Opens in new tab",
  };
  return translations[key] || key;
};

describe("ActionsCard", () => {
  const mockOnCheckUpdate = jest.fn();
  const mockOnOpenChangelog = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("rendering", () => {
    it("displays actions heading", () => {
      render(
        <ActionsCard
          loading={false}
          onCheckUpdate={mockOnCheckUpdate}
          onOpenChangelog={mockOnOpenChangelog}
          t={mockT}
        />
      );

      expect(screen.getByText("Actions")).toBeInTheDocument();
    });

    it("renders check for updates button", () => {
      render(
        <ActionsCard
          loading={false}
          onCheckUpdate={mockOnCheckUpdate}
          onOpenChangelog={mockOnOpenChangelog}
          t={mockT}
        />
      );

      expect(
        screen.getByRole("button", { name: /check for updates/i })
      ).toBeInTheDocument();
    });

    it("renders changelog button", () => {
      render(
        <ActionsCard
          loading={false}
          onCheckUpdate={mockOnCheckUpdate}
          onOpenChangelog={mockOnOpenChangelog}
          t={mockT}
        />
      );

      expect(
        screen.getByRole("button", { name: /changelog/i })
      ).toBeInTheDocument();
    });

    it("renders GitHub link", () => {
      render(
        <ActionsCard
          loading={false}
          onCheckUpdate={mockOnCheckUpdate}
          onOpenChangelog={mockOnOpenChangelog}
          t={mockT}
        />
      );

      expect(screen.getByRole("link", { name: /github/i })).toBeInTheDocument();
    });

    it("renders documentation link", () => {
      render(
        <ActionsCard
          loading={false}
          onCheckUpdate={mockOnCheckUpdate}
          onOpenChangelog={mockOnOpenChangelog}
          t={mockT}
        />
      );

      expect(
        screen.getByRole("link", { name: /documentation/i })
      ).toBeInTheDocument();
    });

    it("renders report bug link", () => {
      render(
        <ActionsCard
          loading={false}
          onCheckUpdate={mockOnCheckUpdate}
          onOpenChangelog={mockOnOpenChangelog}
          t={mockT}
        />
      );

      expect(
        screen.getByRole("link", { name: /report bug/i })
      ).toBeInTheDocument();
    });

    it("renders feature request link", () => {
      render(
        <ActionsCard
          loading={false}
          onCheckUpdate={mockOnCheckUpdate}
          onOpenChangelog={mockOnOpenChangelog}
          t={mockT}
        />
      );

      expect(
        screen.getByRole("link", { name: /feature request/i })
      ).toBeInTheDocument();
    });
  });

  describe("button actions", () => {
    it("calls onCheckUpdate when check for updates is clicked", () => {
      render(
        <ActionsCard
          loading={false}
          onCheckUpdate={mockOnCheckUpdate}
          onOpenChangelog={mockOnOpenChangelog}
          t={mockT}
        />
      );

      fireEvent.click(screen.getByRole("button", { name: /check for updates/i }));
      expect(mockOnCheckUpdate).toHaveBeenCalledTimes(1);
    });

    it("calls onOpenChangelog when changelog button is clicked", () => {
      render(
        <ActionsCard
          loading={false}
          onCheckUpdate={mockOnCheckUpdate}
          onOpenChangelog={mockOnOpenChangelog}
          t={mockT}
        />
      );

      fireEvent.click(screen.getByRole("button", { name: /changelog/i }));
      expect(mockOnOpenChangelog).toHaveBeenCalledTimes(1);
    });
  });

  describe("loading state", () => {
    it("disables check for updates button when loading", () => {
      render(
        <ActionsCard
          loading={true}
          onCheckUpdate={mockOnCheckUpdate}
          onOpenChangelog={mockOnOpenChangelog}
          t={mockT}
        />
      );

      expect(
        screen.getByRole("button", { name: /check for updates/i })
      ).toBeDisabled();
    });

    it("shows spinning animation on icon when loading", () => {
      const { container } = render(
        <ActionsCard
          loading={true}
          onCheckUpdate={mockOnCheckUpdate}
          onOpenChangelog={mockOnOpenChangelog}
          t={mockT}
        />
      );

      const spinningIcon = container.querySelector(".animate-spin");
      expect(spinningIcon).toBeInTheDocument();
    });
  });

  describe("external links", () => {
    it("GitHub link opens in new tab", () => {
      render(
        <ActionsCard
          loading={false}
          onCheckUpdate={mockOnCheckUpdate}
          onOpenChangelog={mockOnOpenChangelog}
          t={mockT}
        />
      );

      const githubLink = screen.getByRole("link", { name: /github/i });
      expect(githubLink).toHaveAttribute("target", "_blank");
      expect(githubLink).toHaveAttribute("rel", "noopener noreferrer");
    });

    it("documentation link opens in new tab", () => {
      render(
        <ActionsCard
          loading={false}
          onCheckUpdate={mockOnCheckUpdate}
          onOpenChangelog={mockOnOpenChangelog}
          t={mockT}
        />
      );

      const docsLink = screen.getByRole("link", { name: /documentation/i });
      expect(docsLink).toHaveAttribute("target", "_blank");
      expect(docsLink).toHaveAttribute("rel", "noopener noreferrer");
    });

    it("report bug link points to GitHub issues", () => {
      render(
        <ActionsCard
          loading={false}
          onCheckUpdate={mockOnCheckUpdate}
          onOpenChangelog={mockOnOpenChangelog}
          t={mockT}
        />
      );

      const bugLink = screen.getByRole("link", { name: /report bug/i });
      expect(bugLink).toHaveAttribute(
        "href",
        expect.stringContaining("github.com")
      );
      expect(bugLink).toHaveAttribute(
        "href",
        expect.stringContaining("issues")
      );
    });

    it("feature request link points to GitHub discussions", () => {
      render(
        <ActionsCard
          loading={false}
          onCheckUpdate={mockOnCheckUpdate}
          onOpenChangelog={mockOnOpenChangelog}
          t={mockT}
        />
      );

      const featureLink = screen.getByRole("link", { name: /feature request/i });
      expect(featureLink).toHaveAttribute(
        "href",
        expect.stringContaining("github.com")
      );
      expect(featureLink).toHaveAttribute(
        "href",
        expect.stringContaining("discussions")
      );
    });
  });

  describe("accessibility", () => {
    it("has region role", () => {
      render(
        <ActionsCard
          loading={false}
          onCheckUpdate={mockOnCheckUpdate}
          onOpenChangelog={mockOnOpenChangelog}
          t={mockT}
        />
      );

      expect(screen.getByRole("region")).toBeInTheDocument();
    });

    it("has aria-labelledby for heading", () => {
      render(
        <ActionsCard
          loading={false}
          onCheckUpdate={mockOnCheckUpdate}
          onOpenChangelog={mockOnOpenChangelog}
          t={mockT}
        />
      );

      const region = screen.getByRole("region");
      expect(region).toHaveAttribute("aria-labelledby", "actions-heading");
    });
  });
});
