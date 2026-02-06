import { render, screen } from "@testing-library/react";
import { LogProvider } from "./log-provider";

jest.mock("@/lib/tauri", () => ({
  isTauri: () => false,
  listenEnvInstallProgress: jest.fn(),
  listenBatchProgress: jest.fn(),
  listenCommandOutput: jest.fn(),
  listenDownloadTaskAdded: jest.fn(),
  listenDownloadTaskStarted: jest.fn(),
  listenDownloadTaskCompleted: jest.fn(),
  listenDownloadTaskFailed: jest.fn(),
  listenDownloadTaskPaused: jest.fn(),
  listenDownloadTaskResumed: jest.fn(),
  listenDownloadTaskCancelled: jest.fn(),
  listenSelfUpdateProgress: jest.fn(),
  listenUpdateCheckProgress: jest.fn(),
}));

jest.mock("@/components/providers/locale-provider", () => ({
  useLocale: () => ({
    t: (key: string) => key,
  }),
}));

const mockAddLog = jest.fn();

jest.mock("@/lib/stores/log", () => ({
  useLogStore: () => ({
    addLog: mockAddLog,
  }),
}));

describe("LogProvider", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders children", () => {
    render(
      <LogProvider>
        <div data-testid="child">Child content</div>
      </LogProvider>,
    );

    expect(screen.getByTestId("child")).toBeInTheDocument();
  });

  it("provides log context to children", () => {
    render(
      <LogProvider>
        <div>Test</div>
      </LogProvider>,
    );

    expect(screen.getByText("Test")).toBeInTheDocument();
  });
});
