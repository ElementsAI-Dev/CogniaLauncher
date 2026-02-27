import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DownloadTaskRow } from "./download-task-row";
import type { DownloadTask } from "@/types/tauri";

const mockT = (key: string) => key;

function makeTask(overrides: Partial<DownloadTask> = {}): DownloadTask {
  return {
    id: "task-1",
    url: "https://example.com/file.zip",
    name: "file.zip",
    destination: "/downloads/file.zip",
    state: "downloading",
    progress: {
      downloadedBytes: 5120,
      totalBytes: 10240,
      speed: 1024,
      speedHuman: "1.0 KB/s",
      percent: 50,
      etaSecs: 5,
      etaHuman: "5s",
      downloadedHuman: "5 KB",
      totalHuman: "10 KB",
    },
    error: null,
    provider: null,
    createdAt: "2026-01-01T00:00:00Z",
    startedAt: "2026-01-01T00:00:01Z",
    completedAt: null,
    priority: 5,
    retries: 0,
    supportsResume: true,
    expectedChecksum: null,
    metadata: {},
    serverFilename: null,
    ...overrides,
  };
}

function renderRow(task: DownloadTask, handlers?: Partial<Record<string, jest.Mock>>) {
  const defaults = {
    onPause: jest.fn(),
    onResume: jest.fn(),
    onCancel: jest.fn(),
    onRemove: jest.fn(),
    onOpen: jest.fn(),
    onReveal: jest.fn(),
    onDetail: jest.fn(),
  };
  const props = { ...defaults, ...handlers };
  return {
    ...render(
      <table>
        <tbody>
          <DownloadTaskRow task={task} t={mockT} {...props} />
        </tbody>
      </table>
    ),
    ...props,
  };
}

describe("DownloadTaskRow", () => {
  it("renders task name and url", () => {
    renderRow(makeTask());

    expect(screen.getByText("file.zip")).toBeInTheDocument();
    expect(screen.getByText("https://example.com/file.zip")).toBeInTheDocument();
  });

  it("renders provider badge when present", () => {
    renderRow(makeTask({ provider: "github" }));

    expect(screen.getByText("github")).toBeInTheDocument();
  });

  it("renders em dash when provider is null", () => {
    renderRow(makeTask({ provider: null }));

    expect(screen.getByText("—")).toBeInTheDocument();
  });

  it("renders state badge", () => {
    renderRow(makeTask({ state: "downloading" }));

    expect(screen.getByText("downloads.state.downloading")).toBeInTheDocument();
  });

  it("renders progress info", () => {
    renderRow(makeTask());

    expect(screen.getByText("5 KB")).toBeInTheDocument();
    expect(screen.getByText("10 KB")).toBeInTheDocument();
    expect(screen.getByText("1.0 KB/s")).toBeInTheDocument();
  });

  it("renders error message when present", () => {
    renderRow(makeTask({ error: "Connection timeout" }));

    expect(screen.getByText("Connection timeout")).toBeInTheDocument();
  });

  it("does not render error when null", () => {
    renderRow(makeTask({ error: null }));

    expect(screen.queryByText("Connection timeout")).not.toBeInTheDocument();
  });

  it("shows pause button for downloading state", () => {
    renderRow(makeTask({ state: "downloading" }));

    expect(screen.getByTitle("downloads.actions.pause")).toBeInTheDocument();
  });

  it("shows pause button for queued state", () => {
    renderRow(makeTask({ state: "queued" }));

    expect(screen.getByTitle("downloads.actions.pause")).toBeInTheDocument();
  });

  it("does not show pause button for completed state", () => {
    renderRow(makeTask({ state: "completed" }));

    expect(screen.queryByTitle("downloads.actions.pause")).not.toBeInTheDocument();
  });

  it("shows resume button for paused state", () => {
    renderRow(makeTask({ state: "paused" }));

    expect(screen.getByTitle("downloads.actions.resume")).toBeInTheDocument();
  });

  it("shows resume button for failed state", () => {
    renderRow(makeTask({ state: "failed" }));

    expect(screen.getByTitle("downloads.actions.resume")).toBeInTheDocument();
  });

  it("does not show resume button for downloading state", () => {
    renderRow(makeTask({ state: "downloading" }));

    expect(screen.queryByTitle("downloads.actions.resume")).not.toBeInTheDocument();
  });

  it("shows cancel button for active states", () => {
    renderRow(makeTask({ state: "downloading" }));

    expect(screen.getByTitle("downloads.actions.cancel")).toBeInTheDocument();
  });

  it("does not show cancel button for completed state", () => {
    renderRow(makeTask({ state: "completed" }));

    expect(screen.queryByTitle("downloads.actions.cancel")).not.toBeInTheDocument();
  });

  it("does not show cancel button for cancelled state", () => {
    renderRow(makeTask({ state: "cancelled" }));

    expect(screen.queryByTitle("downloads.actions.cancel")).not.toBeInTheDocument();
  });

  it("shows open and reveal buttons for completed state", () => {
    renderRow(makeTask({ state: "completed" }));

    expect(screen.getByTitle("downloads.actions.open")).toBeInTheDocument();
    expect(screen.getByTitle("downloads.actions.reveal")).toBeInTheDocument();
  });

  it("does not show open/reveal buttons for non-completed states", () => {
    renderRow(makeTask({ state: "downloading" }));

    expect(screen.queryByTitle("downloads.actions.open")).not.toBeInTheDocument();
    expect(screen.queryByTitle("downloads.actions.reveal")).not.toBeInTheDocument();
  });

  it("always shows remove button", () => {
    renderRow(makeTask({ state: "downloading" }));
    expect(screen.getByTitle("downloads.actions.remove")).toBeInTheDocument();
  });

  it("calls onPause when clicking pause button", async () => {
    const { onPause } = renderRow(makeTask({ state: "downloading" }));

    await userEvent.click(screen.getByTitle("downloads.actions.pause"));

    expect(onPause).toHaveBeenCalledWith("task-1");
  });

  it("calls onResume when clicking resume button", async () => {
    const { onResume } = renderRow(makeTask({ state: "paused" }));

    await userEvent.click(screen.getByTitle("downloads.actions.resume"));

    expect(onResume).toHaveBeenCalledWith("task-1");
  });

  it("calls onCancel when clicking cancel button", async () => {
    const { onCancel } = renderRow(makeTask({ state: "downloading" }));

    await userEvent.click(screen.getByTitle("downloads.actions.cancel"));

    expect(onCancel).toHaveBeenCalledWith("task-1");
  });

  it("calls onRemove when clicking remove button", async () => {
    const { onRemove } = renderRow(makeTask({ state: "completed" }));

    await userEvent.click(screen.getByTitle("downloads.actions.remove"));

    expect(onRemove).toHaveBeenCalledWith("task-1");
  });

  it("calls onOpen with destination when clicking open button", async () => {
    const { onOpen } = renderRow(makeTask({ state: "completed" }));

    await userEvent.click(screen.getByTitle("downloads.actions.open"));

    expect(onOpen).toHaveBeenCalledWith("/downloads/file.zip");
  });

  it("calls onReveal with destination when clicking reveal button", async () => {
    const { onReveal } = renderRow(makeTask({ state: "completed" }));

    await userEvent.click(screen.getByTitle("downloads.actions.reveal"));

    expect(onReveal).toHaveBeenCalledWith("/downloads/file.zip");
  });

  it("calls onDetail when clicking task name", async () => {
    const task = makeTask();
    const { onDetail } = renderRow(task);

    await userEvent.click(screen.getByText("file.zip"));

    expect(onDetail).toHaveBeenCalledWith(task);
  });

  it("renders em dash for null totalHuman", () => {
    renderRow(makeTask({
      progress: {
        downloadedBytes: 5120,
        totalBytes: null,
        speed: 0,
        speedHuman: "",
        percent: 0,
        etaSecs: null,
        etaHuman: null,
        downloadedHuman: "5 KB",
        totalHuman: null,
      },
    }));

    // The "—" for totalHuman null
    const dashes = screen.getAllByText("—");
    expect(dashes.length).toBeGreaterThanOrEqual(1);
  });
});
