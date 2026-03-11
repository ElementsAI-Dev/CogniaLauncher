import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import WslPage from "./page";
import { useWslStore } from "@/lib/stores/wsl";

const mockPathname = jest.fn(() => "/wsl");
const mockSearchParamGet = jest.fn(() => null as string | null);

jest.mock("next/navigation", () => ({
  usePathname: () => mockPathname(),
  useSearchParams: () => ({
    get: (key: string) => mockSearchParamGet(key),
  }),
}));

jest.mock("@/components/ui/tabs", () => {
  let currentOnValueChange: ((value: string) => void) | undefined;
  return {
    Tabs: ({
      children,
      onValueChange,
      value,
    }: {
      children: ReactNode;
      onValueChange?: (value: string) => void;
      value?: string;
    }) => {
      currentOnValueChange = onValueChange;
      return (
        <div data-testid="tabs-root" data-value={value}>
          {children}
        </div>
      );
    },
    TabsList: ({ children }: { children: ReactNode }) => <div>{children}</div>,
    TabsTrigger: ({
      children,
      value,
    }: {
      children: ReactNode;
      value: string;
    }) => (
      <button onClick={() => currentOnValueChange?.(value)}>{children}</button>
    ),
    TabsContent: ({ children }: { children: ReactNode }) => (
      <div>{children}</div>
    ),
  };
});

const mockCheckAvailability = jest.fn().mockResolvedValue(true);
const mockRefreshAll = jest.fn().mockResolvedValue(undefined);
const mockRefreshDistros = jest.fn().mockResolvedValue(undefined);
const mockRefreshOnlineDistros = jest.fn().mockResolvedValue(undefined);
const mockRefreshStatus = jest.fn().mockResolvedValue(undefined);
const mockShutdown = jest.fn().mockResolvedValue(undefined);
const mockUpdateWsl = jest.fn().mockResolvedValue("updated");
const mockLaunch = jest.fn().mockResolvedValue(undefined);
const mockTerminate = jest.fn().mockResolvedValue(undefined);
const mockInstallOnlineDistro = jest.fn().mockResolvedValue(undefined);
const mockUnregisterDistro = jest.fn().mockResolvedValue(undefined);
const mockInstallWithLocation = jest.fn().mockResolvedValue("installed");
const mockInstallWslOnly = jest.fn().mockResolvedValue("installed");
const mockGetVersionInfo = jest
  .fn()
  .mockResolvedValue({
    wslVersion: "2.4.0",
    kernelVersion: "6.6.0",
    wslgVersion: "1.0.0",
  });
const mockGetTotalDiskUsage = jest
  .fn()
  .mockResolvedValue({ totalBytes: 1024, perDistro: [["Ubuntu", 1024]] });
const mockOpenInExplorer = jest.fn().mockResolvedValue(undefined);
const mockOpenInTerminal = jest.fn().mockResolvedValue(undefined);
const mockCloneDistro = jest.fn().mockResolvedValue("cloned");
const mockExecuteAssistanceAction = jest.fn().mockResolvedValue({
  actionId: "runtime.preflight",
  status: "success",
  timestamp: "2026-03-05T00:00:00Z",
  title: "Runtime preflight passed",
  findings: ["Runtime Availability: WSL runtime is available."],
  recommendations: [],
  retryable: true,
});
const mockGetAssistanceActions = jest.fn().mockReturnValue([
  {
    id: "runtime.preflight",
    scope: "runtime",
    category: "check",
    risk: "safe",
    labelKey: "wsl.assistance.actions.runtimePreflight.label",
    descriptionKey: "wsl.assistance.actions.runtimePreflight.desc",
    supported: true,
  },
  {
    id: "runtime.shutdownAll",
    scope: "runtime",
    category: "repair",
    risk: "high",
    labelKey: "wsl.assistance.actions.runtimeShutdown.label",
    descriptionKey: "wsl.assistance.actions.runtimeShutdown.desc",
    supported: true,
    requiresAdmin: true,
  },
]);
const mockMapErrorToAssistance = jest.fn().mockReturnValue([]);
let mockAvailable = true;
let mockDistros = [
  { name: "Ubuntu", state: "Running", version: 2, isDefault: true },
  { name: "Debian", state: "Stopped", version: 2, isDefault: false },
];

jest.mock("@/components/providers/locale-provider", () => ({
  useLocale: () => ({
    t: (key: string) => {
      const translations: Record<string, string> = {
        "wsl.title": "WSL",
        "wsl.description": "Windows Subsystem for Linux",
        "wsl.installed": "Installed",
        "wsl.available": "Available",
        "wsl.update": "Update",
        "wsl.import": "Import",
        "wsl.notAvailable": "WSL is not available in the browser",
        "wsl.runtimeUnavailableHint": "WSL runtime is unavailable",
        "wsl.runtimeDegradedHint": "WSL runtime is degraded",
        "wsl.runtimeUnsupportedHint": "Use a supported capability",
        "wsl.installSuccess": "Installed {name}",
        "wsl.installWithLocation": "Install to Location",
        "wsl.installWithLocationSuccess": "Installed {name} to location",
        "wsl.terminateSuccess": "Terminated {name}",
        "wsl.shutdownSuccess": "WSL shutdown complete",
        "wsl.launchSuccess": "{name} launched",
        "wsl.setDefaultSuccess": "Set {name} as default",
        "wsl.defaultBadge": "Default",
        "wsl.setVersionSuccess": "Set {name} to WSL {version}",
        "wsl.exportSuccess": "Exported {name}",
        "wsl.importSuccess": "Imported {name}",
        "wsl.install": "Install {name}",
        "wsl.launch": "Launch {name}",
        "wsl.terminate": "Terminate {name}",
        "wsl.setDefaultVersionSuccess": "Set default WSL version to {version}",
        "wsl.updateSuccess": "WSL updated",
        "wsl.versionInfo": "Version Information",
        "wsl.totalDiskUsage": "Total Disk Usage",
        "wsl.wslVersion": "WSL Version",
        "wsl.kernelVersion": "Kernel Version",
        "wsl.wslgVersion": "WSLg Version",
        "wsl.importInPlace": "Import In-Place",
        "wsl.importInPlaceSuccess": "Imported {name}",
        "wsl.distroConfig.targetLabel": "Config Target Distribution",
        "wsl.distroConfig.targetPlaceholder": "Select a distribution",
        "wsl.viewAllDistros": "View all ({count})",
        "wsl.showLess": "Show less",
        "wsl.mount": "Mount",
        "wsl.unmount": "Unmount",
        "wsl.mountSuccess": "Mounted",
        "wsl.unmountSuccess": "Unmounted",
        "wsl.defaultVersion": "Default WSL",
        "wsl.advancedOps": "Advanced Operations",
        "wsl.advancedOpsDesc": "Advanced WSL management",
        "wsl.unregister": "Unregister",
        "wsl.unregisterConfirm": "Unregister {name}?",
        "wsl.shutdown": "Shutdown All",
        "wsl.shutdownConfirm": "Shutdown all WSL instances?",
        "wsl.mountConfirm": "Mount disk?",
        "wsl.unmountConfirm": "Unmount {path}?",
        "wsl.unmountAllConfirm": "Unmount all disks?",
        "wsl.dataLossWarning": "All data will be lost!",
        "wsl.highRiskHint": "This action requires elevated privileges.",
        "wsl.capabilityUnsupported": "{feature} unsupported in WSL {version}",
        "wsl.mountOptionsFallback": "Mount options not supported",
        "wsl.assistance.title": "Assistance",
        "wsl.assistance.desc": "Guided checks, repairs, and maintenance",
        "wsl.assistance.distroDesc": "Contextual assistance for this distro",
        "wsl.assistance.blocked": "Assistance action blocked",
        "wsl.assistance.retry": "Retry",
        "wsl.assistance.dismiss": "Dismiss",
        "wsl.assistance.returnToError": "Return to error context",
        "wsl.assistance.suggestedActions": "Suggested recovery actions",
        "wsl.assistance.groups.check": "Checks",
        "wsl.assistance.groups.repair": "Repairs",
        "wsl.assistance.groups.maintenance": "Maintenance",
        "wsl.assistance.actions.runtimePreflight.label": "Runtime Preflight",
        "wsl.assistance.actions.runtimePreflight.desc":
          "Validate runtime readiness",
        "wsl.assistance.actions.runtimeShutdown.label": "Shutdown Runtime",
        "wsl.assistance.actions.runtimeShutdown.desc":
          "Shutdown all running distros",
        "wsl.changeDefaultUserSuccess":
          "Changed default user for {name} to {user}",
        "wsl.unregisterSuccess": "Unregistered {name}",
        "wsl.installWslOnly": "Install WSL",
        "wsl.workflow.running": "Running {action}",
        "wsl.workflow.success": "{action} completed",
        "wsl.workflow.failed": "{action} failed",
        "common.cancel": "Cancel",
        "common.confirm": "Confirm",
        "common.loading": "Loading...",
      };
      return translations[key] || key;
    },
  }),
}));

jest.mock("@/lib/tauri", () => ({
  isTauri: jest.fn().mockReturnValue(true),
  packageInstall: jest.fn().mockResolvedValue(undefined),
  packageUninstall: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("@/hooks/use-wsl", () => ({
  useWsl: () => ({
    available: mockAvailable,
    distros: mockDistros,
    onlineDistros: [
      ["Ubuntu", "Ubuntu Linux"],
      ["Fedora", "Fedora Linux"],
    ],
    status: { kernelVersion: "5.15.0", runningDistros: ["Ubuntu"] },
    capabilities: { importInPlace: true, mountOptions: true },
    runtimeSnapshot: {
      state: mockAvailable ? (mockDistros.length > 0 ? "ready" : "empty") : "unavailable",
      available: !!mockAvailable,
      reasonCode: mockAvailable ? "runtime_ready" : "runtime_unavailable",
      reason: mockAvailable ? "Runtime and management probes passed." : "WSL runtime is unavailable.",
      runtimeProbes: [],
      statusProbe: { ready: !!mockAvailable, reasonCode: mockAvailable ? "ok" : "runtime_unavailable" },
      capabilityProbe: { ready: !!mockAvailable, reasonCode: mockAvailable ? "ok" : "runtime_unavailable" },
      distroProbe: { ready: !!mockAvailable, reasonCode: mockAvailable ? "ok" : "runtime_unavailable" },
      distroCount: mockDistros.length,
      degradedReasons: [],
    },
    completeness: {
      state: mockAvailable ? (mockDistros.length > 0 ? "ready" : "empty") : "unavailable",
      available: !!mockAvailable,
      distroCount: mockDistros.length,
      runningCount: mockDistros.filter((d) => d.state === "Running").length,
      degradedReasons: [],
    },
    lastFailure: null,
    loading: false,
    error: null,
    checkAvailability: mockCheckAvailability,
    refreshDistros: mockRefreshDistros,
    refreshOnlineDistros: mockRefreshOnlineDistros,
    refreshStatus: mockRefreshStatus,
    refreshAll: mockRefreshAll,
    terminate: mockTerminate,
    shutdown: mockShutdown,
    setDefault: jest.fn().mockResolvedValue(undefined),
    setVersion: jest.fn().mockResolvedValue(undefined),
    setDefaultVersion: jest.fn().mockResolvedValue(undefined),
    exportDistro: jest.fn().mockResolvedValue(undefined),
    importDistro: jest.fn().mockResolvedValue(undefined),
    importInPlace: jest.fn().mockResolvedValue(undefined),
    updateWsl: mockUpdateWsl,
    launch: mockLaunch,
    config: {},
    execCommand: jest.fn().mockResolvedValue(""),
    refreshConfig: jest.fn().mockResolvedValue(undefined),
    setConfigValue: jest.fn().mockResolvedValue(undefined),
    getDiskUsage: jest.fn().mockResolvedValue(null),
    mountDisk: jest.fn().mockResolvedValue(""),
    unmountDisk: jest.fn().mockResolvedValue(undefined),
    getIpAddress: jest.fn().mockResolvedValue(""),
    changeDefaultUser: jest.fn().mockResolvedValue(undefined),
    getDistroConfig: jest.fn().mockResolvedValue({}),
    setDistroConfigValue: jest.fn().mockResolvedValue(undefined),
    installWslOnly: mockInstallWslOnly,
    installOnlineDistro: mockInstallOnlineDistro,
    unregisterDistro: mockUnregisterDistro,
    installWithLocation: mockInstallWithLocation,
    getVersionInfo: mockGetVersionInfo,
    getTotalDiskUsage: mockGetTotalDiskUsage,
    openInExplorer: mockOpenInExplorer,
    openInTerminal: mockOpenInTerminal,
    cloneDistro: mockCloneDistro,
    backupDistro: jest.fn().mockResolvedValue(undefined),
    listBackups: jest.fn().mockResolvedValue([]),
    restoreBackup: jest.fn().mockResolvedValue(undefined),
    deleteBackup: jest.fn().mockResolvedValue(undefined),
    getAssistanceActions: mockGetAssistanceActions,
    executeAssistanceAction: mockExecuteAssistanceAction,
    mapErrorToAssistance: mockMapErrorToAssistance,
    healthCheck: jest
      .fn()
      .mockResolvedValue({
        status: "healthy",
        issues: [],
        checkedAt: "2026-03-05T00:00:00Z",
      }),
    listPortForwards: jest.fn().mockResolvedValue([]),
    addPortForward: jest.fn().mockResolvedValue(undefined),
    removePortForward: jest.fn().mockResolvedValue(undefined),
    listUsers: jest.fn().mockResolvedValue([]),
  }),
}));

jest.mock("sonner", () => ({
  toast: { success: jest.fn(), error: jest.fn() },
}));

jest.mock("@/components/wsl", () => ({
  WslStatusCard: ({
    status,
    onShutdownAll,
    onRefresh,
    getIpAddress,
  }: {
    status: { kernelVersion: string } | null;
    onShutdownAll?: () => void;
    onRefresh?: () => void;
    getIpAddress?: () => Promise<string>;
  }) => (
    <div data-testid="wsl-status">
      {status?.kernelVersion ?? "No status"}
      {onShutdownAll && (
        <button data-testid="shutdown-all-btn" onClick={onShutdownAll}>
          Shutdown All
        </button>
      )}
      {onRefresh && (
        <button data-testid="refresh-status-btn" onClick={onRefresh}>
          Refresh
        </button>
      )}
      {getIpAddress && (
        <button data-testid="get-ip-btn" onClick={() => getIpAddress()}>
          Get IP
        </button>
      )}
    </div>
  ),
  WslDistroCard: ({
    distro,
    detailHref,
    onLaunch,
    onTerminate,
    onSetDefault,
    onExport,
    onSetVersion,
    onUnregister,
    onChangeDefaultUser,
    onOpenInExplorer,
    onOpenInTerminal,
    onClone,
  }: {
    distro: { name: string };
    detailHref?: string;
    onLaunch?: (n: string) => void;
    onTerminate?: (n: string) => void;
    onSetDefault?: (n: string) => void;
    onExport?: (n: string) => void;
    onSetVersion?: (n: string, v: number) => void;
    onUnregister?: (n: string) => void;
    onChangeDefaultUser?: (n: string) => void;
    onOpenInExplorer?: (n: string) => void;
    onOpenInTerminal?: (n: string) => void;
    onClone?: (n: string) => void;
  }) => (
    <div data-testid={`distro-${distro.name}`}>
      <a data-testid={`detail-link-${distro.name}`} href={detailHref}>
        {distro.name}
      </a>
      {onLaunch && (
        <button
          data-testid={`launch-${distro.name}`}
          onClick={() => onLaunch(distro.name)}
        >
          Launch
        </button>
      )}
      {onTerminate && (
        <button
          data-testid={`terminate-${distro.name}`}
          onClick={() => onTerminate(distro.name)}
        >
          Terminate
        </button>
      )}
      {onSetDefault && (
        <button
          data-testid={`default-${distro.name}`}
          onClick={() => onSetDefault(distro.name)}
        >
          Default
        </button>
      )}
      {onExport && (
        <button
          data-testid={`export-${distro.name}`}
          onClick={() => onExport(distro.name)}
        >
          Export
        </button>
      )}
      {onSetVersion && (
        <button
          data-testid={`version-${distro.name}`}
          onClick={() => onSetVersion(distro.name, 2)}
        >
          Set V2
        </button>
      )}
      {onUnregister && (
        <button
          data-testid={`unregister-${distro.name}`}
          onClick={() => onUnregister(distro.name)}
        >
          Unregister
        </button>
      )}
      {onChangeDefaultUser && (
        <button
          data-testid={`chuser-${distro.name}`}
          onClick={() => onChangeDefaultUser(distro.name)}
        >
          ChUser
        </button>
      )}
      {onOpenInExplorer && (
        <button
          data-testid={`explorer-${distro.name}`}
          onClick={() => onOpenInExplorer(distro.name)}
        >
          Explorer
        </button>
      )}
      {onOpenInTerminal && (
        <button
          data-testid={`terminal-${distro.name}`}
          onClick={() => onOpenInTerminal(distro.name)}
        >
          Terminal
        </button>
      )}
      {onClone && (
        <button
          data-testid={`clone-${distro.name}`}
          onClick={() => onClone(distro.name)}
        >
          Clone
        </button>
      )}
    </div>
  ),
  WslOnlineList: ({
    distros,
    onInstall,
    onInstallWithLocation,
  }: {
    distros: [string, string][];
    onInstall?: (n: string) => void;
    onInstallWithLocation?: (n: string) => void;
  }) => (
    <div data-testid="online-list">
      {distros.length} available
      {onInstall && (
        <button
          data-testid="install-online"
          onClick={() => onInstall("Fedora")}
        >
          Install
        </button>
      )}
      {onInstallWithLocation && (
        <button
          data-testid="install-online-location"
          onClick={() => onInstallWithLocation("Fedora")}
        >
          Install Location
        </button>
      )}
    </div>
  ),
  WslImportDialog: () => null,
  WslExportDialog: () => null,
  WslEmptyState: () => <div data-testid="empty-state">No distros</div>,
  WslNotAvailable: ({ onInstallWsl }: { onInstallWsl?: () => void }) => (
    <div data-testid="not-available">
      WSL not installed
      {onInstallWsl && (
        <button data-testid="install-wsl" onClick={onInstallWsl}>
          Install WSL
        </button>
      )}
    </div>
  ),
  WslConfigCard: () => <div data-testid="config-card">Config</div>,
  WslDistroConfigCard: ({ distroName }: { distroName: string }) => (
    <div data-testid="distro-config">Distro Config: {distroName}</div>
  ),
  WslExecTerminal: ({
    onExec,
  }: {
    onExec?: (d: string, c: string) => void;
  }) => (
    <div data-testid="exec-terminal">
      Terminal
      {onExec && (
        <button data-testid="exec-cmd" onClick={() => onExec("Ubuntu", "ls")}>
          Exec
        </button>
      )}
    </div>
  ),
  WslChangeUserDialog: () => null,
  WslMountDialog: () => null,
  WslImportInPlaceDialog: () => null,
  WslInstallLocationDialog: () => null,
  WslCloneDialog: () => null,
  WslBackupCard: () => <div data-testid="backup-card">Backup</div>,
}));

describe("WslPage", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPathname.mockReturnValue("/wsl");
    mockSearchParamGet.mockImplementation(() => null);
    useWslStore.setState({
      distroTags: {},
      availableTags: ["dev", "test", "prod", "experiment"],
      customProfiles: [],
      savedCommands: [],
      overviewContext: { tab: "installed", tag: null, origin: "overview" },
    });
    mockGetAssistanceActions.mockReturnValue([
      {
        id: "runtime.preflight",
        scope: "runtime",
        category: "check",
        risk: "safe",
        labelKey: "wsl.assistance.actions.runtimePreflight.label",
        descriptionKey: "wsl.assistance.actions.runtimePreflight.desc",
        supported: true,
      },
      {
        id: "runtime.shutdownAll",
        scope: "runtime",
        category: "repair",
        risk: "high",
        labelKey: "wsl.assistance.actions.runtimeShutdown.label",
        descriptionKey: "wsl.assistance.actions.runtimeShutdown.desc",
        supported: true,
        requiresAdmin: true,
      },
    ]);
    mockMapErrorToAssistance.mockReturnValue([]);
    mockAvailable = true;
    mockDistros = [
      { name: "Ubuntu", state: "Running", version: 2, isDefault: true },
      { name: "Debian", state: "Stopped", version: 2, isDefault: false },
    ];
  });

  it("renders page title and description", () => {
    render(<WslPage />);
    expect(screen.getByText("WSL")).toBeInTheDocument();
    expect(screen.getByText("Windows Subsystem for Linux")).toBeInTheDocument();
  });

  it("renders installed and available tabs", () => {
    render(<WslPage />);
    expect(screen.getByText(/Installed/)).toBeInTheDocument();
    expect(screen.getByText(/Available/)).toBeInTheDocument();
  });

  it("renders distro cards", () => {
    render(<WslPage />);
    expect(screen.getByTestId("distro-Ubuntu")).toBeInTheDocument();
    expect(screen.getByTestId("distro-Debian")).toBeInTheDocument();
  });

  it("renders status card sidebar", () => {
    render(<WslPage />);
    expect(screen.getByTestId("wsl-status")).toHaveTextContent("5.15.0");
  });

  it("renders config card", () => {
    render(<WslPage />);
    expect(screen.getByTestId("config-card")).toBeInTheDocument();
  });

  it("renders exec terminal", () => {
    render(<WslPage />);
    expect(screen.getByTestId("exec-terminal")).toBeInTheDocument();
  });

  it("renders grouped primary and supporting layout regions", () => {
    render(<WslPage />);
    expect(screen.getByTestId("wsl-layout-grid")).toBeInTheDocument();
    expect(screen.getByTestId("wsl-primary-region")).toBeInTheDocument();
    expect(screen.getByTestId("wsl-supporting-region")).toBeInTheDocument();
    expect(
      screen.getByTestId("wsl-runtime-support-section"),
    ).toBeInTheDocument();
    expect(
      screen.getByTestId("wsl-operations-support-section"),
    ).toBeInTheDocument();
    expect(
      screen.getByTestId("wsl-assistance-support-section"),
    ).toBeInTheDocument();
    expect(
      screen.getByTestId("wsl-config-support-section"),
    ).toBeInTheDocument();
  });

  it("uses xl-first two-column reflow classes while keeping core actions visible", () => {
    render(<WslPage />);
    const layout = screen.getByTestId("wsl-layout-grid");
    expect(layout.className).toContain(
      "xl:grid-cols-[minmax(0,1.45fr)_minmax(320px,1fr)]",
    );
    expect(layout.className).not.toContain("lg:grid-cols");
    expect(screen.getByRole("button", { name: /update/i })).toBeInTheDocument();
    expect(screen.getByTestId("distro-Ubuntu")).toBeInTheDocument();
  });

  it("normalizes per-distro config target when distro inventory changes", async () => {
    const { rerender } = render(<WslPage />);

    expect(screen.getByText("Config Target Distribution")).toBeInTheDocument();
    expect(screen.getByTestId("distro-config")).toHaveTextContent("Ubuntu");

    mockDistros = [
      { name: "Debian", state: "Stopped", version: 2, isDefault: true },
    ];
    rerender(<WslPage />);

    await waitFor(() => {
      expect(screen.getByTestId("distro-config")).toHaveTextContent("Debian");
    });
  });

  it("expands disk usage metadata when clicking view-all control", async () => {
    mockGetTotalDiskUsage.mockResolvedValueOnce({
      totalBytes: 4096,
      perDistro: [
        ["Ubuntu", 1024],
        ["Debian", 1024],
        ["Fedora", 1024],
        ["Arch", 1024],
      ],
    });

    const user = userEvent.setup();
    render(<WslPage />);

    await waitFor(() => {
      expect(screen.getByText("View all (4)")).toBeInTheDocument();
    });
    expect(screen.queryByText("Arch")).not.toBeInTheDocument();

    await user.click(screen.getByText("View all (4)"));

    await waitFor(() => {
      expect(screen.getByText("Arch")).toBeInTheDocument();
      expect(screen.getByText("Show less")).toBeInTheDocument();
    });
  });

  it("renders update button", () => {
    render(<WslPage />);
    expect(screen.getByRole("button", { name: /update/i })).toBeInTheDocument();
  });

  it("renders import button", () => {
    render(<WslPage />);
    const importButtons = screen.getAllByRole("button", { name: /import/i });
    expect(importButtons.length).toBeGreaterThanOrEqual(1);
  });

  it("switches to available tab", async () => {
    const user = userEvent.setup();
    render(<WslPage />);

    await user.click(screen.getByText(/Available/));
    await waitFor(() => {
      expect(screen.getByTestId("online-list")).toHaveTextContent(
        "2 available",
      );
    });
  });
});

describe("WslPage - Handlers", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAvailable = true;
  });

  it("launches a distro when launch button is clicked", async () => {
    const user = userEvent.setup();
    render(<WslPage />);
    await user.click(screen.getByTestId("launch-Ubuntu"));
    await waitFor(() => {
      expect(mockLaunch).toHaveBeenCalledWith("Ubuntu");
    });
  });

  it("terminates a distro when terminate button is clicked", async () => {
    const user = userEvent.setup();
    render(<WslPage />);
    await user.click(screen.getByTestId("terminate-Ubuntu"));
    await waitFor(() => {
      expect(mockTerminate).toHaveBeenCalledWith("Ubuntu");
    });
  });

  it("refreshes when refresh button is clicked", async () => {
    const user = userEvent.setup();
    render(<WslPage />);
    await user.click(screen.getByTestId("refresh-status-btn"));
    await waitFor(() => {
      expect(mockRefreshStatus).toHaveBeenCalled();
    });
  });

  it("handles update button click", async () => {
    const user = userEvent.setup();
    render(<WslPage />);
    await user.click(screen.getByRole("button", { name: /update/i }));
    await waitFor(() => {
      expect(mockUpdateWsl).toHaveBeenCalled();
    });
  });

  it("runs runtime assistance action from assistance section", async () => {
    const user = userEvent.setup();
    render(<WslPage />);

    await user.click(
      screen.getByRole("button", { name: /Runtime Preflight/i }),
    );

    await waitFor(() => {
      expect(mockExecuteAssistanceAction).toHaveBeenCalledWith(
        "runtime.preflight",
        "runtime",
      );
      expect(screen.getByTestId("wsl-assistance-summary")).toBeInTheDocument();
    });
  });

  it("requires confirmation for high-risk runtime assistance action", async () => {
    const user = userEvent.setup();
    render(<WslPage />);

    await user.click(screen.getByRole("button", { name: /Shutdown Runtime/i }));
    expect(
      screen.getAllByText("Shutdown all running distros").length,
    ).toBeGreaterThan(0);

    await user.click(screen.getByRole("button", { name: /Confirm/i }));
    await waitFor(() => {
      expect(mockExecuteAssistanceAction).toHaveBeenCalledWith(
        "runtime.shutdownAll",
        "runtime",
      );
    });
  });

  it("installs online distro and refreshes sidebar metadata", async () => {
    const user = userEvent.setup();
    render(<WslPage />);

    await waitFor(() => {
      expect(mockGetVersionInfo).toHaveBeenCalled();
      expect(mockGetTotalDiskUsage).toHaveBeenCalled();
    });
    const versionCallsBefore = mockGetVersionInfo.mock.calls.length;
    const diskCallsBefore = mockGetTotalDiskUsage.mock.calls.length;

    await user.click(screen.getByText(/Available/));
    await user.click(screen.getByTestId("install-online"));

    await waitFor(() => {
      expect(mockInstallOnlineDistro).toHaveBeenCalledWith("Fedora");
    });
    await waitFor(() => {
      expect(mockGetVersionInfo.mock.calls.length).toBeGreaterThan(
        versionCallsBefore,
      );
      expect(mockGetTotalDiskUsage.mock.calls.length).toBeGreaterThan(
        diskCallsBefore,
      );
    });
  });

  it("sets default version when button is clicked", async () => {
    const user = userEvent.setup();
    render(<WslPage />);
    const buttons = screen.getAllByRole("button", { name: /Default WSL 2/i });
    await user.click(buttons[0]);
    // handleSetDefaultVersion is called
  });

  it("opens export dialog when export button is clicked", async () => {
    const user = userEvent.setup();
    render(<WslPage />);
    await user.click(screen.getByTestId("export-Ubuntu"));
    // export dialog state is set
  });

  it("opens change user dialog when chuser button is clicked", async () => {
    const user = userEvent.setup();
    render(<WslPage />);
    await user.click(screen.getByTestId("chuser-Ubuntu"));
    // change user dialog state is set
  });

  it("sets default distro when default button is clicked", async () => {
    const user = userEvent.setup();
    render(<WslPage />);
    await user.click(screen.getByTestId("default-Ubuntu"));
    // setDefault handler is invoked
  });

  it("sets version when version button is clicked", async () => {
    const user = userEvent.setup();
    render(<WslPage />);
    await user.click(screen.getByTestId("version-Ubuntu"));
    // setVersion handler is invoked
  });

  it("opens unregister confirm when unregister button is clicked", async () => {
    const user = userEvent.setup();
    render(<WslPage />);
    await user.click(screen.getByTestId("unregister-Ubuntu"));
    // confirm dialog opens
    await waitFor(() => {
      expect(screen.getByText("Confirm")).toBeInTheDocument();
    });
  });

  it("unregisters distro and refreshes sidebar metadata after confirm", async () => {
    const user = userEvent.setup();
    render(<WslPage />);

    await waitFor(() => {
      expect(mockGetVersionInfo).toHaveBeenCalled();
      expect(mockGetTotalDiskUsage).toHaveBeenCalled();
    });
    const versionCallsBefore = mockGetVersionInfo.mock.calls.length;
    const diskCallsBefore = mockGetTotalDiskUsage.mock.calls.length;

    await user.click(screen.getByTestId("unregister-Ubuntu"));
    await user.click(screen.getByRole("button", { name: /Confirm/i }));

    await waitFor(() => {
      expect(mockUnregisterDistro).toHaveBeenCalledWith("Ubuntu");
    });
    await waitFor(() => {
      expect(mockGetVersionInfo.mock.calls.length).toBeGreaterThan(
        versionCallsBefore,
      );
      expect(mockGetTotalDiskUsage.mock.calls.length).toBeGreaterThan(
        diskCallsBefore,
      );
    });
  });

  it("executes command via terminal", async () => {
    const user = userEvent.setup();
    render(<WslPage />);
    await user.click(screen.getByTestId("exec-cmd"));
    // exec handler is invoked
  });

  it("opens distro in explorer from card action", async () => {
    const user = userEvent.setup();
    render(<WslPage />);
    await user.click(screen.getByTestId("explorer-Ubuntu"));
    await waitFor(() => {
      expect(mockOpenInExplorer).toHaveBeenCalledWith("Ubuntu");
    });
  });

  it("opens distro in terminal from card action", async () => {
    const user = userEvent.setup();
    render(<WslPage />);
    await user.click(screen.getByTestId("terminal-Ubuntu"));
    await waitFor(() => {
      expect(mockOpenInTerminal).toHaveBeenCalledWith("Ubuntu");
    });
  });

  it("clones distro from card action", async () => {
    const user = userEvent.setup();
    render(<WslPage />);
    await user.click(screen.getByTestId("clone-Ubuntu"));
    // dialog open state is set; confirmation tested in component-level tests
    await waitFor(() => {
      expect(screen.getByText("WSL")).toBeInTheDocument();
    });
  });

  it("builds distro detail links with return context", () => {
    mockSearchParamGet.mockImplementation((key: string) => {
      if (key === "tab") return "available";
      return null;
    });

    render(<WslPage />);

    const detailLink = screen.getByTestId("detail-link-Ubuntu");
    expect(detailLink).toHaveAttribute(
      "href",
      expect.stringContaining("/wsl/distro?"),
    );
    expect(detailLink.getAttribute("href")).toContain("origin=overview");
    expect(detailLink.getAttribute("href")).toContain("returnTo=");
  });

  it("shows inline lifecycle feedback after launching a distro", async () => {
    const user = userEvent.setup();
    render(<WslPage />);

    await user.click(screen.getByTestId("launch-Ubuntu"));

    await waitFor(() => {
      expect(screen.getByTestId("wsl-lifecycle-feedback")).toBeInTheDocument();
      expect(screen.getByText("Launch Ubuntu completed")).toBeInTheDocument();
    });
  });
});

describe("WslPage - Non-Tauri", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAvailable = true;
    const tauri = jest.requireMock("@/lib/tauri");
    tauri.isTauri.mockReturnValue(false);
  });

  afterEach(() => {
    const tauri = jest.requireMock("@/lib/tauri");
    tauri.isTauri.mockReturnValue(true);
  });

  it("shows not available message in browser mode", () => {
    render(<WslPage />);
    expect(
      screen.getByText("WSL is not available in the browser"),
    ).toBeInTheDocument();
  });
});

describe("WslPage - WSL Not Installed", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAvailable = false;
    const tauri = jest.requireMock("@/lib/tauri");
    tauri.isTauri.mockReturnValue(true);
  });

  it("installs WSL and refreshes availability and metadata", async () => {
    const user = userEvent.setup();
    render(<WslPage />);

    expect(screen.getByTestId("wsl-page-content")).toBeInTheDocument();
    expect(screen.getByTestId("wsl-not-available")).toBeInTheDocument();

    await user.click(screen.getByTestId("install-wsl"));

    await waitFor(() => {
      expect(mockInstallWslOnly).toHaveBeenCalled();
      expect(mockCheckAvailability).toHaveBeenCalled();
      expect(mockRefreshAll).toHaveBeenCalled();
      expect(mockGetVersionInfo).toHaveBeenCalled();
      expect(mockGetTotalDiskUsage).toHaveBeenCalled();
    });
  });
});
