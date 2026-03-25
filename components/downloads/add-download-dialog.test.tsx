import { fireEvent, render, screen, waitFor } from "@testing-library/react";
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
      priorityPlaceholder: "Select priority",
      priorityCritical: "Critical",
      priorityHigh: "High",
      priorityNormal: "Normal",
      priorityLow: "Low",
      checksum: "Checksum",
      provider: "Provider",
      providerPlaceholder: "Optional: e.g., npm, github",
      selectDestination: "Select download destination",
      manualPathRequired: "Please enter the path manually",
      browseFolder: "Browse",
      dialogError: "Failed to open dialog",
      tags: "Tags",
      tagsPlaceholder: "comma,separated,tags",
      artifactKind: {
        archive: "Archive",
        installer: "Installer",
        ci_artifact: "CI Artifact",
        unknown: "Unknown",
      },
      installIntent: {
        open_installer: "Open Installer",
        extract_then_continue: "Extract Then Continue",
      },
      settings: {
        autoExtract: "Auto Extract",
        autoRename: "Auto Rename",
        deleteAfterExtract: "Delete archive after extraction",
      },
      extractDest: "Extract Destination",
      extractDestPlaceholder: "/path/to/extracted",
      selectExtractDest: "Select extract destination",
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
    expect(screen.getByText("Destination")).toBeInTheDocument();
    expect(screen.getByLabelText("Name")).toBeInTheDocument();
    expect(screen.getByLabelText("Provider")).toBeInTheDocument();
    expect(screen.getByText("Priority")).toBeInTheDocument();
    expect(screen.getByLabelText("Checksum")).toBeInTheDocument();
  });

  it("renders browse folder button", () => {
    render(
      <TestWrapper>
        <AddDownloadDialog {...defaultProps} />
      </TestWrapper>,
    );

    // DestinationPicker renders a FolderOpen icon button
    expect(screen.getByRole("button", { name: "" })).toBeDefined();
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
    // Destination is inside DestinationPicker, find by placeholder
    await userEvent.type(
      screen.getByPlaceholderText("/path/to/file.zip"),
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

    fireEvent.change(screen.getByLabelText("URL"), {
      target: { value: "https://example.com/file.zip" },
    });
    fireEvent.change(screen.getByPlaceholderText("/path/to/file.zip"), {
      target: { value: "/downloads/file.zip" },
    });
    fireEvent.change(screen.getByLabelText("Name"), {
      target: { value: "custom-name.zip" },
    });
    fireEvent.change(screen.getByLabelText("Provider"), {
      target: { value: "npm" },
    });

    fireEvent.click(screen.getByRole("button", { name: "Add" }));

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

  it("submits advanced request fields without dropping them", async () => {
    const onSubmit = jest.fn().mockResolvedValue(undefined);
    render(
      <TestWrapper>
        <AddDownloadDialog {...defaultProps} onSubmit={onSubmit} />
      </TestWrapper>,
    );

    fireEvent.change(screen.getByLabelText("URL"), {
      target: { value: "https://example.com/archive.zip" },
    });
    fireEvent.change(screen.getByPlaceholderText("/path/to/file.zip"), {
      target: { value: "/downloads/archive.zip" },
    });
    fireEvent.change(screen.getByLabelText("Name"), {
      target: { value: "archive.zip" },
    });

    fireEvent.click(screen.getByLabelText("Auto Extract"));
    fireEvent.change(screen.getByPlaceholderText("/path/to/extracted"), {
      target: { value: "/downloads/extracted" },
    });
    fireEvent.click(screen.getByLabelText("Delete archive after extraction"));
    fireEvent.click(screen.getByLabelText("Auto Rename"));
    fireEvent.change(screen.getByPlaceholderText("comma,separated,tags"), {
      target: { value: "github,release" },
    });

    fireEvent.click(screen.getByRole("button", { name: "Add" }));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledTimes(1);
    });

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        autoExtract: true,
        extractDest: "/downloads/extracted",
        deleteAfterExtract: true,
        autoRename: true,
        tags: ["github", "release"],
      }),
    );
  });

  it("shows artifact preview badges for direct URL drafts", async () => {
    render(
      <TestWrapper>
        <AddDownloadDialog {...defaultProps} />
      </TestWrapper>,
    );

    await userEvent.type(
      screen.getByLabelText("URL"),
      "https://example.com/installer.msi",
    );

    expect(screen.getByText("Installer")).toBeInTheDocument();
    expect(screen.getByText("Open Installer")).toBeInTheDocument();
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

  it("prefills fields from an initial request draft", () => {
    render(
      <TestWrapper>
        <AddDownloadDialog
          {...defaultProps}
          initialRequest={{
            url: "https://example.com/history.zip",
            destination: "/downloads/history.zip",
            name: "history.zip",
            provider: "github:owner/repo",
            autoExtract: true,
            extractDest: "/downloads/history",
          }}
        />
      </TestWrapper>,
    );

    expect(screen.getByLabelText("URL")).toHaveValue(
      "https://example.com/history.zip",
    );
    expect(screen.getByPlaceholderText("/path/to/file.zip")).toHaveValue(
      "/downloads/history.zip",
    );
    expect(screen.getByLabelText("Name")).toHaveValue("history.zip");
    expect(screen.getByLabelText("Provider")).toHaveValue("github:owner/repo");
    expect(screen.getByLabelText("Auto Extract")).toBeChecked();
    expect(screen.getByPlaceholderText("/path/to/extracted")).toHaveValue(
      "/downloads/history",
    );
  });

  it("preserves install-aware hidden draft context on submit", async () => {
    const onSubmit = jest.fn().mockResolvedValue(undefined);
    render(
      <TestWrapper>
        <AddDownloadDialog
          {...defaultProps}
          onSubmit={onSubmit}
          initialRequest={{
            url: "https://example.com/history.zip",
            destination: "/downloads/history.zip",
            name: "history.zip",
            sourceDescriptor: {
              kind: "github_workflow_artifact",
              provider: "github",
              repo: "owner/repo",
              workflowRunId: "42",
              artifactId: "88",
            },
            artifactProfile: {
              artifactKind: "ci_artifact",
              sourceKind: "github_workflow_artifact",
              platform: "windows",
              arch: "x64",
              installIntent: "extract_then_continue",
              suggestedFollowUps: ["extract"],
            },
            installIntent: "extract_then_continue",
          }}
        />
      </TestWrapper>,
    );

    await userEvent.click(screen.getByRole("button", { name: "Add" }));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          installIntent: "extract_then_continue",
          sourceDescriptor: expect.objectContaining({
            kind: "github_workflow_artifact",
            workflowRunId: "42",
            artifactId: "88",
          }),
          artifactProfile: expect.objectContaining({
            artifactKind: "ci_artifact",
          }),
        }),
      );
    });
  });
});
