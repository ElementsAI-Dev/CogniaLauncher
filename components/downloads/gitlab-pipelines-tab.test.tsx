import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { GitLabPipelinesTab } from "./gitlab-pipelines-tab";
import type { GitLabPipelineInfo, GitLabJobInfo } from "@/types/gitlab";

const mockUseAssetMatcher = jest.fn();

jest.mock("@/hooks/downloads/use-asset-matcher", () => ({
  useAssetMatcher: () => mockUseAssetMatcher(),
  getPlatformLabel: (platform: string) =>
    ({
      windows: "Windows",
      linux: "Linux",
      macos: "macOS",
    }[platform] ?? ""),
  getArchLabel: (arch: string) =>
    ({
      x64: "x64",
      arm64: "ARM64",
      x86: "x86",
      universal: "Universal",
    }[arch] ?? ""),
}));

beforeAll(() => {
  global.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
});

describe("GitLabPipelinesTab", () => {
  const pipelines: GitLabPipelineInfo[] = [
    {
      id: 101,
      refName: "main",
      status: "success",
      source: "push",
      createdAt: null,
      webUrl: null,
    },
  ];

  const jobs: GitLabJobInfo[] = [
    {
      id: 201,
      name: "build-windows-x64",
      stage: "build",
      status: "success",
      refName: "main",
      hasArtifacts: true,
      webUrl: null,
      finishedAt: null,
    },
    {
      id: 202,
      name: "lint",
      stage: "check",
      status: "failed",
      refName: "main",
      hasArtifacts: false,
      webUrl: null,
      finishedAt: null,
    },
  ];

  const defaultProps = {
    pipelines,
    selectedPipelineId: null as number | null,
    onSelectPipeline: jest.fn(),
    jobs,
    selectedJobs: [] as GitLabJobInfo[],
    onToggleJob: jest.fn(),
    jobsLoading: false,
    onRefresh: jest.fn().mockResolvedValue(undefined),
    t: (key: string) => key,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockUseAssetMatcher.mockReturnValue({
      currentPlatform: "windows",
      currentArch: "x64",
    });
  });

  it("renders empty pipelines message", () => {
    render(
      <GitLabPipelinesTab
        {...defaultProps}
        pipelines={[]}
      />,
    );

    expect(screen.getByText("downloads.gitlab.noPipelines")).toBeInTheDocument();
  });

  it("calls onRefresh when refresh button is clicked", async () => {
    const onRefresh = jest.fn().mockResolvedValue(undefined);
    render(
      <GitLabPipelinesTab
        {...defaultProps}
        onRefresh={onRefresh}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: "common.refresh" }));
    expect(onRefresh).toHaveBeenCalled();
  });

  it("calls onSelectPipeline and reflects selected state", async () => {
    const onSelectPipeline = jest.fn();
    const { rerender } = render(
      <GitLabPipelinesTab
        {...defaultProps}
        selectedPipelineId={null}
        onSelectPipeline={onSelectPipeline}
      />,
    );

    const pipelineButton = screen.getByRole("button", { name: /#101/i });
    expect(pipelineButton).toHaveAttribute("aria-pressed", "false");
    await userEvent.click(pipelineButton);
    expect(onSelectPipeline).toHaveBeenCalledWith(101);

    rerender(
      <GitLabPipelinesTab
        {...defaultProps}
        selectedPipelineId={101}
        onSelectPipeline={onSelectPipeline}
      />,
    );
    expect(screen.getByRole("button", { name: /#101/i })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("shows jobs loading skeletons", () => {
    const { container } = render(
      <GitLabPipelinesTab
        {...defaultProps}
        jobsLoading={true}
      />,
    );

    expect(container.querySelectorAll(".h-10").length).toBeGreaterThanOrEqual(3);
  });

  it("shows pipeline hint before selecting one", () => {
    render(
      <GitLabPipelinesTab
        {...defaultProps}
        selectedPipelineId={null}
      />,
    );

    expect(screen.getByText("downloads.gitlab.selectPipeline")).toBeInTheDocument();
  });

  it("shows no-jobs message for selected pipeline with empty jobs", () => {
    render(
      <GitLabPipelinesTab
        {...defaultProps}
        selectedPipelineId={101}
        jobs={[]}
      />,
    );

    expect(screen.getByText("downloads.gitlab.noJobs")).toBeInTheDocument();
  });

  it("toggles artifact job selection and keeps non-artifact jobs disabled", async () => {
    const onToggleJob = jest.fn();
    render(
      <GitLabPipelinesTab
        {...defaultProps}
        selectedPipelineId={101}
        onToggleJob={onToggleJob}
      />,
    );

    const checkboxes = screen.getAllByRole("checkbox");
    expect(checkboxes[0]).not.toBeDisabled();
    expect(checkboxes[1]).toBeDisabled();

    await userEvent.click(checkboxes[0]);
    expect(onToggleJob).toHaveBeenCalledWith(
      expect.objectContaining({ id: 201, name: "build-windows-x64" }),
    );

    expect(screen.getByText("downloads.gitlab.downloadArtifacts")).toBeInTheDocument();
    expect(screen.getByText("common.none")).toBeInTheDocument();
  });

  it("shows recommended platform cues for matching pipeline artifacts", () => {
    render(
      <GitLabPipelinesTab
        {...defaultProps}
        selectedPipelineId={101}
      />,
    );

    expect(screen.getByText("downloads.gitlab.recommended")).toBeInTheDocument();
    expect(screen.getByText("Windows")).toBeInTheDocument();
    expect(screen.getAllByText("x64").length).toBeGreaterThan(0);
  });
});
