import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AddDownloadDialog } from "./add-download-dialog";
import { LocaleProvider } from "@/components/providers/locale-provider";

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

const mockMessages = {
  en: {
    common: {
      cancel: "Cancel",
      loading: "Loading...",
      add: "Add",
    },
    downloads: {
      addDownload: "Add Download",
      description: "Add a new download task",
      url: "URL",
      destination: "Destination",
      name: "Name",
      priority: "Priority",
      checksum: "Checksum",
      provider: "Provider",
      providerPlaceholder: "Optional: e.g., npm, github",
      selectDestination: "Select download destination",
      manualPathRequired: "Please enter the path manually",
      browseFolder: "Browse",
    },
  },
  zh: {
    common: {},
    downloads: {},
  },
};

function TestWrapper({ children }: { children: React.ReactNode }) {
  return (
    <LocaleProvider messages={mockMessages as never}>{children}</LocaleProvider>
  );
}

describe("AddDownloadDialog", () => {
  const defaultProps = {
    open: true,
    onOpenChange: jest.fn(),
    onSubmit: jest.fn().mockResolvedValue(undefined),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders dialog with all form fields", () => {
    render(
      <TestWrapper>
        <AddDownloadDialog {...defaultProps} />
      </TestWrapper>,
    );

    expect(screen.getByText("Add Download")).toBeInTheDocument();
    expect(screen.getByLabelText("URL")).toBeInTheDocument();
    expect(screen.getByLabelText("Destination")).toBeInTheDocument();
    expect(screen.getByLabelText("Name")).toBeInTheDocument();
    expect(screen.getByLabelText("Provider")).toBeInTheDocument();
    expect(screen.getByLabelText("Priority")).toBeInTheDocument();
    expect(screen.getByLabelText("Checksum")).toBeInTheDocument();
  });

  it("renders browse folder button", () => {
    render(
      <TestWrapper>
        <AddDownloadDialog {...defaultProps} />
      </TestWrapper>,
    );

    expect(screen.getByTitle("Browse")).toBeInTheDocument();
  });

  it("renders provider field with placeholder", () => {
    render(
      <TestWrapper>
        <AddDownloadDialog {...defaultProps} />
      </TestWrapper>,
    );

    expect(
      screen.getByPlaceholderText("Optional: e.g., npm, github"),
    ).toBeInTheDocument();
  });

  it("disables submit button when required fields are empty", () => {
    render(
      <TestWrapper>
        <AddDownloadDialog {...defaultProps} />
      </TestWrapper>,
    );

    expect(screen.getByRole("button", { name: "Add" })).toBeDisabled();
  });

  it("enables submit button when required fields are filled", async () => {
    render(
      <TestWrapper>
        <AddDownloadDialog {...defaultProps} />
      </TestWrapper>,
    );

    await userEvent.type(
      screen.getByLabelText("URL"),
      "https://example.com/file.zip",
    );
    await userEvent.type(
      screen.getByLabelText("Destination"),
      "/downloads/file.zip",
    );
    await userEvent.type(screen.getByLabelText("Name"), "file.zip");

    expect(screen.getByRole("button", { name: "Add" })).not.toBeDisabled();
  });

  it("name field is editable", async () => {
    render(
      <TestWrapper>
        <AddDownloadDialog {...defaultProps} />
      </TestWrapper>,
    );

    const nameInput = screen.getByLabelText("Name");
    await userEvent.type(nameInput, "my-custom-file.zip");

    expect(nameInput).toHaveValue("my-custom-file.zip");
  });

  it("submits form with provider field", async () => {
    const onSubmit = jest.fn().mockResolvedValue(undefined);
    render(
      <TestWrapper>
        <AddDownloadDialog {...defaultProps} onSubmit={onSubmit} />
      </TestWrapper>,
    );

    // Fill all required fields manually
    await userEvent.type(
      screen.getByLabelText("URL"),
      "https://example.com/file.zip",
    );
    await userEvent.type(
      screen.getByLabelText("Destination"),
      "/downloads/file.zip",
    );
    await userEvent.type(screen.getByLabelText("Name"), "custom-name.zip");
    await userEvent.type(screen.getByLabelText("Provider"), "npm");

    await userEvent.click(screen.getByRole("button", { name: "Add" }));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalled();
    });

    // Verify provider is included in the call
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        provider: "npm",
      }),
    );
  });

  it("calls onOpenChange when cancel is clicked", async () => {
    const onOpenChange = jest.fn();
    render(
      <TestWrapper>
        <AddDownloadDialog {...defaultProps} onOpenChange={onOpenChange} />
      </TestWrapper>,
    );

    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
