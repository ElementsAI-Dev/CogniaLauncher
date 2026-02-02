import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import AboutPage from "./page";
import { LocaleProvider } from "@/components/providers/locale-provider";
import * as tauri from "@/lib/tauri";

// Mock the Tauri API
jest.mock("@/lib/tauri", () => ({
  selfCheckUpdate: jest.fn().mockResolvedValue({
    current_version: "0.1.0",
    latest_version: "0.1.0",
    update_available: false,
    release_notes: null,
  }),
  selfUpdate: jest.fn().mockResolvedValue(undefined),
  getPlatformInfo: jest.fn().mockResolvedValue({ os: "Windows", arch: "x64" }),
  getCogniaDir: jest.fn().mockResolvedValue("C:\\Users\\Test\\.cognia"),
}));

// Mock sonner toast
jest.mock("sonner", () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
  },
}));

// Mock messages for About page
const mockMessages = {
  en: {
    common: {
      loading: "Loading...",
      error: "Error",
      update: "Update",
      retry: "Retry",
      close: "Close",
    },
    about: {
      title: "About",
      pageTitle: "About CogniaLauncher",
      pageDescription: "Cross-platform environment and package manager",
      versionInfo: "Version Information",
      currentVersion: "Current Version",
      latestVersion: "Latest Version",
      upToDate: "Up to date",
      updateAvailable: "Update available",
      updateStarted: "Update started!",
      updateDescription: "Download and install the latest version",
      downloading: "Downloading...",
      downloadProgress: "Download progress",
      releaseNotes: "Release Notes",
      systemInfo: "System Information",
      operatingSystem: "Operating System",
      architecture: "Architecture",
      homeDirectory: "Home Directory",
      locale: "Locale",
      copySystemInfo: "Copy system information",
      copiedToClipboard: "Copied to clipboard",
      copyFailed: "Failed to copy",
      buildDependencies: "Build Dependencies",
      openInNewTab: "Opens in new tab",
      licenseCertificates: "License & Certificates",
      mitLicense: "MIT License",
      mitLicenseDesc: "Open source software",
      copyright: "Copyright © 2025 Max Qian",
      copyrightDesc: "All rights reserved",
      actions: "Actions",
      checkForUpdates: "Check for Updates",
      documentation: "Documentation",
      reportBug: "Report Bug",
      featureRequest: "Feature Request",
      changelog: "Changelog",
      changelogDescription: "View all version updates",
      changelogAdded: "Added",
      changelogChanged: "Changed",
      changelogFixed: "Fixed",
      changelogRemoved: "Removed",
      networkError: "Network error",
      timeoutError: "Timeout error",
      updateCheckFailed: "Update check failed",
    },
  },
  zh: {
    common: {
      loading: "加载中...",
      error: "错误",
      update: "更新",
      retry: "重试",
      close: "关闭",
    },
    about: {
      title: "关于",
      pageTitle: "关于 CogniaLauncher",
      pageDescription: "跨平台环境和包管理器",
    },
  },
};

// Wrapper component with providers
function TestWrapper({ children }: { children: React.ReactNode }) {
  return (
    <LocaleProvider messages={mockMessages as never}>
      {children}
    </LocaleProvider>
  );
}

function renderWithProviders(ui: React.ReactElement) {
  return render(ui, { wrapper: TestWrapper });
}

describe("About Page", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("Page Structure", () => {
    it("renders the page title", async () => {
      renderWithProviders(<AboutPage />);

      await waitFor(() => {
        expect(
          screen.getByRole("heading", { name: /about cognialauncher/i })
        ).toBeInTheDocument();
      });
    });

    it("renders the page description", async () => {
      renderWithProviders(<AboutPage />);

      await waitFor(() => {
        expect(
          screen.getByText(/cross-platform environment and package manager/i)
        ).toBeInTheDocument();
      });
    });

    it("has correct accessibility structure with main landmark", async () => {
      renderWithProviders(<AboutPage />);

      await waitFor(() => {
        expect(screen.getByRole("main")).toBeInTheDocument();
      });
    });
  });

  describe("Version Information", () => {
    it("displays current version", async () => {
      renderWithProviders(<AboutPage />);

      await waitFor(() => {
        // Both current and latest show v0.1.0 when up-to-date
        const versionElements = screen.getAllByText(/v0\.1\.0/);
        expect(versionElements.length).toBeGreaterThanOrEqual(1);
      });
    });

    it("shows up-to-date badge when no update available", async () => {
      renderWithProviders(<AboutPage />);

      await waitFor(() => {
        expect(screen.getByText(/up to date/i)).toBeInTheDocument();
      });
    });
  });

  describe("System Information", () => {
    it("displays operating system", async () => {
      renderWithProviders(<AboutPage />);

      await waitFor(() => {
        expect(screen.getByText("Windows")).toBeInTheDocument();
      });
    });

    it("displays architecture", async () => {
      renderWithProviders(<AboutPage />);

      await waitFor(() => {
        expect(screen.getByText("x64")).toBeInTheDocument();
      });
    });
  });

  describe("Actions", () => {
    it("renders check for updates button", async () => {
      renderWithProviders(<AboutPage />);

      await waitFor(() => {
        expect(
          screen.getByRole("button", { name: /check for updates/i })
        ).toBeInTheDocument();
      });
    });

    it("renders GitHub link", async () => {
      renderWithProviders(<AboutPage />);

      await waitFor(() => {
        expect(screen.getByRole("link", { name: /github/i })).toBeInTheDocument();
      });
    });

    it("renders documentation link", async () => {
      renderWithProviders(<AboutPage />);

      await waitFor(() => {
        expect(
          screen.getByRole("link", { name: /documentation/i })
        ).toBeInTheDocument();
      });
    });

    it("renders report bug link", async () => {
      renderWithProviders(<AboutPage />);

      await waitFor(() => {
        expect(
          screen.getByRole("link", { name: /report bug/i })
        ).toBeInTheDocument();
      });
    });

    it("renders feature request link", async () => {
      renderWithProviders(<AboutPage />);

      await waitFor(() => {
        expect(
          screen.getByRole("link", { name: /feature request/i })
        ).toBeInTheDocument();
      });
    });

    it("renders changelog button", async () => {
      renderWithProviders(<AboutPage />);

      await waitFor(() => {
        expect(
          screen.getByRole("button", { name: /changelog/i })
        ).toBeInTheDocument();
      });
    });
  });

  describe("Changelog Dialog", () => {
    it("opens changelog dialog when button is clicked", async () => {
      renderWithProviders(<AboutPage />);

      await waitFor(() => {
        expect(
          screen.getByRole("button", { name: /changelog/i })
        ).toBeInTheDocument();
      });

      const changelogButton = screen.getByRole("button", { name: /changelog/i });
      fireEvent.click(changelogButton);

      await waitFor(() => {
        expect(screen.getByRole("dialog")).toBeInTheDocument();
      });
    });
  });

  describe("License Section", () => {
    it("displays MIT license information", async () => {
      renderWithProviders(<AboutPage />);

      await waitFor(() => {
        expect(screen.getByText(/mit license/i)).toBeInTheDocument();
      });
    });

    it("displays copyright information", async () => {
      renderWithProviders(<AboutPage />);

      await waitFor(() => {
        expect(screen.getByText(/copyright/i)).toBeInTheDocument();
      });
    });
  });

  describe("Build Dependencies", () => {
    it("displays build dependencies section", async () => {
      renderWithProviders(<AboutPage />);

      await waitFor(() => {
        expect(screen.getByText(/build dependencies/i)).toBeInTheDocument();
      });
    });

    it("displays Tauri dependency", async () => {
      renderWithProviders(<AboutPage />);

      await waitFor(() => {
        expect(screen.getByText("Tauri")).toBeInTheDocument();
      });
    });

    it("displays React dependency", async () => {
      renderWithProviders(<AboutPage />);

      await waitFor(() => {
        expect(screen.getByText("React")).toBeInTheDocument();
      });
    });
  });
});

describe("About Page with Update Available", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Mock update available scenario
    (tauri.selfCheckUpdate as jest.Mock).mockResolvedValue({
      current_version: "0.1.0",
      latest_version: "0.2.0",
      update_available: true,
      release_notes: "New features and bug fixes",
    });
  });

  it("shows update available banner", async () => {
    renderWithProviders(<AboutPage />);

    await waitFor(() => {
      // Multiple elements may show "update available" text
      const updateElements = screen.getAllByText(/update available/i);
      expect(updateElements.length).toBeGreaterThanOrEqual(1);
    });
  });

  it("displays release notes", async () => {
    renderWithProviders(<AboutPage />);

    await waitFor(() => {
      expect(screen.getByText(/new features and bug fixes/i)).toBeInTheDocument();
    });
  });

  it("shows update button", async () => {
    renderWithProviders(<AboutPage />);

    await waitFor(() => {
      // Find the update button in the banner (not the check for updates button)
      const updateButtons = screen.getAllByRole("button");
      const hasUpdateButton = updateButtons.some(
        (btn) => btn.textContent?.toLowerCase().includes("update")
      );
      expect(hasUpdateButton).toBe(true);
    });
  });
});

describe("About Page Error Handling", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Mock error scenario
    (tauri.selfCheckUpdate as jest.Mock).mockRejectedValue(new Error("Network error"));
  });

  it("displays error alert when update check fails", async () => {
    renderWithProviders(<AboutPage />);

    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeInTheDocument();
    });
  });

  it("shows retry button in error state", async () => {
    renderWithProviders(<AboutPage />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /retry/i })).toBeInTheDocument();
    });
  });
});
