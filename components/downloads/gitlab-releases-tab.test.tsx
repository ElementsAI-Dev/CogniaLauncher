import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { GitLabReleasesTab } from "./gitlab-releases-tab";
import type { GitLabReleaseInfo, GitLabAssetInfo } from "@/types/gitlab";

beforeAll(() => {
  global.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
});

describe("GitLabReleasesTab", () => {
  const releaseAssetA: GitLabAssetInfo = {
    id: 1,
    name: "cli-linux-x64.tar.gz",
    url: "https://gitlab.example.com/a",
    directAssetUrl: null,
    linkType: "package",
  };

  const releaseAssetB: GitLabAssetInfo = {
    id: 2,
    name: "cli-windows-x64.zip",
    url: "https://gitlab.example.com/b",
    directAssetUrl: null,
    linkType: null,
  };

  const releases: GitLabReleaseInfo[] = [
    {
      tagName: "v1.0.0",
      name: "Release 1.0.0",
      description: "Stable release",
      createdAt: null,
      releasedAt: "2025-01-01T08:00:00Z",
      upcomingRelease: false,
      assets: [releaseAssetA, releaseAssetB],
      sources: [{ format: "zip", url: "https://gitlab.example.com/src.zip" }],
    },
    {
      tagName: "v1.1.0-beta",
      name: null,
      description: null,
      createdAt: null,
      releasedAt: null,
      upcomingRelease: true,
      assets: [],
      sources: [],
    },
  ];

  const defaultProps = {
    releases,
    selectedRelease: null as string | null,
    onSelectRelease: jest.fn(),
    selectedAssets: [] as GitLabAssetInfo[],
    onAssetToggle: jest.fn(),
    t: (key: string) => key,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders empty message when releases are empty", () => {
    render(
      <GitLabReleasesTab
        {...defaultProps}
        releases={[]}
      />,
    );

    expect(screen.getByText("downloads.gitlab.noReleases")).toBeInTheDocument();
  });

  it("calls onSelectRelease when selecting release row", async () => {
    const onSelectRelease = jest.fn();
    render(
      <GitLabReleasesTab
        {...defaultProps}
        onSelectRelease={onSelectRelease}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: /v1\.0\.0/i }));
    expect(onSelectRelease).toHaveBeenCalledWith("v1.0.0");
  });

  it("shows selected semantics and selected release description", () => {
    render(
      <GitLabReleasesTab
        {...defaultProps}
        selectedRelease="v1.0.0"
      />,
    );

    const selectedButton = screen.getByRole("button", { name: /v1\.0\.0/i });
    expect(selectedButton).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText("Stable release")).toBeInTheDocument();
  });

  it("shows upcoming badge and release date when available", () => {
    render(<GitLabReleasesTab {...defaultProps} />);

    expect(screen.getByText("downloads.gitlab.upcoming")).toBeInTheDocument();
    expect(
      screen.getByText(new Date("2025-01-01T08:00:00Z").toLocaleDateString()),
    ).toBeInTheDocument();
  });

  it("renders asset selector and toggles asset callback", async () => {
    const onAssetToggle = jest.fn();
    render(
      <GitLabReleasesTab
        {...defaultProps}
        selectedRelease="v1.0.0"
        onAssetToggle={onAssetToggle}
      />,
    );

    expect(screen.getByText("downloads.gitlab.selectAssets")).toBeInTheDocument();
    expect(screen.getByText("cli-linux-x64.tar.gz")).toBeInTheDocument();
    expect(screen.getByText("package")).toBeInTheDocument();

    const checkboxes = screen.getAllByRole("checkbox");
    await userEvent.click(checkboxes[0]);
    expect(onAssetToggle).toHaveBeenCalledWith(
      expect.objectContaining({ id: 1, name: "cli-linux-x64.tar.gz" }),
    );
  });
});
