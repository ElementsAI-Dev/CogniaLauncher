import { render } from "@testing-library/react";
import { InstallationProgressDialog } from "./installation-progress-dialog";
import { useEnvironmentStore } from "@/lib/stores/environment";
import { useEnvironments } from "@/hooks/environments/use-environments";

jest.mock("@/lib/stores/environment", () => ({
  useEnvironmentStore: jest.fn(),
}));

jest.mock("@/hooks/environments/use-environments", () => ({
  useEnvironments: jest.fn(),
}));

jest.mock("@/components/providers/locale-provider", () => ({
  useLocale: () => ({
    t: (key: string) => {
      const translations: Record<string, string> = {
        "environments.progress.title": "Installing {name}",
        "environments.progress.subtitle": "Version {version} via {provider}",
        "environments.progress.steps": "Installation Steps",
        "environments.progress.fetchingInfo": "Fetching version info",
        "environments.progress.downloadingBinaries": "Downloading binaries",
        "environments.progress.extracting": "Extracting files",
        "environments.progress.configuring": "Configuring environment",
        "environments.progress.cancel": "Cancel",
        "environments.progress.runInBackground": "Run in Background",
        "common.close": "Close",
      };
      return translations[key] || key;
    },
  }),
}));

const mockUseEnvironmentStore = useEnvironmentStore as unknown as jest.Mock;
const mockUseEnvironments = useEnvironments as unknown as jest.Mock;

describe("InstallationProgressDialog", () => {
  const mockCloseProgressDialog = jest.fn();
  const mockCancelInstallation = jest.fn();

  const defaultProgress = {
    envType: "Node",
    version: "20.0.0",
    provider: "fnm",
    step: "downloading" as const,
    phase: "download" as const,
    progress: 50,
    downloadedSize: "25 MB",
    totalSize: "50 MB",
    speed: "5 MB/s",
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockUseEnvironmentStore.mockReturnValue({
      progressDialogOpen: true,
      installationProgress: defaultProgress,
      closeProgressDialog: mockCloseProgressDialog,
    });
    mockUseEnvironments.mockReturnValue({
      cancelInstallation: mockCancelInstallation,
    });
  });

  it("renders nothing when installationProgress is null", () => {
    mockUseEnvironmentStore.mockReturnValue({
      progressDialogOpen: true,
      installationProgress: null,
      closeProgressDialog: mockCloseProgressDialog,
    });
    const { container } = render(<InstallationProgressDialog />);
    expect(container.firstChild).toBeNull();
  });

  it("uses environment store for progress data", () => {
    render(<InstallationProgressDialog />);
    expect(mockUseEnvironmentStore).toHaveBeenCalled();
  });

  it("uses environments hook for cancel functionality", () => {
    render(<InstallationProgressDialog />);
    expect(mockUseEnvironments).toHaveBeenCalled();
  });

  it("renders backend stage message and failure class details", () => {
    mockUseEnvironmentStore.mockReturnValue({
      progressDialogOpen: true,
      installationProgress: {
        ...defaultProgress,
        step: "error",
        terminalState: "failed",
        failureClass: "network_error",
        retryable: true,
        retryAfterSeconds: 2,
        stageMessage: "Download request timed out",
        error: "request timeout",
      },
      closeProgressDialog: mockCloseProgressDialog,
    });

    const { getByText } = render(<InstallationProgressDialog />);
    expect(getByText("Download request timed out")).toBeInTheDocument();
    expect(getByText("Network error")).toBeInTheDocument();
    expect(getByText("Retry available in 2s.")).toBeInTheDocument();
  });

  it("renders selection rationale from phase-level progress payload", () => {
    mockUseEnvironmentStore.mockReturnValue({
      progressDialogOpen: true,
      installationProgress: {
        ...defaultProgress,
        step: "fetching",
        phase: "select_artifact",
        stageMessage: "Deterministically selecting installation artifact",
        selectionRationale: "Selected provider `fnm` for `node` on `windows`",
      },
      closeProgressDialog: mockCloseProgressDialog,
    });

    const { getByText } = render(<InstallationProgressDialog />);
    expect(
      getByText("Deterministically selecting installation artifact"),
    ).toBeInTheDocument();
    expect(
      getByText("Selected provider `fnm` for `node` on `windows`"),
    ).toBeInTheDocument();
  });
});
