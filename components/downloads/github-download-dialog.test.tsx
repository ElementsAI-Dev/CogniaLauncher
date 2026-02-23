import { render, screen } from "@testing-library/react";
import { GitHubDownloadDialog } from "./github-download-dialog";

jest.mock("@/components/providers/locale-provider", () => ({
  useLocale: () => ({ t: (key: string) => key }),
}));

jest.mock("@/hooks/use-github-downloads", () => ({
  useGitHubDownloads: () => ({
    repoInput: "",
    setRepoInput: jest.fn(),
    token: "",
    setToken: jest.fn(),
    parsedRepo: null,
    isValidating: false,
    isValid: false,
    sourceType: "release",
    setSourceType: jest.fn(),
    branches: [],
    tags: [],
    loading: false,
    error: null,
    releases: [],
    validateAndFetch: jest.fn(),
    downloadAsset: jest.fn(),
    downloadSource: jest.fn(),
    reset: jest.fn(),
  }),
}));

jest.mock("@/hooks/use-asset-matcher", () => ({
  useAssetMatcher: () => ({
    parseAssets: jest.fn(() => []),
    currentPlatform: "windows",
    currentArch: "x64",
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

describe("GitHubDownloadDialog", () => {
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
});
