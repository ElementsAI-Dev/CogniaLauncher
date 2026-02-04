import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { SystemInfoCard } from "../system-info-card";
import { TooltipProvider } from "@/components/ui/tooltip";

// Mock clipboard API
Object.assign(navigator, {
  clipboard: {
    writeText: jest.fn().mockResolvedValue(undefined),
  },
});

// Mock sonner
jest.mock("sonner", () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
  },
}));

const mockT = (key: string) => {
  const translations: Record<string, string> = {
    "about.systemInfo": "System Information",
    "about.operatingSystem": "Operating System",
    "about.architecture": "Architecture",
    "about.homeDirectory": "Home Directory",
    "about.locale": "Locale",
    "about.copySystemInfo": "Copy system information",
    "about.copiedToClipboard": "Copied to clipboard",
    "about.copyFailed": "Failed to copy",
  };
  return translations[key] || key;
};

const mockSystemInfo = {
  os: "Windows",
  arch: "x64",
  homeDir: "C:\\Users\\Test\\.cognia",
  locale: "en-US",
};

const mockUpdateInfo = {
  current_version: "0.1.0",
  latest_version: "0.1.0",
  update_available: false,
  release_notes: null,
};

const getProps = (overrides: Partial<React.ComponentProps<typeof SystemInfoCard>> = {}) => ({
  systemInfo: mockSystemInfo,
  systemLoading: false,
  updateInfo: mockUpdateInfo,
  systemError: null,
  onRetry: jest.fn(),
  t: mockT,
  ...overrides,
});

// Wrapper with TooltipProvider
function renderWithTooltip(ui: React.ReactElement) {
  return render(<TooltipProvider>{ui}</TooltipProvider>);
}

describe("SystemInfoCard", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("rendering", () => {
    it("displays system info heading", () => {
      renderWithTooltip(
        <SystemInfoCard {...getProps()} />
      );

      expect(screen.getByText("System Information")).toBeInTheDocument();
    });

    it("displays operating system", () => {
      renderWithTooltip(
        <SystemInfoCard {...getProps()} />
      );

      expect(screen.getByText("Windows")).toBeInTheDocument();
    });

    it("displays architecture", () => {
      renderWithTooltip(
        <SystemInfoCard {...getProps()} />
      );

      expect(screen.getByText("x64")).toBeInTheDocument();
    });

    it("displays home directory", () => {
      renderWithTooltip(
        <SystemInfoCard {...getProps()} />
      );

      expect(screen.getByText("C:\\Users\\Test\\.cognia")).toBeInTheDocument();
    });

    it("displays locale", () => {
      renderWithTooltip(
        <SystemInfoCard {...getProps()} />
      );

      expect(screen.getByText("en-US")).toBeInTheDocument();
    });
  });

  describe("loading state", () => {
    it("shows skeleton loaders when loading", () => {
      const { container } = renderWithTooltip(
        <SystemInfoCard {...getProps({ systemInfo: null, systemLoading: true })} />
      );

      const skeletons = container.querySelectorAll('[class*="animate-pulse"]');
      expect(skeletons.length).toBeGreaterThan(0);
    });
  });

  describe("copy functionality", () => {
    it("renders copy button", () => {
      renderWithTooltip(
        <SystemInfoCard {...getProps()} />
      );

      expect(
        screen.getByRole("button", { name: /copy system information/i })
      ).toBeInTheDocument();
    });

    it("copies system info to clipboard when button is clicked", async () => {
      renderWithTooltip(
        <SystemInfoCard {...getProps()} />
      );

      const copyButton = screen.getByRole("button", { name: /copy system information/i });
      fireEvent.click(copyButton);

      await waitFor(() => {
        expect(navigator.clipboard.writeText).toHaveBeenCalled();
      });
    });

    it("shows success toast after copying", async () => {
      const { toast } = jest.requireMock<{ toast: { success: jest.Mock } }>("sonner");

      renderWithTooltip(
        <SystemInfoCard {...getProps()} />
      );

      const copyButton = screen.getByRole("button", { name: /copy system information/i });
      fireEvent.click(copyButton);

      await waitFor(() => {
        expect(toast.success).toHaveBeenCalledWith("Copied to clipboard");
      });
    });
  });

  describe("accessibility", () => {
    it("has region role", () => {
      renderWithTooltip(
        <SystemInfoCard {...getProps()} />
      );

      expect(screen.getByRole("region")).toBeInTheDocument();
    });

    it("has aria-labelledby for heading", () => {
      renderWithTooltip(
        <SystemInfoCard {...getProps()} />
      );

      const region = screen.getByRole("region");
      expect(region).toHaveAttribute("aria-labelledby", "system-info-heading");
    });
  });
});
