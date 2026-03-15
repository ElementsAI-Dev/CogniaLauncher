import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CustomizeDialog } from "./customize-dialog";

jest.mock("lucide-react", () => {
  const actual = jest.requireActual("lucide-react");
  const Wrench = (props: React.SVGProps<SVGSVGElement>) =>
    React.createElement("svg", { ...props, "data-testid": "icon-wrench" });
  return { ...actual, Wrench };
});

jest.mock("@/components/providers/locale-provider", () => ({
  useLocale: () => ({ t: (key: string) => key }),
}));

const mockAddWidget = jest.fn();
const mockResetToDefault = jest.fn();

let mockWidgets: Array<{ id: string; type: string; size: string; visible: boolean }> = [
  { id: "w-1", type: "stats-overview", size: "full", visible: true },
  { id: "w-2", type: "environment-chart", size: "md", visible: true },
];

jest.mock("@/lib/stores/dashboard", () => {
  const mockDefinitions = {
    "stats-overview": {
      type: "stats-overview",
      titleKey: "dashboard.widgets.statsOverview",
      descriptionKey: "dashboard.widgets.statsOverviewDesc",
      icon: "BarChart3",
      defaultSize: "full",
      minSize: "full",
      category: "overview",
      allowMultiple: false,
      required: false,
      defaultVisible: true,
      maxInstances: 1,
    },
    "environment-chart": {
      type: "environment-chart",
      titleKey: "dashboard.widgets.environmentChart",
      descriptionKey: "dashboard.widgets.environmentChartDesc",
      icon: "PieChart",
      defaultSize: "md",
      minSize: "sm",
      category: "charts",
      allowMultiple: true,
      required: false,
      defaultVisible: true,
    },
    "quick-search": {
      type: "quick-search",
      titleKey: "dashboard.widgets.quickSearch",
      descriptionKey: "dashboard.widgets.quickSearchDesc",
      icon: "Search",
      defaultSize: "full",
      minSize: "lg",
      category: "tools",
      allowMultiple: false,
      required: false,
      defaultVisible: true,
      maxInstances: 1,
    },
    "environment-list": {
      type: "environment-list",
      titleKey: "dashboard.widgets.environmentList",
      descriptionKey: "dashboard.widgets.environmentListDesc",
      icon: "Layers",
      defaultSize: "md",
      minSize: "sm",
      category: "lists",
      allowMultiple: true,
      required: false,
      defaultVisible: true,
    },
    "toolbox-favorites": {
      type: "toolbox-favorites",
      titleKey: "dashboard.widgets.toolboxFavorites",
      descriptionKey: "dashboard.widgets.toolboxFavoritesDesc",
      icon: "Wrench",
      defaultSize: "md",
      minSize: "sm",
      category: "tools",
      allowMultiple: true,
      required: false,
      defaultVisible: true,
    },
    "workspace-trends": {
      type: "workspace-trends",
      titleKey: "dashboard.widgets.workspaceTrends",
      descriptionKey: "dashboard.widgets.workspaceTrendsDesc",
      icon: "ChartNoAxesCombined",
      defaultSize: "lg",
      minSize: "md",
      category: "charts",
      allowMultiple: true,
      required: false,
      defaultVisible: true,
      defaultSettings: {
        range: "7d",
        metric: "installations",
      },
    },
  };

  return {
    useDashboardStore: (selector: (s: Record<string, unknown>) => unknown) =>
      selector({
        widgets: mockWidgets,
        addWidget: (...args: unknown[]) => mockAddWidget(...args),
        resetToDefault: (...args: unknown[]) => mockResetToDefault(...args),
      }),
    WIDGET_DEFINITIONS: mockDefinitions,
    canAddWidgetType: (
      widgets: Array<{ type: string }>,
      type: string,
    ) => {
      const def = mockDefinitions[type as keyof typeof mockDefinitions];
      const count = widgets.filter((widget) => widget.type === type).length;
      const max = def.maxInstances ?? (def.allowMultiple ? Number.POSITIVE_INFINITY : 1);
      return count < max;
    },
    getWidgetTypeCount: (
      widgets: Array<{ type: string }>,
      type: string,
    ) => widgets.filter((widget) => widget.type === type).length,
  };
});

describe("CustomizeDialog", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockWidgets = [
      { id: "w-1", type: "stats-overview", size: "full", visible: true },
      { id: "w-2", type: "environment-chart", size: "md", visible: true },
    ];
  });

  it("renders dialog title when open", () => {
    render(
      <CustomizeDialog open={true} onOpenChange={jest.fn()} />,
    );
    expect(screen.getByText("dashboard.widgets.customizeTitle")).toBeInTheDocument();
  });

  it("does not render content when closed", () => {
    render(
      <CustomizeDialog open={false} onOpenChange={jest.fn()} />,
    );
    expect(screen.queryByText("dashboard.widgets.customizeTitle")).not.toBeInTheDocument();
  });

  it("renders current layout summary", () => {
    render(
      <CustomizeDialog open={true} onOpenChange={jest.fn()} />,
    );
    expect(screen.getByTestId("dashboard-customize-summary")).toBeInTheDocument();
    expect(screen.getByText("dashboard.widgets.currentLayoutSummary")).toBeInTheDocument();
  });

  it("renders all widget definitions with titles and descriptions", () => {
    render(
      <CustomizeDialog open={true} onOpenChange={jest.fn()} />,
    );
    expect(screen.getByText("dashboard.widgets.statsOverview")).toBeInTheDocument();
    expect(screen.getByText("dashboard.widgets.statsOverviewDesc")).toBeInTheDocument();
    expect(screen.getByText("dashboard.widgets.environmentChart")).toBeInTheDocument();
    expect(screen.getByText("dashboard.widgets.quickSearch")).toBeInTheDocument();
    expect(screen.getByText("dashboard.widgets.environmentList")).toBeInTheDocument();
    expect(screen.getByText("dashboard.widgets.toolboxFavorites")).toBeInTheDocument();
    expect(screen.getByText("dashboard.widgets.workspaceTrends")).toBeInTheDocument();
  });

  it("shows a configurable badge for widgets with default settings", () => {
    render(
      <CustomizeDialog open={true} onOpenChange={jest.fn()} />,
    );

    expect(screen.getByTestId("dashboard-customize-configurable-workspace-trends")).toBeInTheDocument();
  });

  it("shows disabled limit state when widget type reached max instances", () => {
    render(
      <CustomizeDialog open={true} onOpenChange={jest.fn()} />,
    );

    const singleButton = screen.getByTestId("dashboard-customize-add-stats-overview");
    expect(singleButton).toBeDisabled();
    expect(screen.getByText("dashboard.widgets.limitReached")).toBeInTheDocument();
  });

  it("shows count badge for existing widget type", () => {
    render(
      <CustomizeDialog open={true} onOpenChange={jest.fn()} />,
    );

    expect(screen.getByTestId("dashboard-customize-count-stats-overview")).toBeInTheDocument();
    expect(screen.getByTestId("dashboard-customize-count-environment-chart")).toBeInTheDocument();
  });

  it("calls addWidget when addable button is clicked", async () => {
    const user = userEvent.setup();
    render(
      <CustomizeDialog open={true} onOpenChange={jest.fn()} />,
    );

    await user.click(screen.getByTestId("dashboard-customize-add-environment-list"));

    expect(mockAddWidget).toHaveBeenCalledTimes(1);
    expect(mockAddWidget).toHaveBeenCalledWith("environment-list");
  });

  it("calls resetToDefault and closes dialog on reset click", async () => {
    const user = userEvent.setup();
    const mockOnOpenChange = jest.fn();
    render(
      <CustomizeDialog open={true} onOpenChange={mockOnOpenChange} />,
    );

    await user.click(screen.getByTestId("dashboard-customize-reset"));

    expect(mockResetToDefault).toHaveBeenCalledTimes(1);
    expect(mockOnOpenChange).toHaveBeenCalledWith(false);
  });

  it("calls onOpenChange(false) when close button is clicked", async () => {
    const user = userEvent.setup();
    const mockOnOpenChange = jest.fn();
    render(
      <CustomizeDialog open={true} onOpenChange={mockOnOpenChange} />,
    );

    await user.click(screen.getByText("common.close"));

    expect(mockOnOpenChange).toHaveBeenCalledWith(false);
  });

  it("filters widget definitions by category", async () => {
    const user = userEvent.setup();
    render(
      <CustomizeDialog open={true} onOpenChange={jest.fn()} />,
    );

    await user.click(screen.getByText("dashboard.widgets.categoryCharts"));

    expect(screen.getByText("dashboard.widgets.environmentChart")).toBeInTheDocument();
    expect(screen.queryByText("dashboard.widgets.statsOverview")).not.toBeInTheDocument();
    expect(screen.queryByText("dashboard.widgets.quickSearch")).not.toBeInTheDocument();
  });

  it("renders explicit wrench icon mapping for toolbox favorites", () => {
    render(
      <CustomizeDialog open={true} onOpenChange={jest.fn()} />,
    );

    expect(screen.getByTestId("icon-wrench")).toBeInTheDocument();
  });
});
