import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ExportImportDialog } from "./export-import-dialog";

const mockExportPackages = jest.fn();
const mockImportPackages = jest.fn();
const mockImportFromClipboard = jest.fn();
const mockExportToClipboard = jest.fn();

jest.mock("@/hooks/use-package-export", () => ({
  usePackageExport: () => ({
    exportPackages: mockExportPackages,
    importPackages: mockImportPackages,
    importFromClipboard: mockImportFromClipboard,
    exportToClipboard: mockExportToClipboard,
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
});
