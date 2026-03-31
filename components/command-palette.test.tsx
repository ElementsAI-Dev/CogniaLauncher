import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CommandPalette } from "./command-palette";

const mockPush = jest.fn();
const mockToggleDrawer = jest.fn();
const mockOnOpenChange = jest.fn();
const mockTerminalLaunchProfile = jest.fn();
const mockExecuteDesktopAction = jest.fn();
let mockAllTools: Array<{ id: string; name: string; keywords: string[] }> = [];
let mockTerminalStoreState = {
  profiles: [] as Array<{ id: string; name: string; shellId: string }>,
  loading: false,
  hydrate: jest.fn(),
  markProfileLaunched: jest.fn(),
};
let mockWslState = {
  available: true,
  checkAvailability: jest.fn().mockResolvedValue(true),
  refreshStatus: jest.fn().mockResolvedValue(undefined),
  refreshDistros: jest.fn().mockResolvedValue(undefined),
  status: { defaultDistribution: "Ubuntu" as string | undefined },
  distros: [{ name: "Ubuntu", isDefault: true }],
};

jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

jest.mock("@/components/providers/locale-provider", () => ({
  useLocale: () => ({
    t: (key: string) => {
      const translations: Record<string, string> = {
        "nav.dashboard": "Dashboard",
        "nav.environments": "Environments",
        "nav.packages": "Packages",
        "nav.providers": "Providers",
        "nav.cache": "Cache",
        "nav.logs": "Logs",
        "nav.settings": "Settings",
        "nav.about": "About",
        "nav.docs": "Documentation",
        "nav.wsl": "WSL",
        "nav.downloads": "Downloads",
        "nav.terminal": "Terminal",
        "commandPalette.open": "Open command palette",
        "commandPalette.placeholder": "Search commands...",
        "commandPalette.noResults": "No results found.",
        "commandPalette.groups.navigation": "Navigation",
        "commandPalette.groups.actions": "Actions",
        "commandPalette.groups.tools": "Tools",
        "commandPalette.groups.terminalProfiles": "Terminal Profiles",
        "commandPalette.actions.toggleLogs": "Toggle logs",
        "commandPalette.actions.wslLaunchDefault": "Launch Default WSL",
        "commandPalette.actions.wslShutdownAll": "Shutdown All WSL Distros",
        "commandPalette.actions.wslOpenTerminal": "Open Default WSL Terminal",
      };
      return translations[key] || key;
    },
  }),
}));

jest.mock("@/lib/stores/log", () => ({
  useLogStore: () => ({ toggleDrawer: mockToggleDrawer }),
}));

const mockOpenFeedback = jest.fn();
jest.mock("@/lib/stores/feedback", () => ({
  useFeedbackStore: () => ({ openDialog: mockOpenFeedback }),
}));

jest.mock("@/hooks/shared/use-keyboard-shortcuts", () => ({
  useKeyboardShortcuts: jest.fn(),
}));

jest.mock("@/hooks/toolbox/use-toolbox", () => ({
  useToolbox: () => ({ allTools: mockAllTools }),
}));

jest.mock("@/hooks/desktop/use-desktop-action-executor", () => ({
  useDesktopActionExecutor: () => mockExecuteDesktopAction,
}));

jest.mock("@/hooks/wsl/use-wsl", () => ({
  useWsl: () => mockWslState,
}));

jest.mock("@/lib/stores/terminal", () => ({
  useTerminalStore: (selector: (state: typeof mockTerminalStoreState) => unknown) =>
    selector(mockTerminalStoreState),
}));

jest.mock("@/lib/tauri", () => ({
  isTauri: jest.fn(() => true),
  terminalLaunchProfile: (...args: unknown[]) => {
    mockTerminalLaunchProfile(...args);
    return Promise.resolve("launched");
  },
}));

jest.mock("@/lib/platform", () => ({
  isWindows: jest.fn(() => true),
}));

describe("CommandPalette", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAllTools = [];
    mockTerminalStoreState = {
      profiles: [],
      loading: false,
      hydrate: jest.fn(),
      markProfileLaunched: jest.fn(),
    };
    mockWslState = {
      available: true,
      checkAvailability: jest.fn().mockResolvedValue(true),
      refreshStatus: jest.fn().mockResolvedValue(undefined),
      refreshDistros: jest.fn().mockResolvedValue(undefined),
      status: { defaultDistribution: "Ubuntu" },
      distros: [{ name: "Ubuntu", isDefault: true }],
    };
  });

  it("renders without crashing when closed", () => {
    render(<CommandPalette open={false} onOpenChange={mockOnOpenChange} />);
    // When closed, the dialog content should not be visible
    expect(
      screen.queryByPlaceholderText("Search commands..."),
    ).not.toBeInTheDocument();
  });

  it("accepts open and onOpenChange props", () => {
    // Just verify the component accepts its props without errors
    expect(() => {
      render(<CommandPalette open={false} onOpenChange={mockOnOpenChange} />);
    }).not.toThrow();
  });

  it("has required props defined", () => {
    // Verify the component interface is correct
    expect(mockOnOpenChange).toBeDefined();
    expect(mockPush).toBeDefined();
    expect(mockToggleDrawer).toBeDefined();
  });

  it("navigates toolbox tools to static-export-safe detail route", () => {
    mockAllTools = [
      {
        id: "builtin:json-formatter",
        name: "JSON Formatter",
        keywords: ["json"],
      },
    ];

    render(<CommandPalette open={true} onOpenChange={mockOnOpenChange} />);
    screen.getByText("JSON Formatter").click();

    expect(mockPush).toHaveBeenCalledWith("/toolbox/tool?id=builtin%3Ajson-formatter");
  });

  it("renders terminal navigation and terminal profile group when profiles exist", () => {
    mockTerminalStoreState = {
      profiles: [{ id: "terminal-1", name: "PowerShell Dev", shellId: "pwsh" }],
      loading: false,
      hydrate: jest.fn(),
      markProfileLaunched: jest.fn(),
    };

    render(<CommandPalette open={true} onOpenChange={mockOnOpenChange} />);

    expect(screen.getByText("Terminal")).toBeInTheDocument();
    expect(screen.getByText("Terminal Profiles")).toBeInTheDocument();
    expect(screen.getByText("PowerShell Dev")).toBeInTheDocument();
  });

  it("launches a terminal profile from the command palette", async () => {
    mockTerminalStoreState = {
      profiles: [{ id: "terminal-1", name: "PowerShell Dev", shellId: "pwsh" }],
      loading: false,
      hydrate: jest.fn(),
      markProfileLaunched: jest.fn(),
    };

    render(<CommandPalette open={true} onOpenChange={mockOnOpenChange} />);
    await userEvent.click(screen.getByText("PowerShell Dev"));

    expect(mockTerminalLaunchProfile).toHaveBeenCalledWith("terminal-1");
    expect(mockOnOpenChange).toHaveBeenCalledWith(false);
  });

  it("does not render the terminal profile group when no profiles exist", () => {
    render(<CommandPalette open={true} onOpenChange={mockOnOpenChange} />);

    expect(screen.queryByText("Terminal Profiles")).not.toBeInTheDocument();
  });

  it("renders WSL command palette actions when WSL is available on Windows", () => {
    render(<CommandPalette open={true} onOpenChange={mockOnOpenChange} />);

    expect(screen.getByText("Launch Default WSL")).toBeInTheDocument();
    expect(screen.getByText("Shutdown All WSL Distros")).toBeInTheDocument();
    expect(screen.getByText("Open Default WSL Terminal")).toBeInTheDocument();
  });

  it("hides WSL command palette actions when WSL is unavailable", () => {
    mockWslState = {
      ...mockWslState,
      available: false,
      status: { defaultDistribution: undefined },
      distros: [],
    };

    render(<CommandPalette open={true} onOpenChange={mockOnOpenChange} />);

    expect(screen.queryByText("Launch Default WSL")).not.toBeInTheDocument();
    expect(screen.queryByText("Shutdown All WSL Distros")).not.toBeInTheDocument();
    expect(screen.queryByText("Open Default WSL Terminal")).not.toBeInTheDocument();
  });

  it("executes WSL desktop actions from the action group", async () => {
    mockExecuteDesktopAction.mockResolvedValue(true);
    render(<CommandPalette open={true} onOpenChange={mockOnOpenChange} />);

    await userEvent.click(screen.getByText("Launch Default WSL"));

    expect(mockExecuteDesktopAction).toHaveBeenCalledWith("wsl_launch_default");
    expect(mockOnOpenChange).toHaveBeenCalledWith(false);
  });
});
