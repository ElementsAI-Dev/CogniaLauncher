import { render, screen } from "@testing-library/react";
import { WidgetGrid } from "./widget-grid";

jest.mock("@/components/providers/locale-provider", () => ({
  useLocale: () => ({ t: (key: string) => key }),
}));

let mockWidgets: Array<{ id: string; type: string; size: string; visible: boolean }> = [];
let mockIsEditMode = false;

jest.mock("@/lib/stores/dashboard", () => ({
  useDashboardStore: (selector: (s: Record<string, unknown>) => unknown) =>
    selector({
      widgets: mockWidgets,
      isEditMode: mockIsEditMode,
      addWidget: jest.fn(),
      removeWidget: jest.fn(),
      toggleWidgetVisibility: jest.fn(),
      updateWidget: jest.fn(),
      reorderWidgets: jest.fn(),
    }),
  WIDGET_DEFINITIONS: [],
}));

jest.mock("@dnd-kit/core", () => ({
  DndContext: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  closestCenter: jest.fn(),
  KeyboardSensor: jest.fn(),
  PointerSensor: jest.fn(),
  useSensor: jest.fn(() => ({})),
  useSensors: jest.fn(() => []),
}));

jest.mock("@dnd-kit/sortable", () => ({
  SortableContext: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  sortableKeyboardCoordinates: jest.fn(),
  rectSortingStrategy: jest.fn(),
  useSortable: () => ({
    attributes: {},
    listeners: {},
    setNodeRef: jest.fn(),
    transform: null,
    transition: null,
    isDragging: false,
  }),
}));

jest.mock("@dnd-kit/utilities", () => ({
  CSS: { Transform: { toString: () => "" } },
}));

// Mock all widget sub-components to simplify rendering
jest.mock("@/components/dashboard/stats-card", () => ({
  StatsCard: ({ title }: { title: string }) => <div data-testid="stats-card">{title}</div>,
  StatsCardSkeleton: () => <div data-testid="stats-skeleton">Loading...</div>,
}));

jest.mock("@/components/dashboard/quick-search", () => ({
  QuickSearch: () => <div data-testid="quick-search">QuickSearch</div>,
}));

jest.mock("@/components/dashboard/environment-list", () => ({
  EnvironmentList: () => <div data-testid="environment-list">EnvironmentList</div>,
}));

jest.mock("@/components/dashboard/package-list", () => ({
  PackageList: () => <div data-testid="package-list">PackageList</div>,
}));

jest.mock("@/components/dashboard/quick-actions", () => ({
  QuickActionsInline: () => <div data-testid="quick-actions">QuickActions</div>,
}));

jest.mock("@/components/dashboard/widgets/environment-chart", () => ({
  EnvironmentChart: () => <div data-testid="env-chart">EnvironmentChart</div>,
}));

jest.mock("@/components/dashboard/widgets/package-chart", () => ({
  PackageChart: () => <div data-testid="pkg-chart">PackageChart</div>,
}));

jest.mock("@/components/dashboard/widgets/cache-chart", () => ({
  CacheChart: () => <div data-testid="cache-chart">CacheChart</div>,
}));

jest.mock("@/components/dashboard/widgets/activity-chart", () => ({
  ActivityChart: () => <div data-testid="activity-chart">ActivityChart</div>,
}));

jest.mock("@/components/dashboard/widgets/system-info-widget", () => ({
  SystemInfoWidget: () => <div data-testid="system-info">SystemInfo</div>,
}));

jest.mock("@/components/dashboard/widgets/download-stats-widget", () => ({
  DownloadStatsWidget: () => <div data-testid="download-stats">DownloadStats</div>,
}));

jest.mock("@/components/dashboard/widgets/wsl-status-widget", () => ({
  WslStatusWidget: () => <div data-testid="wsl-status">WslStatus</div>,
}));

jest.mock("@/components/dashboard/widgets/health-check-widget", () => ({
  HealthCheckWidget: () => <div data-testid="health-check">HealthCheck</div>,
}));

jest.mock("@/components/dashboard/widgets/updates-widget", () => ({
  UpdatesWidget: () => <div data-testid="updates">Updates</div>,
}));

jest.mock("@/components/dashboard/widgets/welcome-widget", () => ({
  WelcomeWidget: () => <div data-testid="welcome">Welcome</div>,
}));

const defaultProps = {
  environments: [],
  packages: [],
  cacheInfo: null,
  providers: [],
  platformInfo: null,
  cogniaDir: null,
  isLoading: false,
  onRefreshAll: jest.fn(),
  isRefreshing: false,
};

describe("WidgetGrid", () => {
  beforeEach(() => {
    mockWidgets = [];
    mockIsEditMode = false;
  });

  it("renders without crashing with no widgets", () => {
    const { container } = render(<WidgetGrid {...defaultProps} />);
    expect(container).toBeInTheDocument();
  });

  it("renders stats-overview loading skeletons when isLoading", () => {
    mockWidgets = [{ id: "w-1", type: "stats-overview", size: "full", visible: true }];
    render(<WidgetGrid {...defaultProps} isLoading={true} />);
    const skeletons = screen.getAllByTestId("stats-skeleton");
    expect(skeletons.length).toBe(4);
  });

  it("renders stats cards when not loading", () => {
    mockWidgets = [{ id: "w-1", type: "stats-overview", size: "full", visible: true }];
    render(<WidgetGrid {...defaultProps} />);
    const cards = screen.getAllByTestId("stats-card");
    expect(cards.length).toBe(4);
  });

  it("renders quick-search widget", () => {
    mockWidgets = [{ id: "w-2", type: "quick-search", size: "full", visible: true }];
    render(<WidgetGrid {...defaultProps} />);
    expect(screen.getByTestId("quick-search")).toBeInTheDocument();
  });

  it("renders environment-chart widget", () => {
    mockWidgets = [{ id: "w-3", type: "environment-chart", size: "md", visible: true }];
    render(<WidgetGrid {...defaultProps} />);
    expect(screen.getByTestId("env-chart")).toBeInTheDocument();
  });

  it("renders package-chart widget", () => {
    mockWidgets = [{ id: "w-4", type: "package-chart", size: "md", visible: true }];
    render(<WidgetGrid {...defaultProps} />);
    expect(screen.getByTestId("pkg-chart")).toBeInTheDocument();
  });

  it("renders cache-usage widget", () => {
    mockWidgets = [{ id: "w-5", type: "cache-usage", size: "md", visible: true }];
    render(<WidgetGrid {...defaultProps} />);
    expect(screen.getByTestId("cache-chart")).toBeInTheDocument();
  });

  it("renders activity-timeline widget", () => {
    mockWidgets = [{ id: "w-6", type: "activity-timeline", size: "md", visible: true }];
    render(<WidgetGrid {...defaultProps} />);
    expect(screen.getByTestId("activity-chart")).toBeInTheDocument();
  });

  it("renders system-info widget", () => {
    mockWidgets = [{ id: "w-7", type: "system-info", size: "md", visible: true }];
    render(<WidgetGrid {...defaultProps} />);
    expect(screen.getByTestId("system-info")).toBeInTheDocument();
  });

  it("renders download-stats widget", () => {
    mockWidgets = [{ id: "w-8", type: "download-stats", size: "md", visible: true }];
    render(<WidgetGrid {...defaultProps} />);
    expect(screen.getByTestId("download-stats")).toBeInTheDocument();
  });

  it("renders health-check widget", () => {
    mockWidgets = [{ id: "w-9", type: "health-check", size: "md", visible: true }];
    render(<WidgetGrid {...defaultProps} />);
    expect(screen.getByTestId("health-check")).toBeInTheDocument();
  });

  it("renders updates-available widget", () => {
    mockWidgets = [{ id: "w-10", type: "updates-available", size: "md", visible: true }];
    render(<WidgetGrid {...defaultProps} />);
    expect(screen.getByTestId("updates")).toBeInTheDocument();
  });

  it("renders welcome widget", () => {
    mockWidgets = [{ id: "w-11", type: "welcome", size: "full", visible: true }];
    render(<WidgetGrid {...defaultProps} />);
    expect(screen.getByTestId("welcome")).toBeInTheDocument();
  });

  it("renders unknown widget type with fallback message", () => {
    mockWidgets = [{ id: "w-99", type: "nonexistent-widget", size: "md", visible: true }];
    render(<WidgetGrid {...defaultProps} />);
    expect(screen.getByText("dashboard.widgets.unknownWidget")).toBeInTheDocument();
  });

  it("renders multiple widgets simultaneously", () => {
    mockWidgets = [
      { id: "w-a", type: "quick-search", size: "full", visible: true },
      { id: "w-b", type: "health-check", size: "md", visible: true },
      { id: "w-c", type: "wsl-status", size: "md", visible: true },
    ];
    render(<WidgetGrid {...defaultProps} />);
    expect(screen.getByTestId("quick-search")).toBeInTheDocument();
    expect(screen.getByTestId("health-check")).toBeInTheDocument();
    expect(screen.getByTestId("wsl-status")).toBeInTheDocument();
  });
});
