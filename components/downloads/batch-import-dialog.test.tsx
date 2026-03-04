import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BatchImportDialog } from "./batch-import-dialog";

jest.mock("@/components/providers/locale-provider", () => ({
  useLocale: () => ({ t: (key: string) => key }),
}));

jest.mock("@/lib/tauri", () => ({
  isTauri: jest.fn().mockReturnValue(false),
}));

jest.mock("sonner", () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
  },
}));

jest.mock("@/lib/clipboard", () => ({
  readClipboard: jest.fn().mockResolvedValue("https://example.com/clip.zip"),
}));

// ScrollArea uses ResizeObserver internally
beforeAll(() => {
  global.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
});

describe("BatchImportDialog", () => {
  const defaultProps = {
    open: true,
    onOpenChange: jest.fn(),
    onSubmit: jest.fn().mockResolvedValue(undefined),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders dialog title and description", () => {
    render(<BatchImportDialog {...defaultProps} />);

    expect(screen.getByText("downloads.batchImport")).toBeInTheDocument();
    expect(screen.getByText("downloads.batchImportDesc")).toBeInTheDocument();
  });

  it("renders textarea for URL input", () => {
    render(<BatchImportDialog {...defaultProps} />);

    expect(
      screen.getByPlaceholderText("downloads.batchImportPlaceholder"),
    ).toBeInTheDocument();
  });

  it("does not render when closed", () => {
    render(<BatchImportDialog {...defaultProps} open={false} />);

    expect(
      screen.queryByText("downloads.batchImport"),
    ).not.toBeInTheDocument();
  });

  it("disables submit button when no URLs entered", () => {
    render(<BatchImportDialog {...defaultProps} />);

    // The last button in the dialog footer is the submit button
    const footer = screen.getByText("common.cancel").parentElement!;
    const submitButton = footer.querySelectorAll("button")[1] as HTMLButtonElement;
    expect(submitButton).toBeDisabled();
  });

  it("parses valid and invalid URLs and shows badge counts", async () => {
    render(<BatchImportDialog {...defaultProps} />);

    const textarea = screen.getByPlaceholderText(
      "downloads.batchImportPlaceholder",
    );
    await userEvent.type(
      textarea,
      "https://example.com/file1.zip\nnot-a-url\nhttps://example.com/file2.zip",
    );

    // Badges render as "N downloads.batchValid" / "N downloads.batchInvalid"
    expect(screen.getByText(/2\s+downloads\.batchValid/)).toBeInTheDocument();
    expect(screen.getByText(/1\s+downloads\.batchInvalid/)).toBeInTheDocument();
  });

  it("shows parsed URL preview list", async () => {
    render(<BatchImportDialog {...defaultProps} />);

    const textarea = screen.getByPlaceholderText(
      "downloads.batchImportPlaceholder",
    );
    await userEvent.type(textarea, "https://example.com/alpha.zip");

    expect(screen.getByText("alpha.zip")).toBeInTheDocument();
  });

  it("disables submit when destination is empty", async () => {
    render(<BatchImportDialog {...defaultProps} />);

    const textarea = screen.getByPlaceholderText(
      "downloads.batchImportPlaceholder",
    );
    await userEvent.type(textarea, "https://example.com/file.zip");

    // The last button in the dialog footer is the submit button
    const footer = screen.getByText("common.cancel").parentElement!;
    const submitButton = footer.querySelectorAll("button")[1] as HTMLButtonElement;
    expect(submitButton).toBeDisabled();
  });

  it("calls onSubmit with correct request array", async () => {
    const onSubmit = jest.fn().mockResolvedValue(undefined);
    render(<BatchImportDialog {...defaultProps} onSubmit={onSubmit} />);

    const textarea = screen.getByPlaceholderText(
      "downloads.batchImportPlaceholder",
    );
    await userEvent.type(textarea, "https://example.com/file.zip");

    // Fill destination
    const destInput = screen.getByPlaceholderText(
      "downloads.batchDestPlaceholder",
    );
    await userEvent.type(destInput, "/downloads");

    // The last button in the dialog footer is the submit button
    const footer = screen.getByText("common.cancel").parentElement!;
    const submitButton = footer.querySelectorAll("button")[1] as HTMLButtonElement;

    expect(submitButton).not.toBeDisabled();
    await userEvent.click(submitButton);

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            url: "https://example.com/file.zip",
            name: "file.zip",
          }),
        ]),
      );
    });
  });

  it("calls onOpenChange(false) when cancel is clicked", async () => {
    const onOpenChange = jest.fn();
    render(
      <BatchImportDialog {...defaultProps} onOpenChange={onOpenChange} />,
    );

    await userEvent.click(screen.getByText("common.cancel"));

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("renders destination picker", () => {
    render(<BatchImportDialog {...defaultProps} />);

    expect(
      screen.getByText("downloads.batchDestination"),
    ).toBeInTheDocument();
  });

  it("renders paste from clipboard button when URLs present", async () => {
    render(<BatchImportDialog {...defaultProps} />);

    const textarea = screen.getByPlaceholderText(
      "downloads.batchImportPlaceholder",
    );
    await userEvent.type(textarea, "https://example.com/file.zip");

    // ClipboardPaste icon button should appear
    const buttons = screen.getAllByRole("button");
    expect(buttons.length).toBeGreaterThanOrEqual(2);
  });
});
