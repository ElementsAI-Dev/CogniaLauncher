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
  SidebarRail: () => null,
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
