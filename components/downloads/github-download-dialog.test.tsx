import { render, screen, fireEvent } from "@testing-library/react";
import { GitHubDownloadDialog } from "./github-download-dialog";

const mockGetRecommendedAsset = jest.fn(() => null as import("@/types/github").GitHubAssetInfo | null);
const mockParseAssets = jest.fn(() => [] as unknown[]);

const mockUseGitHubDownloads = {
  repoInput: "",
  setRepoInput: jest.fn(),
  token: "",
  setToken: jest.fn(),
  parsedRepo: null as { owner: string; repo: string; fullName: string } | null,
  repoInfo: null as import("@/types/github").GitHubRepoInfoResponse | null,
  isValidating: false,
  isValid: false as boolean | null,
  sourceType: "release" as const,
  setSourceType: jest.fn(),
  branches: [] as import("@/types/github").GitHubBranchInfo[],
  tags: [] as import("@/types/github").GitHubTagInfo[],
  loading: false,
  error: null as string | null,
  releases: [] as import("@/types/github").GitHubReleaseInfo[],
  validateAndFetch: jest.fn(),
  downloadAsset: jest.fn(),
  downloadSource: jest.fn(),
  saveToken: jest.fn(),
  clearSavedToken: jest.fn(),
  reset: jest.fn(),
};

jest.mock("@/components/providers/locale-provider", () => ({
  useLocale: () => ({ t: (key: string) => key }),
}));

jest.mock("@/hooks/use-github-downloads", () => ({
  useGitHubDownloads: () => mockUseGitHubDownloads,
}));

jest.mock("@/hooks/use-asset-matcher", () => ({
  useAssetMatcher: () => ({
    parseAssets: mockParseAssets,
    currentPlatform: "windows",
    currentArch: "x64",
    getRecommendedAsset: mockGetRecommendedAsset,
  }),
  getPlatformLabel: (p: string) => p,
  getArchLabel: (a: string) => a,
}));

jest.mock("@/lib/tauri", () => ({
  isTauri: () => false,
}));

jest.mock("sonner", () => ({
  toast: { success: jest.fn(), error: jest.fn() },
}));

function resetMocks() {
  mockUseGitHubDownloads.repoInput = "";
  mockUseGitHubDownloads.parsedRepo = null;
  mockUseGitHubDownloads.repoInfo = null;
  mockUseGitHubDownloads.isValid = false;
  mockUseGitHubDownloads.releases = [];
  mockUseGitHubDownloads.branches = [];
  mockUseGitHubDownloads.tags = [];
  mockUseGitHubDownloads.error = null;
  mockUseGitHubDownloads.token = "";
  mockParseAssets.mockReturnValue([]);
  mockGetRecommendedAsset.mockReturnValue(null);
}

function renderDialog(overrides: Partial<typeof mockUseGitHubDownloads> = {}) {
  Object.assign(mockUseGitHubDownloads, overrides);
  return render(
    <GitHubDownloadDialog open={true} onOpenChange={jest.fn()} />,
  );
}

const testAsset = {
  id: 1,
  name: "app-windows-x64.zip",
  size: 1024,
  sizeHuman: "1 KB",
  downloadUrl: "https://example.com/app.zip",
  contentType: null,
  downloadCount: 42,
};

const testRelease = {
  id: 1,
  tagName: "v1.0.0",
  name: null as string | null,
  body: null as string | null,
  publishedAt: null as string | null,
  prerelease: false,
  draft: false,
  assets: [testAsset],
};

describe("GitHubDownloadDialog", () => {
  beforeEach(() => {
    resetMocks();
  });

  it("renders dialog title when open", () => {
    render(
      <GitHubDownloadDialog open={true} onOpenChange={jest.fn()} />,
    );
    expect(screen.getByText("downloads.github.dialogTitle")).toBeInTheDocument();
  });

  it("does not render when closed", () => {
    render(
      <GitHubDownloadDialog open={false} onOpenChange={jest.fn()} />,
    );
    expect(screen.queryByText("downloads.github.dialogTitle")).not.toBeInTheDocument();
  });

  it("renders repo info when available", () => {
    renderDialog({
      parsedRepo: { owner: "test", repo: "repo", fullName: "test/repo" },
      isValid: true,
      repoInfo: {
        fullName: "test/repo",
        description: "A test repository",
        homepage: null,
        license: "MIT",
        stargazersCount: 1234,
        forksCount: 56,
        openIssuesCount: 7,
        defaultBranch: "main",
        archived: false,
        disabled: false,
        topics: [],
      },
    });
    expect(screen.getByText("1,234")).toBeInTheDocument();
    expect(screen.getByText("MIT")).toBeInTheDocument();
    expect(screen.getByText("A test repository")).toBeInTheDocument();
  });

  it("shows archived badge for archived repos", () => {
    renderDialog({
      parsedRepo: { owner: "test", repo: "repo", fullName: "test/repo" },
      isValid: true,
      repoInfo: {
        fullName: "test/repo",
        description: null,
        homepage: null,
        license: null,
        stargazersCount: 0,
        forksCount: 0,
        openIssuesCount: 0,
        defaultBranch: "main",
        archived: true,
        disabled: false,
        topics: [],
      },
    });
    expect(screen.getByText("downloads.github.archived")).toBeInTheDocument();
  });

  it("shows draft badge for draft releases", () => {
    renderDialog({
      parsedRepo: { owner: "test", repo: "repo", fullName: "test/repo" },
      isValid: true,
      releases: [{ ...testRelease, draft: true, assets: [] }],
    });
    expect(screen.getByText("downloads.github.draft")).toBeInTheDocument();
  });

  it("shows select recommended button when release is selected with assets", () => {
    mockParseAssets.mockReturnValue([
      {
        asset: testAsset,
        platform: "windows",
        arch: "x64",
        score: 150,
        isRecommended: true,
        isFallback: false,
      },
    ]);
    mockGetRecommendedAsset.mockReturnValue(testAsset);

    renderDialog({
      parsedRepo: { owner: "test", repo: "repo", fullName: "test/repo" },
      isValid: true,
      releases: [testRelease],
    });

    // Click release to select it and show assets
    fireEvent.click(screen.getByText("v1.0.0"));

    expect(screen.getByText("downloads.github.selectRecommended")).toBeInTheDocument();
  });

  it("shows download count for assets", () => {
    mockParseAssets.mockReturnValue([
      {
        asset: testAsset,
        platform: "windows",
        arch: "x64",
        score: 150,
        isRecommended: true,
        isFallback: false,
      },
    ]);

    renderDialog({
      parsedRepo: { owner: "test", repo: "repo", fullName: "test/repo" },
      isValid: true,
      releases: [testRelease],
    });

    // Click release to select it
    fireEvent.click(screen.getByText("v1.0.0"));

    expect(screen.getByText(/42/)).toBeInTheDocument();
  });

  it("shows release notes when release has body", () => {
    renderDialog({
      parsedRepo: { owner: "test", repo: "repo", fullName: "test/repo" },
      isValid: true,
      releases: [{ ...testRelease, body: "## Changelog\n- Fixed bugs", assets: [] }],
    });

    // Click release to select it
    fireEvent.click(screen.getByText("v1.0.0"));

    expect(screen.getByText("downloads.github.releaseNotes")).toBeInTheDocument();
  });

  it("calls reset when cancel button is clicked", () => {
    renderDialog({
      parsedRepo: { owner: "test", repo: "repo", fullName: "test/repo" },
      isValid: true,
    });

    fireEvent.click(screen.getByText("common.cancel"));
    expect(mockUseGitHubDownloads.reset).toHaveBeenCalled();
  });

  it("calls validateAndFetch when fetch button is clicked", () => {
    mockUseGitHubDownloads.repoInput = "test/repo";
    render(
      <GitHubDownloadDialog open={true} onOpenChange={jest.fn()} />,
    );

    fireEvent.click(screen.getByText("downloads.github.fetch"));
    expect(mockUseGitHubDownloads.validateAndFetch).toHaveBeenCalled();
  });

  it("toggles asset checkbox in release view", () => {
    mockParseAssets.mockReturnValue([
      {
        asset: testAsset,
        platform: "windows",
        arch: "x64",
        score: 150,
        isRecommended: true,
        isFallback: false,
      },
    ]);

    renderDialog({
      parsedRepo: { owner: "test", repo: "repo", fullName: "test/repo" },
      isValid: true,
      releases: [testRelease],
    });

    fireEvent.click(screen.getByText("v1.0.0"));

    // Toggle asset checkbox
    const checkboxes = screen.getAllByRole("checkbox");
    expect(checkboxes.length).toBeGreaterThan(0);
    fireEvent.click(checkboxes[0]);
  });

  it("selects recommended asset when button is clicked", () => {
    mockParseAssets.mockReturnValue([
      {
        asset: testAsset,
        platform: "windows",
        arch: "x64",
        score: 150,
        isRecommended: true,
        isFallback: false,
      },
    ]);
    mockGetRecommendedAsset.mockReturnValue(testAsset);

    renderDialog({
      parsedRepo: { owner: "test", repo: "repo", fullName: "test/repo" },
      isValid: true,
      releases: [testRelease],
    });

    fireEvent.click(screen.getByText("v1.0.0"));
    fireEvent.click(screen.getByText("downloads.github.selectRecommended"));

    expect(mockGetRecommendedAsset).toHaveBeenCalled();
  });

  it("shows authentication configured badge when token is set", () => {
    renderDialog({ token: "ghp_secret123" });

    expect(screen.getByText("downloads.auth.title")).toBeInTheDocument();
    expect(screen.getByText("downloads.auth.configured")).toBeInTheDocument();
  });

  it("shows destination picker when validated", () => {
    renderDialog({
      parsedRepo: { owner: "test", repo: "repo", fullName: "test/repo" },
      isValid: true,
    });

    expect(screen.getByText("downloads.github.destination")).toBeInTheDocument();
  });

  it("disables download button when no selection", () => {
    renderDialog({
      parsedRepo: { owner: "test", repo: "repo", fullName: "test/repo" },
      isValid: true,
    });

    const btn = screen.getByText("downloads.github.addToQueue").closest("button");
    expect(btn).toBeDisabled();
  });
});
