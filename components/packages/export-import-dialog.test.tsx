import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ExportImportDialog } from "./export-import-dialog";

const mockExportPackages = jest.fn();
const mockImportPackages = jest.fn();
const mockImportFromClipboard = jest.fn();
const mockExportToClipboard = jest.fn();
const mockGetImportPreview = jest.fn();
const mockGetNormalizedBookmarks = jest.fn();

jest.mock("@/hooks/packages/use-package-export", () => ({
  usePackageExport: () => ({
    exportPackages: mockExportPackages,
    importPackages: mockImportPackages,
    importFromClipboard: mockImportFromClipboard,
    exportToClipboard: mockExportToClipboard,
    getImportPreview: mockGetImportPreview,
    getNormalizedBookmarks: mockGetNormalizedBookmarks,
  }),
}));

jest.mock("@/components/providers/locale-provider", () => ({
  useLocale: () => ({
    t: (key: string, params?: Record<string, unknown>) => {
      const translations: Record<string, string> = {
        "packages.exportImport": "Export/Import",
        "packages.exportImportTitle": "Export / Import Packages",
        "packages.exportImportDesc":
          "Export your installed packages list or import packages from a file",
        "packages.export": "Export",
        "packages.import": "Import",
        "packages.exportAsJson": "Export as JSON",
        "packages.exportAsJsonDesc":
          "Download complete package list with versions and providers",
        "packages.exportToClipboard": "Copy to Clipboard",
        "packages.exportToClipboardDesc":
          "Copy package names to clipboard as plain text",
        "packages.exportSuccess": "Package list exported successfully",
        "packages.selectFile": "Select JSON File",
        "packages.selectFileDesc":
          "Import packages from a previously exported JSON file",
        "packages.importFromClipboard": "Paste from Clipboard",
        "packages.importFromClipboardDesc":
          "Import packages from clipboard (JSON or one package per line)",
        "packages.restoreBookmarks": "Restore bookmarks",
        "packages.importPreviewInstallable": "Installable",
        "packages.importPreviewSkipped": "Skipped",
        "packages.importPreviewInvalid": "Invalid",
        "packages.importSummary": "Import summary",
        "packages.fileLoaded": "File loaded successfully",
        "packages.packagesLabel": "Packages",
        "packages.selected": `${params?.count || 0} selected`,
        "packages.selectAll": "Select All",
        "packages.installSelected": `Install ${params?.count || 0} selected`,
        "common.cancel": "Cancel",
      };
      return translations[key] || key;
    },
  }),
}));

jest.mock("sonner", () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
  },
}));

describe("ExportImportDialog", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetImportPreview.mockReturnValue({
      installable: [{ id: "pip:requests@2.31.0:0", name: "requests", provider: "pip", version: "2.31.0", status: "installable" }],
      skipped: [{ id: "npm:react@18.0.0:1", name: "react", provider: "npm", version: "18.0.0", status: "skipped", reason: "already-installed" }],
      invalid: [{ id: "invalid:2", name: "   ", status: "invalid", reason: "missing-name" }],
    });
    mockGetNormalizedBookmarks.mockImplementation((data: { bookmarks: string[] }) => data.bookmarks);
  });

  it("renders trigger button", () => {
    render(<ExportImportDialog />);
    expect(screen.getByText("Export/Import")).toBeInTheDocument();
  });

  it("opens dialog when trigger is clicked", async () => {
    const user = userEvent.setup();
    render(<ExportImportDialog />);

    await user.click(screen.getByText("Export/Import"));

    expect(screen.getByText("Export / Import Packages")).toBeInTheDocument();
  });

  it("shows export tab by default", async () => {
    const user = userEvent.setup();
    render(<ExportImportDialog />);

    await user.click(screen.getByText("Export/Import"));

    expect(screen.getByText("Export as JSON")).toBeInTheDocument();
    expect(screen.getByText("Copy to Clipboard")).toBeInTheDocument();
  });

  it("switches to import tab when clicked", async () => {
    const user = userEvent.setup();
    render(<ExportImportDialog />);

    await user.click(screen.getByText("Export/Import"));
    await user.click(screen.getByRole("tab", { name: /Import/i }));

    expect(screen.getByText("Select JSON File")).toBeInTheDocument();
  });

  it("calls exportPackages when export JSON button is clicked", async () => {
    const user = userEvent.setup();
    render(<ExportImportDialog />);

    await user.click(screen.getByText("Export/Import"));
    await user.click(screen.getByText("Export as JSON"));

    expect(mockExportPackages).toHaveBeenCalled();
  });

  it("calls exportToClipboard when copy button is clicked", async () => {
    const user = userEvent.setup();
    render(<ExportImportDialog />);

    await user.click(screen.getByText("Export/Import"));
    await user.click(screen.getByText("Copy to Clipboard"));

    expect(mockExportToClipboard).toHaveBeenCalled();
  });

  it("renders custom trigger when provided", () => {
    render(<ExportImportDialog trigger={<button>Custom Trigger</button>} />);
    expect(screen.getByText("Custom Trigger")).toBeInTheDocument();
  });

  it("shows file input button on import tab", async () => {
    const user = userEvent.setup();
    render(<ExportImportDialog />);
    await user.click(screen.getByText("Export/Import"));
    await user.click(screen.getByRole("tab", { name: /Import/i }));
    expect(screen.getByText("Select JSON File")).toBeInTheDocument();
  });

  it("shows import file selection description", async () => {
    const user = userEvent.setup();
    render(<ExportImportDialog />);
    await user.click(screen.getByText("Export/Import"));
    await user.click(screen.getByRole("tab", { name: /Import/i }));
    expect(screen.getByText(/previously exported JSON/)).toBeInTheDocument();
  });

  it("shows paste from clipboard button on import tab", async () => {
    const user = userEvent.setup();
    render(<ExportImportDialog />);
    await user.click(screen.getByText("Export/Import"));
    await user.click(screen.getByRole("tab", { name: /Import/i }));
    expect(screen.getByText("Paste from Clipboard")).toBeInTheDocument();
  });

  it("calls importFromClipboard when paste button is clicked", async () => {
    mockImportFromClipboard.mockResolvedValueOnce({
      version: "1.0",
      exportedAt: "2025-01-01",
      packages: [{ name: "react" }],
      bookmarks: [],
    });
    const user = userEvent.setup();
    render(<ExportImportDialog />);
    await user.click(screen.getByText("Export/Import"));
    await user.click(screen.getByRole("tab", { name: /Import/i }));
    await user.click(screen.getByText("Paste from Clipboard"));
    expect(mockImportFromClipboard).toHaveBeenCalled();

    await screen.findByText("react");
    const dialog = screen.getByRole("dialog");
    const scrollArea = dialog.querySelector('[data-slot="scroll-area"]');
    expect(scrollArea).toBeInTheDocument();
    expect(scrollArea).toHaveClass("max-h-[45dvh]");
    expect(scrollArea).not.toHaveClass("h-[200px]");
  });

  it("shows preview groups and restore bookmarks option", async () => {
    mockImportFromClipboard.mockResolvedValueOnce({
      version: "1.0",
      exportedAt: "2025-01-01",
      packages: [{ name: "requests", provider: "pip", version: "2.31.0" }],
      bookmarks: ["requests"],
    });

    const user = userEvent.setup();
    render(<ExportImportDialog />);
    await user.click(screen.getByText("Export/Import"));
    await user.click(screen.getByRole("tab", { name: /Import/i }));
    await user.click(screen.getByText("Paste from Clipboard"));

    expect(screen.getByText("Installable")).toBeInTheDocument();
    expect(screen.getByText("Skipped")).toBeInTheDocument();
    expect(screen.getByText("Invalid")).toBeInTheDocument();
    expect(screen.getByText("Restore bookmarks")).toBeInTheDocument();
  });

  it("passes bookmark restoration choice into onImport", async () => {
    mockImportFromClipboard.mockResolvedValueOnce({
      version: "1.0",
      exportedAt: "2025-01-01",
      packages: [{ name: "requests", provider: "pip", version: "2.31.0" }],
      bookmarks: ["requests"],
    });
    const onImport = jest.fn().mockResolvedValue(undefined);

    const user = userEvent.setup();
    render(<ExportImportDialog onImport={onImport} />);
    await user.click(screen.getByText("Export/Import"));
    await user.click(screen.getByRole("tab", { name: /Import/i }));
    await user.click(screen.getByText("Paste from Clipboard"));
    await user.click(screen.getByText("Restore bookmarks"));
    await user.click(screen.getByRole("button", { name: /Install 1 selected/i }));

    expect(onImport).toHaveBeenCalledWith(
      expect.objectContaining({
        bookmarks: [],
        packages: [{ name: "requests", provider: "pip", version: "2.31.0" }],
      }),
    );
  });

  it("passes normalized bookmark identities into onImport", async () => {
    mockImportFromClipboard.mockResolvedValueOnce({
      version: "1.0",
      exportedAt: "2025-01-01",
      packages: [{ name: "requests", provider: "pip", version: "2.31.0" }],
      bookmarks: ["requests", "pip:requests"],
    });
    mockGetNormalizedBookmarks.mockReturnValue(["pip:requests"]);
    const onImport = jest.fn().mockResolvedValue(undefined);

    const user = userEvent.setup();
    render(<ExportImportDialog onImport={onImport} />);
    await user.click(screen.getByText("Export/Import"));
    await user.click(screen.getByRole("tab", { name: /Import/i }));
    await user.click(screen.getByText("Paste from Clipboard"));
    await user.click(screen.getByRole("button", { name: /Install 1 selected/i }));

    expect(onImport).toHaveBeenCalledWith(
      expect.objectContaining({
        bookmarks: ["pip:requests"],
      }),
    );
  });

  it("allows confirming import when only bookmarks will be restored", async () => {
    mockImportFromClipboard.mockResolvedValueOnce({
      version: "1.0",
      exportedAt: "2025-01-01",
      packages: [{ name: "react", provider: "npm", version: "18.0.0" }],
      bookmarks: ["npm:react"],
    });
    mockGetImportPreview.mockReturnValueOnce({
      installable: [],
      skipped: [
        {
          id: "npm:react@18.0.0:0",
          name: "react",
          provider: "npm",
          version: "18.0.0",
          status: "skipped",
          reason: "already-installed",
        },
      ],
      invalid: [],
    });
    mockGetNormalizedBookmarks.mockReturnValueOnce(["npm:react"]);
    const onImport = jest.fn().mockResolvedValue(undefined);

    const user = userEvent.setup();
    render(<ExportImportDialog onImport={onImport} />);
    await user.click(screen.getByText("Export/Import"));
    await user.click(screen.getByRole("tab", { name: /Import/i }));
    await user.click(screen.getByText("Paste from Clipboard"));

    const confirmButton = screen.getByRole("button", { name: /Restore bookmarks/i });
    expect(confirmButton).toBeEnabled();

    await user.click(confirmButton);

    expect(onImport).toHaveBeenCalledWith(
      expect.objectContaining({
        packages: [],
        bookmarks: ["npm:react"],
      }),
    );
  });
});
