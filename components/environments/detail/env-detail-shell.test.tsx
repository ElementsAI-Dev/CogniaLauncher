import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { EnvDetailShell } from "./env-detail-shell";

const mockExecShellWithEnv = jest.fn();
const mockGetActivationScript = jest.fn();
const mockGetEnvInfo = jest.fn();
const mockWhichProgram = jest.fn();
const mockClearOutput = jest.fn();

jest.mock("@/hooks/use-launch", () => ({
  useLaunch: () => ({
    loading: false,
    error: null,
    lastResult: null,
    streamingOutput: [],
    execShellWithEnv: mockExecShellWithEnv,
    getActivationScript: mockGetActivationScript,
    getEnvInfo: mockGetEnvInfo,
    whichProgram: mockWhichProgram,
    clearOutput: mockClearOutput,
  }),
}));

jest.mock("@/lib/clipboard", () => ({
  writeClipboard: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("sonner", () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
  },
}));

let mockIsTauriValue = true;
jest.mock("@/lib/tauri", () => ({
  isTauri: () => mockIsTauriValue,
}));

describe("EnvDetailShell", () => {
  const mockT = (key: string, params?: Record<string, string | number>) => {
    const translations: Record<string, string> = {
      "environments.shell.desktopOnly": "Desktop App Required",
      "environments.shell.desktopOnlyDesc": "This feature requires the desktop app",
      "environments.shell.executeTitle": "Quick Execute",
      "environments.shell.executeDesc": `Run commands in ${params?.envType || ""} environment`,
      "environments.shell.commandPlaceholder": "Enter command...",
      "environments.shell.run": "Run",
      "environments.shell.runningWith": `Running with ${params?.envType || ""} ${params?.version || ""}`,
      "environments.shell.output": "Output",
      "environments.shell.whichTitle": "Which Program",
      "environments.shell.whichDesc": "Find program location",
      "environments.shell.whichPlaceholder": "Program name...",
      "environments.shell.lookup": "Lookup",
      "environments.shell.notFound": "Not found",
      "environments.shell.activationScript": "Activation Script",
      "environments.shell.loadScript": "Load Script",
      "environments.shell.envInfoTitle": "Environment Info",
      "environments.shell.loadEnvInfo": "Load Environment Info",
      "common.copied": "Copied",
      "common.copyFailed": "Copy failed",
    };
    return translations[key] || key;
  };

  const defaultProps = {
    envType: "node",
    currentVersion: "18.0.0",
    t: mockT,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockIsTauriValue = true;
    mockExecShellWithEnv.mockResolvedValue(null);
  });

  it("shows desktop-only message when not in Tauri", () => {
    mockIsTauriValue = false;
    render(<EnvDetailShell {...defaultProps} />);
    expect(screen.getByText("Desktop App Required")).toBeInTheDocument();
    expect(screen.getByText("This feature requires the desktop app")).toBeInTheDocument();
  });

  it("renders execute section in Tauri mode", () => {
    render(<EnvDetailShell {...defaultProps} />);
    expect(screen.getByText("Quick Execute")).toBeInTheDocument();
  });

  it("renders command input and run button", () => {
    render(<EnvDetailShell {...defaultProps} />);
    expect(screen.getByPlaceholderText("Enter command...")).toBeInTheDocument();
    expect(screen.getByText("Run")).toBeInTheDocument();
  });

  it("disables run button when command is empty", () => {
    render(<EnvDetailShell {...defaultProps} />);
    const runBtn = screen.getByText("Run").closest("button");
    expect(runBtn).toBeDisabled();
  });

  it("enables run button when command is entered", async () => {
    const user = userEvent.setup();
    render(<EnvDetailShell {...defaultProps} />);
    await user.type(screen.getByPlaceholderText("Enter command..."), "node -v");
    const runBtn = screen.getByText("Run").closest("button");
    expect(runBtn).not.toBeDisabled();
  });

  it("calls execShellWithEnv when run is clicked", async () => {
    const user = userEvent.setup();
    render(<EnvDetailShell {...defaultProps} />);
    await user.type(screen.getByPlaceholderText("Enter command..."), "node -v");
    await user.click(screen.getByText("Run"));

    await waitFor(() => {
      expect(mockExecShellWithEnv).toHaveBeenCalledWith("node -v", "node", "18.0.0");
    });
  });

  it("renders which program section", () => {
    render(<EnvDetailShell {...defaultProps} />);
    expect(screen.getByText("Which Program")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Program name...")).toBeInTheDocument();
  });

  it("calls whichProgram when lookup is clicked", async () => {
    mockWhichProgram.mockResolvedValue("/usr/local/bin/node");
    const user = userEvent.setup();
    render(<EnvDetailShell {...defaultProps} />);
    await user.type(screen.getByPlaceholderText("Program name..."), "node");
    await user.click(screen.getByText("Lookup"));

    await waitFor(() => {
      expect(mockWhichProgram).toHaveBeenCalledWith("node", "node", "18.0.0");
    });
  });

  it("renders activation script section", () => {
    render(<EnvDetailShell {...defaultProps} />);
    expect(screen.getByText("Activation Script")).toBeInTheDocument();
    expect(screen.getByText("Load Script")).toBeInTheDocument();
  });

  it("loads activation script when button is clicked", async () => {
    mockGetActivationScript.mockResolvedValue({ script: "export PATH=/node/bin:$PATH" });
    const user = userEvent.setup();
    render(<EnvDetailShell {...defaultProps} />);
    await user.click(screen.getByText("Load Script"));

    await waitFor(() => {
      expect(mockGetActivationScript).toHaveBeenCalledWith("node", "18.0.0");
      expect(screen.getByText("export PATH=/node/bin:$PATH")).toBeInTheDocument();
    });
  });

  it("renders env info section", () => {
    render(<EnvDetailShell {...defaultProps} />);
    expect(screen.getByText("Environment Info")).toBeInTheDocument();
    expect(screen.getByText("Load Environment Info")).toBeInTheDocument();
  });

  it("shows running with version info", () => {
    render(<EnvDetailShell {...defaultProps} />);
    expect(screen.getByText("Running with node 18.0.0")).toBeInTheDocument();
  });

  it("renders without currentVersion", () => {
    render(<EnvDetailShell envType="node" currentVersion={null} t={mockT} />);
    expect(screen.getByText("Quick Execute")).toBeInTheDocument();
    // Load env info button should be disabled
    const loadEnvBtn = screen.getByText("Load Environment Info").closest("button");
    expect(loadEnvBtn).toBeDisabled();
  });
});
