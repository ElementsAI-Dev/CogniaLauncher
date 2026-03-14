import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { GitLabDownloadDialog } from "./gitlab-download-dialog";
import type {
  GitLabReleaseInfo,
  GitLabBranchInfo,
  GitLabTagInfo,
  GitLabPipelineInfo,
  GitLabJobInfo,
  GitLabProjectInfo,
  GitLabPackageInfo,
  GitLabPackageFileInfo,
} from "@/types/gitlab";

beforeAll(() => {
  global.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
});

jest.mock("@/components/providers/locale-provider", () => ({
  useLocale: () => ({ t: (key: string) => key }),
}));

const mockUseGitLabDownloads = {
  projectInput: "",
  setProjectInput: jest.fn(),
  token: "",
  setToken: jest.fn(),
  instanceUrl: "",
  setInstanceUrl: jest.fn(),
  parsedProject: null as { namespace: string; project: string; fullName: string } | null,
  projectInfo: null as GitLabProjectInfo | null,
  isValidating: false,
  isValid: false as boolean | null,
  sourceType: "release" as "release" | "branch" | "tag" | "pipeline" | "package",
  setSourceType: jest.fn(),
  branches: [] as GitLabBranchInfo[],
  tags: [] as GitLabTagInfo[],
  pipelines: [] as GitLabPipelineInfo[],
  jobs: [] as GitLabJobInfo[],
  packages: [] as GitLabPackageInfo[],
  packageFiles: [] as GitLabPackageFileInfo[],
  loading: false,
  error: null as string | null,
  releases: [] as GitLabReleaseInfo[],
  tokenStatus: null,
  vaultStatus: null,
  vaultPassword: "",
  setVaultPassword: jest.fn(),
  setupVault: jest.fn().mockResolvedValue(undefined),
  unlockVault: jest.fn().mockResolvedValue(undefined),
  lockVault: jest.fn().mockResolvedValue(undefined),
  validateAndFetch: jest.fn(),
  fetchPipelines: jest.fn().mockResolvedValue([]),
  fetchPipelineJobs: jest.fn().mockResolvedValue([]),
  fetchPackages: jest.fn().mockResolvedValue([]),
  fetchPackageFiles: jest.fn().mockResolvedValue([]),
  downloadAsset: jest.fn(),
  downloadSource: jest.fn(),
  downloadJobArtifacts: jest.fn(),
  downloadPackageFile: jest.fn(),
  saveToken: jest.fn().mockResolvedValue(undefined),
  saveInstanceUrl: jest.fn().mockResolvedValue(undefined),
  clearSavedToken: jest.fn().mockResolvedValue(undefined),
  reset: jest.fn(),
};

jest.mock("@/hooks/use-gitlab-downloads", () => ({
  useGitLabDownloads: () => mockUseGitLabDownloads,
}));

const mockIsTauri = jest.fn(() => false);

jest.mock("@/lib/tauri", () => ({
  isTauri: () => mockIsTauri(),
}));

jest.mock("sonner", () => ({
  toast: { success: jest.fn(), error: jest.fn() },
}));

function resetMocks() {
  mockIsTauri.mockReturnValue(false);
  mockUseGitLabDownloads.projectInput = "";
  mockUseGitLabDownloads.parsedProject = null;
  mockUseGitLabDownloads.projectInfo = null;
  mockUseGitLabDownloads.isValid = false;
  mockUseGitLabDownloads.releases = [];
  mockUseGitLabDownloads.branches = [];
  mockUseGitLabDownloads.tags = [];
  mockUseGitLabDownloads.pipelines = [];
  mockUseGitLabDownloads.jobs = [];
  mockUseGitLabDownloads.packages = [];
  mockUseGitLabDownloads.packageFiles = [];
  mockUseGitLabDownloads.error = null;
  mockUseGitLabDownloads.token = "";
  mockUseGitLabDownloads.tokenStatus = null;
  mockUseGitLabDownloads.vaultStatus = null;
  mockUseGitLabDownloads.vaultPassword = "";
  mockUseGitLabDownloads.instanceUrl = "";
  mockUseGitLabDownloads.loading = false;
  mockUseGitLabDownloads.sourceType = "release";
  mockUseGitLabDownloads.fetchPackages.mockResolvedValue([]);
  mockUseGitLabDownloads.fetchPackageFiles.mockResolvedValue([]);
}

function renderDialog(overrides: Partial<typeof mockUseGitLabDownloads> = {}) {
  Object.assign(mockUseGitLabDownloads, overrides);
  return render(
    <GitLabDownloadDialog open={true} onOpenChange={jest.fn()} />,
  );
}

const testRelease: GitLabReleaseInfo = {
  tagName: "v1.0.0",
  name: "Release 1.0.0",
  description: "First release",
  createdAt: "2024-06-01T00:00:00Z",
  releasedAt: "2024-06-01T12:00:00Z",
  upcomingRelease: false,
  assets: [
    {
      id: 1,
      name: "app-linux-x64.tar.gz",
      url: "https://gitlab.com/download/asset1",
      directAssetUrl: null,
      linkType: "package",
    },
    {
      id: 2,
      name: "app-windows-x64.zip",
      url: "https://gitlab.com/download/asset2",
      directAssetUrl: null,
      linkType: null,
    },
  ],
  sources: [{ format: "zip", url: "https://gitlab.com/source.zip" }],
};

const testProjectInfo: GitLabProjectInfo = {
  id: 42,
  name: "test-project",
  fullName: "owner/test-project",
  description: "A test project",
  webUrl: "https://gitlab.com/owner/test-project",
  defaultBranch: "main",
  starCount: 256,
  forksCount: 32,
  archived: false,
  topics: ["ci", "devops"],
};

describe("GitLabDownloadDialog", () => {
  beforeEach(() => {
    resetMocks();
  });

  it("renders dialog title when open", () => {
    render(
      <GitLabDownloadDialog open={true} onOpenChange={jest.fn()} />,
    );
    expect(screen.getByText("downloads.gitlab.dialogTitle")).toBeInTheDocument();
  });

  it("does not render when closed", () => {
    render(
      <GitLabDownloadDialog open={false} onOpenChange={jest.fn()} />,
    );
    expect(screen.queryByText("downloads.gitlab.dialogTitle")).not.toBeInTheDocument();
  });

  it("shows error alert when error is set", () => {
    renderDialog({ error: "Repository not found" });
    expect(screen.getByText("Repository not found")).toBeInTheDocument();
  });

  it("renders project info with star count when valid", () => {
    renderDialog({
      parsedProject: { namespace: "owner", project: "test-project", fullName: "owner/test-project" },
      isValid: true,
      projectInfo: testProjectInfo,
    });
    expect(screen.getByText("256")).toBeInTheDocument();
  });

  it("shows releases tab with release items when validated", () => {
    renderDialog({
      parsedProject: { namespace: "owner", project: "test-project", fullName: "owner/test-project" },
      isValid: true,
      releases: [testRelease],
    });
    expect(screen.getByText("v1.0.0")).toBeInTheDocument();
    expect(screen.getByText("Release 1.0.0")).toBeInTheDocument();
  });

  it("shows upcoming badge for upcoming releases", () => {
    const upcomingRelease = { ...testRelease, upcomingRelease: true };
    renderDialog({
      parsedProject: { namespace: "owner", project: "test-project", fullName: "owner/test-project" },
      isValid: true,
      releases: [upcomingRelease],
    });
    expect(screen.getByText("downloads.gitlab.upcoming")).toBeInTheDocument();
  });

  it("shows no releases message when releases array is empty", () => {
    renderDialog({
      parsedProject: { namespace: "owner", project: "test-project", fullName: "owner/test-project" },
      isValid: true,
      releases: [],
    });
    expect(screen.getByText("downloads.gitlab.noReleases")).toBeInTheDocument();
  });

  it("shows asset checkboxes when a release is selected", () => {
    renderDialog({
      parsedProject: { namespace: "owner", project: "test-project", fullName: "owner/test-project" },
      isValid: true,
      releases: [testRelease],
    });
    fireEvent.click(screen.getByRole("button", { name: /v1\.0\.0/i }));
    expect(screen.getByText("app-linux-x64.tar.gz")).toBeInTheDocument();
    expect(screen.getByText("app-windows-x64.zip")).toBeInTheDocument();
  });

  it("shows asset linkType badge when present", () => {
    renderDialog({
      parsedProject: { namespace: "owner", project: "test-project", fullName: "owner/test-project" },
      isValid: true,
      releases: [testRelease],
    });
    fireEvent.click(screen.getByText("v1.0.0"));
    expect(screen.getByText("package")).toBeInTheDocument();
  });

  it("shows branches in branch tab when validated", () => {
    renderDialog({
      parsedProject: { namespace: "owner", project: "test-project", fullName: "owner/test-project" },
      isValid: true,
      sourceType: "branch",
      branches: [
        { name: "main", commitId: "abc", protected: true, default: true },
        { name: "develop", commitId: "def", protected: false, default: false },
      ],
    });
    expect(screen.getByText("main")).toBeInTheDocument();
    expect(screen.getByText("develop")).toBeInTheDocument();
    expect(screen.getByText("downloads.gitlab.default")).toBeInTheDocument();
    expect(screen.getByText("downloads.gitlab.protected")).toBeInTheDocument();
  });

  it("shows tags in tag tab when validated", () => {
    renderDialog({
      parsedProject: { namespace: "owner", project: "test-project", fullName: "owner/test-project" },
      isValid: true,
      sourceType: "tag",
      tags: [
        { name: "v1.0.0", commitId: "abc", message: null, protected: true },
        { name: "v0.9.0", commitId: "def", message: null, protected: false },
      ],
    });
    expect(screen.getByText("v1.0.0")).toBeInTheDocument();
    expect(screen.getByText("v0.9.0")).toBeInTheDocument();
  });

  it("does not show release list when loading is true", () => {
    renderDialog({
      parsedProject: { namespace: "owner", project: "test-project", fullName: "owner/test-project" },
      isValid: true,
      loading: true,
      releases: [testRelease],
    });
    // Release content should not be rendered while loading
    expect(screen.queryByText("v1.0.0")).not.toBeInTheDocument();
    // Tabs should still be visible
    expect(screen.getByText("downloads.gitlab.releases")).toBeInTheDocument();
  });

  it("download button is disabled when no selection is made", () => {
    renderDialog({
      parsedProject: { namespace: "owner", project: "test-project", fullName: "owner/test-project" },
      isValid: true,
    });
    const downloadButton = screen.getByText("downloads.gitlab.addToQueue").closest("button");
    expect(downloadButton).toBeDisabled();
  });

  it("shows authentication section with configured badge when token is set", () => {
    renderDialog({ token: "glpat-secret" });
    expect(screen.getByText("downloads.auth.title")).toBeInTheDocument();
    expect(screen.getByText("downloads.auth.configured")).toBeInTheDocument();
  });

  it("shows destination picker when project is validated", () => {
    renderDialog({
      parsedProject: { namespace: "owner", project: "test-project", fullName: "owner/test-project" },
      isValid: true,
    });
    expect(screen.getByText("downloads.gitlab.destination")).toBeInTheDocument();
  });

  it("calls reset and onOpenChange when cancel button is clicked", async () => {
    const onOpenChange = jest.fn();
    Object.assign(mockUseGitLabDownloads, {
      parsedProject: { namespace: "owner", project: "test-project", fullName: "owner/test-project" },
      isValid: true,
    });
    render(
      <GitLabDownloadDialog open={true} onOpenChange={onOpenChange} />,
    );

    await userEvent.click(screen.getByText("common.cancel"));
    expect(mockUseGitLabDownloads.reset).toHaveBeenCalled();
  });

  it("calls validateAndFetch when fetch button is clicked", async () => {
    mockUseGitLabDownloads.projectInput = "owner/repo";
    render(
      <GitLabDownloadDialog open={true} onOpenChange={jest.fn()} />,
    );

    await userEvent.click(screen.getByText("downloads.gitlab.fetch"));
    expect(mockUseGitLabDownloads.validateAndFetch).toHaveBeenCalled();
  });

  it("toggles asset checkbox selection", async () => {
    renderDialog({
      parsedProject: { namespace: "owner", project: "test-project", fullName: "owner/test-project" },
      isValid: true,
      releases: [testRelease],
    });

    // Click release to select it
    fireEvent.click(screen.getByText("v1.0.0"));

    // Toggle first asset checkbox
    const checkboxes = screen.getAllByRole("checkbox");
    expect(checkboxes.length).toBeGreaterThan(0);
    await userEvent.click(checkboxes[0]);
  });

  it("shows release description when release is selected", () => {
    renderDialog({
      parsedProject: { namespace: "owner", project: "test-project", fullName: "owner/test-project" },
      isValid: true,
      releases: [testRelease],
    });
    // Click to select release
    fireEvent.click(screen.getByText("v1.0.0"));
    expect(screen.getByText("First release")).toBeInTheDocument();
  });

  it("shows release date for releases with releasedAt", () => {
    renderDialog({
      parsedProject: { namespace: "owner", project: "test-project", fullName: "owner/test-project" },
      isValid: true,
      releases: [testRelease],
    });

    // releasedAt renders as a localized date
    const dateEl = screen.getByText(
      new Date(testRelease.releasedAt!).toLocaleDateString(),
    );
    expect(dateEl).toBeInTheDocument();
  });

  it("renders pipeline tab with pipeline list", () => {
    renderDialog({
      parsedProject: { namespace: "owner", project: "test-project", fullName: "owner/test-project" },
      isValid: true,
      sourceType: "pipeline",
      pipelines: [
        { id: 101, refName: "main", status: "success", source: "push", createdAt: null, webUrl: null },
      ],
    });

    expect(screen.getByText("#101")).toBeInTheDocument();
    expect(screen.getByText("success")).toBeInTheDocument();
  });

  it("fetches pipeline jobs when selecting a pipeline", async () => {
    mockUseGitLabDownloads.fetchPipelineJobs.mockResolvedValue([
      {
        id: 201,
        name: "build",
        stage: "build",
        status: "success",
        refName: "main",
        hasArtifacts: true,
        webUrl: null,
        finishedAt: null,
      },
    ]);

    renderDialog({
      parsedProject: { namespace: "owner", project: "test-project", fullName: "owner/test-project" },
      isValid: true,
      sourceType: "pipeline",
      pipelines: [
        { id: 101, refName: "main", status: "success", source: "push", createdAt: null, webUrl: null },
      ],
    });

    const pipelineButton = screen.getByRole("button", { name: /#101/i });
    expect(pipelineButton).toHaveAttribute("aria-pressed", "false");
    await userEvent.click(pipelineButton);
    expect(pipelineButton).toHaveAttribute("aria-pressed", "true");

    expect(mockUseGitLabDownloads.fetchPipelineJobs).toHaveBeenCalledWith(101);
  });

  it("renders package tab with package list", () => {
    renderDialog({
      parsedProject: { namespace: "owner", project: "test-project", fullName: "owner/test-project" },
      isValid: true,
      sourceType: "package",
      packages: [
        { id: 301, name: "cli-bundle", version: "1.2.3", packageType: "generic", createdAt: null },
      ],
    });

    expect(screen.getByText("cli-bundle")).toBeInTheDocument();
    expect(screen.getByText("v1.2.3")).toBeInTheDocument();
  });

  it("shows select-package hint before a package is chosen", () => {
    renderDialog({
      parsedProject: { namespace: "owner", project: "test-project", fullName: "owner/test-project" },
      isValid: true,
      sourceType: "package",
      packages: [
        { id: 301, name: "cli-bundle", version: "1.2.3", packageType: "generic", createdAt: null },
      ],
    });

    expect(screen.getByText("downloads.gitlab.selectPackage")).toBeInTheDocument();
  });

  it("fetches package files when selecting a package", async () => {
    renderDialog({
      parsedProject: { namespace: "owner", project: "test-project", fullName: "owner/test-project" },
      isValid: true,
      sourceType: "package",
      packages: [
        { id: 301, name: "cli-bundle", version: "1.2.3", packageType: "generic", createdAt: null },
      ],
    });

    const packageButton = screen.getByRole("button", { name: /cli-bundle/i });
    expect(packageButton).toHaveAttribute("aria-pressed", "false");
    await userEvent.click(packageButton);
    expect(packageButton).toHaveAttribute("aria-pressed", "true");

    expect(mockUseGitLabDownloads.fetchPackageFiles).toHaveBeenCalledWith(301);
  });

  it("applies package type filter when clicking apply", async () => {
    renderDialog({
      parsedProject: { namespace: "owner", project: "test-project", fullName: "owner/test-project" },
      isValid: true,
      sourceType: "package",
      packages: [
        { id: 301, name: "cli-bundle", version: "1.2.3", packageType: "generic", createdAt: null },
      ],
    });

    await userEvent.type(
      screen.getByPlaceholderText("downloads.gitlab.packageTypePlaceholder"),
      "generic",
    );
    await userEvent.click(screen.getByText("downloads.gitlab.applyPackageType"));

    expect(mockUseGitLabDownloads.fetchPackages).toHaveBeenCalledWith("generic");
  });

  it("applies package type filter when pressing Enter", async () => {
    renderDialog({
      parsedProject: { namespace: "owner", project: "test-project", fullName: "owner/test-project" },
      isValid: true,
      sourceType: "package",
      packages: [
        { id: 301, name: "cli-bundle", version: "1.2.3", packageType: "generic", createdAt: null },
      ],
    });

    await userEvent.type(
      screen.getByPlaceholderText("downloads.gitlab.packageTypePlaceholder"),
      "generic{enter}",
    );

    expect(mockUseGitLabDownloads.fetchPackages).toHaveBeenCalledWith("generic");
  });

  it("clears package type filter and reloads all package types", async () => {
    renderDialog({
      parsedProject: { namespace: "owner", project: "test-project", fullName: "owner/test-project" },
      isValid: true,
      sourceType: "package",
      packages: [
        { id: 301, name: "cli-bundle", version: "1.2.3", packageType: "generic", createdAt: null },
      ],
    });

    const filterInput = screen.getByPlaceholderText(
      "downloads.gitlab.packageTypePlaceholder",
    ) as HTMLInputElement;
    await userEvent.type(filterInput, "generic");
    await userEvent.click(screen.getByRole("button", { name: "common.clear" }));

    expect(filterInput.value).toBe("");
    expect(mockUseGitLabDownloads.fetchPackages).toHaveBeenCalledWith(undefined);
  });

  it("saves instance URL when save url button is clicked", async () => {
    mockIsTauri.mockReturnValue(true);
    renderDialog({ instanceUrl: "https://gitlab.example.com" });

    await userEvent.click(screen.getByText("downloads.auth.title"));
    await userEvent.click(screen.getByText("downloads.gitlab.saveInstanceUrl"));

    expect(mockUseGitLabDownloads.saveInstanceUrl).toHaveBeenCalled();
  });
});
