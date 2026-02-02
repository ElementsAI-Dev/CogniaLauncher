import { render, screen } from "@testing-library/react";
import { VersionCards } from "../version-cards";

const mockT = (key: string) => {
  const translations: Record<string, string> = {
    "about.currentVersion": "Current Version",
    "about.latestVersion": "Latest Version",
    "about.upToDate": "Up to date",
  };
  return translations[key] || key;
};

describe("VersionCards", () => {
  describe("loading state", () => {
    it("renders skeleton loaders when loading", () => {
      const { container } = render(
        <VersionCards loading={true} updateInfo={null} t={mockT} />
      );

      // Should have skeleton elements
      const skeletons = container.querySelectorAll('[class*="animate-pulse"]');
      expect(skeletons.length).toBeGreaterThan(0);
    });
  });

  describe("with update info", () => {
    const mockUpdateInfo = {
      current_version: "0.1.0",
      latest_version: "0.1.0",
      update_available: false,
      release_notes: null,
    };

    it("displays current version", () => {
      render(
        <VersionCards loading={false} updateInfo={mockUpdateInfo} t={mockT} />
      );

      // Both current and latest show v0.1.0 when up-to-date
      const versionElements = screen.getAllByText(/v0\.1\.0/);
      expect(versionElements.length).toBeGreaterThanOrEqual(1);
    });

    it("displays current version label", () => {
      render(
        <VersionCards loading={false} updateInfo={mockUpdateInfo} t={mockT} />
      );

      expect(screen.getByText("Current Version")).toBeInTheDocument();
    });

    it("displays latest version label", () => {
      render(
        <VersionCards loading={false} updateInfo={mockUpdateInfo} t={mockT} />
      );

      expect(screen.getByText("Latest Version")).toBeInTheDocument();
    });

    it("shows up-to-date badge when no update available", () => {
      render(
        <VersionCards loading={false} updateInfo={mockUpdateInfo} t={mockT} />
      );

      expect(screen.getByText("Up to date")).toBeInTheDocument();
    });

    it("does not show up-to-date badge when update is available", () => {
      const updateAvailableInfo = {
        ...mockUpdateInfo,
        latest_version: "0.2.0",
        update_available: true,
      };

      render(
        <VersionCards loading={false} updateInfo={updateAvailableInfo} t={mockT} />
      );

      expect(screen.queryByText("Up to date")).not.toBeInTheDocument();
    });
  });

  describe("accessibility", () => {
    it("has group role container", () => {
      const mockUpdateInfo = {
        current_version: "0.1.0",
        latest_version: "0.1.0",
        update_available: false,
        release_notes: null,
      };

      render(
        <VersionCards loading={false} updateInfo={mockUpdateInfo} t={mockT} />
      );

      // Component uses role="group" for the container
      expect(screen.getByRole("group")).toBeInTheDocument();
    });

    it("has status role for up-to-date indicator", () => {
      const mockUpdateInfo = {
        current_version: "0.1.0",
        latest_version: "0.1.0",
        update_available: false,
        release_notes: null,
      };

      render(
        <VersionCards loading={false} updateInfo={mockUpdateInfo} t={mockT} />
      );

      expect(screen.getByRole("status")).toBeInTheDocument();
    });
  });
});
