import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// Mock MarkdownRenderer (react-markdown is ESM-only)
jest.mock("@/components/docs/markdown-renderer", () => ({
  MarkdownRenderer: ({ content }: { content: string }) => (
    <div data-testid="markdown-renderer">{content}</div>
  ),
}));

import { UpdateBanner } from "./update-banner";

const mockT = (key: string) => {
  const translations: Record<string, string> = {
    "about.updateAvailable": "Update Available",
    "about.updateBannerDesc": "A new version is available for download",
    "about.releaseNotes": "Release Notes",
    "about.downloadProgress": "Download progress",
    "about.installing": "Installing",
    "about.downloading": "Downloading",
    "about.updateDescription": "Update to the latest version",
    "about.updateDesktopOnly": "Updates are only available on desktop",
    "common.update": "Update",
  };
  return translations[key] || key;
};

const updateInfo = {
  update_available: true,
  current_version: "1.0.0",
  latest_version: "1.1.0",
  release_notes: "Bug fixes and improvements",
};

const defaultProps = {
  updateInfo,
  updating: false,
  updateProgress: 0,
  updateStatus: "idle" as const,
  isDesktop: true,
  onUpdate: jest.fn(),
  t: mockT,
};

describe("UpdateBanner", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns null when updateInfo is null", () => {
    const { container } = render(
      <UpdateBanner {...defaultProps} updateInfo={null} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("returns null when update is not available", () => {
    const { container } = render(
      <UpdateBanner
        {...defaultProps}
        updateInfo={{ ...updateInfo, update_available: false }}
      />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders update available alert", () => {
    render(<UpdateBanner {...defaultProps} />);
    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.getByText(/Update Available/)).toBeInTheDocument();
    expect(screen.getByText(/v1.1.0/)).toBeInTheDocument();
  });

  it("renders release notes when present", () => {
    render(<UpdateBanner {...defaultProps} />);
    expect(screen.getByText("Bug fixes and improvements")).toBeInTheDocument();
  });

  it("renders progress bar when updating", () => {
    render(
      <UpdateBanner
        {...defaultProps}
        updating={true}
        updateProgress={50}
        updateStatus="downloading"
      />,
    );
    expect(screen.getByLabelText("Download progress")).toBeInTheDocument();
    expect(screen.getByText(/50%/)).toBeInTheDocument();
  });

  it("shows installing status text", () => {
    render(
      <UpdateBanner
        {...defaultProps}
        updating={true}
        updateProgress={80}
        updateStatus="installing"
      />,
    );
    expect(screen.getByText(/Installing/)).toBeInTheDocument();
  });

  it("calls onUpdate when update button is clicked", async () => {
    render(<UpdateBanner {...defaultProps} />);
    await userEvent.click(screen.getByText("Update"));
    expect(defaultProps.onUpdate).toHaveBeenCalledTimes(1);
  });

  it("disables update button when updating", () => {
    render(<UpdateBanner {...defaultProps} updating={true} />);
    expect(screen.getByText("Downloading").closest("button")).toBeDisabled();
  });

  it("disables update button when not desktop", () => {
    render(<UpdateBanner {...defaultProps} isDesktop={false} />);
    expect(screen.getByText("Update").closest("button")).toBeDisabled();
  });

  it("does not render release notes area when release_notes is null", () => {
    render(
      <UpdateBanner
        {...defaultProps}
        updateInfo={{ ...updateInfo, release_notes: null }}
      />,
    );
    expect(screen.queryByTestId("markdown-renderer")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Release Notes")).not.toBeInTheDocument();
  });

  it("shows ellipsis when progress is 0 during download", () => {
    render(
      <UpdateBanner
        {...defaultProps}
        updating={true}
        updateProgress={0}
        updateStatus="downloading"
      />,
    );
    expect(screen.getByText(/\.\.\./)).toBeInTheDocument();
  });

  it("renders description text", () => {
    render(<UpdateBanner {...defaultProps} />);
    expect(
      screen.getByText("A new version is available for download"),
    ).toBeInTheDocument();
  });
});
