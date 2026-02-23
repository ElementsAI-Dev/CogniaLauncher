import { render, screen } from "@testing-library/react";
import { AppSidebar } from "./app-sidebar";

const mockPathname = jest.fn(() => "/");

jest.mock("next/navigation", () => ({
  usePathname: () => mockPathname(),
}));

jest.mock("@/components/providers/locale-provider", () => ({
  useLocale: () => ({
    t: (key: string) => {
      const translations: Record<string, string> = {
        "common.appName": "CogniaLauncher",
        "common.appDescription": "Environment Manager",
        "common.version": "v0.1.0",
        "nav.dashboard": "Dashboard",
        "nav.environments": "Environments",
        "nav.packages": "Packages",
        "nav.providers": "Providers",
        "nav.cache": "Cache",
        "nav.downloads": "Downloads",
        "nav.wsl": "WSL",
        "nav.logs": "Logs",
        "nav.settings": "Settings",
        "nav.about": "About",
        "nav.docs": "Documentation",
      };
      return translations[key] || key;
    },
  }),
}));

jest.mock("@/components/ui/sidebar", () => ({
  Sidebar: ({ children }: { children: React.ReactNode }) => (
    <nav data-testid="sidebar">{children}</nav>
  ),
  SidebarContent: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  SidebarFooter: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="sidebar-footer">{children}</div>
  ),
  SidebarGroup: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  SidebarGroupContent: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  SidebarGroupLabel: ({ children }: { children: React.ReactNode }) => (
    <span>{children}</span>
  ),
  SidebarHeader: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="sidebar-header">{children}</div>
  ),
  SidebarMenu: ({ children }: { children: React.ReactNode }) => (
    <ul>{children}</ul>
  ),
  SidebarMenuButton: ({
    children,
    isActive,
  }: {
    children: React.ReactNode;
    isActive?: boolean;
  }) => <div data-active={isActive}>{children}</div>,
  SidebarMenuItem: ({ children }: { children: React.ReactNode }) => (
    <li>{children}</li>
  ),
  SidebarMenuSub: ({ children }: { children: React.ReactNode }) => (
    <ul>{children}</ul>
  ),
  SidebarMenuSubButton: ({
    children,
    isActive,
  }: {
    children: React.ReactNode;
    isActive?: boolean;
  }) => <div data-active={isActive}>{children}</div>,
  SidebarMenuSubItem: ({ children }: { children: React.ReactNode }) => (
    <li>{children}</li>
  ),
  SidebarRail: () => null,
}));

jest.mock("@/components/ui/collapsible", () => ({
  Collapsible: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  CollapsibleContent: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  CollapsibleTrigger: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
}));

jest.mock("@/lib/tauri", () => ({
  isTauri: () => true,
}));

jest.mock("@/hooks/use-wsl", () => ({
  useWsl: () => ({
    distros: [
      { name: "Ubuntu", state: "Running", wslVersion: "2", isDefault: true },
      { name: "Debian", state: "Stopped", wslVersion: "2", isDefault: false },
    ],
    available: true,
    loading: false,
    error: null,
    onlineDistros: [],
    status: null,
    config: null,
    checkAvailability: jest.fn(),
    refreshDistros: jest.fn(),
    refreshOnlineDistros: jest.fn(),
    refreshStatus: jest.fn(),
    refreshRunning: jest.fn(),
    refreshAll: jest.fn(),
    terminate: jest.fn(),
    shutdown: jest.fn(),
    setDefault: jest.fn(),
    setVersion: jest.fn(),
    setDefaultVersion: jest.fn(),
    exportDistro: jest.fn(),
    importDistro: jest.fn(),
    updateWsl: jest.fn(),
    launch: jest.fn(),
    execCommand: jest.fn(),
    convertPath: jest.fn(),
    refreshConfig: jest.fn(),
    setConfigValue: jest.fn(),
    getDiskUsage: jest.fn(),
    importInPlace: jest.fn(),
    mountDisk: jest.fn(),
    unmountDisk: jest.fn(),
    getIpAddress: jest.fn(),
    changeDefaultUser: jest.fn(),
    getDistroConfig: jest.fn(),
    setDistroConfigValue: jest.fn(),
  }),
}));

jest.mock("@/components/theme-toggle", () => ({
  ThemeToggle: () => <button data-testid="theme-toggle">Theme</button>,
}));

jest.mock("@/components/language-toggle", () => ({
  LanguageToggle: () => <button data-testid="language-toggle">Language</button>,
}));

describe("AppSidebar", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPathname.mockReturnValue("/");
  });

  it("renders sidebar with app name", () => {
    render(<AppSidebar />);

    expect(screen.getByTestId("sidebar")).toBeInTheDocument();
    expect(screen.getByText("CogniaLauncher")).toBeInTheDocument();
  });

  it("renders all navigation items", () => {
    render(<AppSidebar />);

    expect(screen.getAllByText("Dashboard").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Environments").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Packages").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Providers").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Cache").length).toBeGreaterThan(0);
    expect(screen.getAllByText("WSL").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Settings").length).toBeGreaterThan(0);
    expect(screen.getAllByText("About").length).toBeGreaterThan(0);
  });

  it("renders theme and language toggles in footer", () => {
    render(<AppSidebar />);

    expect(screen.getByTestId("sidebar-footer")).toBeInTheDocument();
    expect(screen.getByTestId("theme-toggle")).toBeInTheDocument();
    expect(screen.getByTestId("language-toggle")).toBeInTheDocument();
  });

  it("highlights active navigation item based on pathname", () => {
    mockPathname.mockReturnValue("/packages");
    render(<AppSidebar />);

    const packagesItem = screen.getByText("Packages").closest("[data-active]");
    expect(packagesItem).toHaveAttribute("data-active", "true");
  });

  it("renders navigation links with correct hrefs", () => {
    render(<AppSidebar />);

    const links = screen.getAllByRole("link");
    const dashboardLink = links.find(
      (link) => link.getAttribute("href") === "/",
    );
    const packagesLink = links.find(
      (link) => link.getAttribute("href") === "/packages",
    );

    expect(dashboardLink).toBeInTheDocument();
    expect(packagesLink).toBeInTheDocument();
  });
});
