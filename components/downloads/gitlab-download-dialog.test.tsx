import { render, screen } from "@testing-library/react";
import { GitLabDownloadDialog } from "./gitlab-download-dialog";

jest.mock("@/components/providers/locale-provider", () => ({
  useLocale: () => ({ t: (key: string) => key }),
}));

jest.mock("@/hooks/use-gitlab-downloads", () => ({
  useGitLabDownloads: () => ({
    projectInput: "",
    setProjectInput: jest.fn(),
    token: "",
    setToken: jest.fn(),
    instanceUrl: "",
    setInstanceUrl: jest.fn(),
    parsedProject: null,
    projectInfo: null,
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

jest.mock("@/lib/tauri", () => ({
  isTauri: () => false,
}));

jest.mock("sonner", () => ({
  toast: { success: jest.fn(), error: jest.fn() },
}));

describe("GitLabDownloadDialog", () => {
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
});
