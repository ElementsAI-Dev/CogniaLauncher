import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CustomizeDialog } from "./customize-dialog";

jest.mock("@/components/providers/locale-provider", () => ({
  useLocale: () => ({ t: (key: string) => key }),
}));

const mockAddWidget = jest.fn();
const mockResetToDefault = jest.fn();

jest.mock("@/lib/stores/dashboard", () => {
  const store = {
    widgets: [
      { id: "w-1", type: "stats-overview", size: "full", visible: true },
    ],
    addWidget: (...args: unknown[]) => mockAddWidget(...args),
    removeWidget: jest.fn(),
    resetToDefault: (...args: unknown[]) => mockResetToDefault(...args),
  };
  return {
    useDashboardStore: (selector: (s: typeof store) => unknown) => selector(store),
    WIDGET_DEFINITIONS: {
      "stats-overview": {
        type: "stats-overview",
        titleKey: "dashboard.widgets.statsOverview",
        descriptionKey: "dashboard.widgets.statsOverviewDesc",
        icon: "BarChart3",
        defaultSize: "full",
        minSize: "full",
        category: "overview",
      },
      "environment-chart": {
        type: "environment-chart",
        titleKey: "dashboard.widgets.environmentChart",
        descriptionKey: "dashboard.widgets.environmentChartDesc",
        icon: "PieChart",
        defaultSize: "md",
        minSize: "sm",
        category: "charts",
      },
      "quick-search": {
        type: "quick-search",
        titleKey: "dashboard.widgets.quickSearch",
        descriptionKey: "dashboard.widgets.quickSearchDesc",
        icon: "Search",
        defaultSize: "full",
        minSize: "lg",
        category: "tools",
      },
      "environment-list": {
        type: "environment-list",
        titleKey: "dashboard.widgets.environmentList",
        descriptionKey: "dashboard.widgets.environmentListDesc",
        icon: "Layers",
        defaultSize: "md",
        minSize: "sm",
        category: "lists",
      },
    },
  };
});

describe("CustomizeDialog", () => {
  beforeEach(() => {
    jest.clearAllMocks();
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

  it("renders dialog description", () => {
    render(
      <CustomizeDialog open={true} onOpenChange={jest.fn()} />,
    );
    expect(screen.getByText("dashboard.widgets.customizeDesc")).toBeInTheDocument();
  });

  it("renders category filter toggle group", () => {
    render(
      <CustomizeDialog open={true} onOpenChange={jest.fn()} />,
    );
    expect(screen.getByText("dashboard.widgets.allCategories")).toBeInTheDocument();
    expect(screen.getByText("dashboard.widgets.categoryOverview")).toBeInTheDocument();
    expect(screen.getByText("dashboard.widgets.categoryCharts")).toBeInTheDocument();
    expect(screen.getByText("dashboard.widgets.categoryLists")).toBeInTheDocument();
    expect(screen.getByText("dashboard.widgets.categoryTools")).toBeInTheDocument();
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
  });

  it("shows 'addAnother' label for already-added widget types", () => {
    render(
      <CustomizeDialog open={true} onOpenChange={jest.fn()} />,
    );
    // stats-overview is in widgets[], so its button should say "addAnother"
    expect(screen.getByText("dashboard.widgets.addAnother")).toBeInTheDocument();
    // other types should say "common.add"
    const addButtons = screen.getAllByText("common.add");
    expect(addButtons.length).toBe(3);
  });

  it("calls addWidget when add button is clicked", async () => {
    const user = userEvent.setup();
    render(
      <CustomizeDialog open={true} onOpenChange={jest.fn()} />,
    );

    // Click the first "common.add" button (environment-chart)
    const addButtons = screen.getAllByText("common.add");
    await user.click(addButtons[0]);

    expect(mockAddWidget).toHaveBeenCalledTimes(1);
  });

  it("calls resetToDefault and closes dialog on reset click", async () => {
    const user = userEvent.setup();
    const mockOnOpenChange = jest.fn();
    render(
      <CustomizeDialog open={true} onOpenChange={mockOnOpenChange} />,
    );

    await user.click(screen.getByText("dashboard.widgets.resetDefault"));

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

    // Click "Charts" category
    await user.click(screen.getByText("dashboard.widgets.categoryCharts"));

    // Should show environment-chart (charts) but not stats-overview (overview)
    expect(screen.getByText("dashboard.widgets.environmentChart")).toBeInTheDocument();
    expect(screen.queryByText("dashboard.widgets.statsOverview")).not.toBeInTheDocument();
    expect(screen.queryByText("dashboard.widgets.quickSearch")).not.toBeInTheDocument();
  });
});
