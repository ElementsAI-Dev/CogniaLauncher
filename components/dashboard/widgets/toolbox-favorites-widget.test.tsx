import { render, screen, fireEvent } from "@testing-library/react";
import { ToolboxFavoritesWidget } from "./toolbox-favorites-widget";

const mockPush = jest.fn();

jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

jest.mock("@/components/providers/locale-provider", () => ({
  useLocale: () => ({ t: (key: string) => key }),
}));

jest.mock("@/components/ui/dynamic-icon", () => ({
  DynamicIcon: ({ name }: { name: string }) => <span data-testid="dynamic-icon">{name}</span>,
}));

jest.mock("@/lib/constants/toolbox", () => ({
  getCategoryMeta: () => ({ color: "bg-blue-100" }),
}));

interface MockTool {
  id: string;
  name: string;
  icon: string;
  category: string;
  description: string;
  keywords: string[];
}

let mockAllTools: MockTool[] = [];
let mockFavorites: string[] = [];
let mockRecentTools: string[] = [];

jest.mock("@/hooks/toolbox/use-toolbox", () => ({
  useToolbox: () => ({
    allTools: mockAllTools,
    favorites: mockFavorites,
    recentTools: mockRecentTools,
  }),
}));

function makeTool(id: string, name: string): MockTool {
  return { id, name, icon: `icon-${id}`, category: "general", description: `Desc ${id}`, keywords: [] };
}

describe("ToolboxFavoritesWidget", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAllTools = [];
    mockFavorites = [];
    mockRecentTools = [];
  });

  it("renders empty state when no favorites and no recent tools", () => {
    render(<ToolboxFavoritesWidget />);
    expect(screen.getByText("dashboard.widgets.toolboxEmpty")).toBeInTheDocument();
  });

  it("shows browse link in empty state that navigates to /toolbox", () => {
    render(<ToolboxFavoritesWidget />);
    const browseLink = screen.getByText("dashboard.widgets.toolboxBrowse");
    fireEvent.click(browseLink);
    expect(mockPush).toHaveBeenCalledWith("/toolbox");
  });

  it("renders favorite tools grid", () => {
    mockAllTools = [makeTool("t1", "Tool One"), makeTool("t2", "Tool Two")];
    mockFavorites = ["t1", "t2"];

    render(<ToolboxFavoritesWidget />);
    expect(screen.getByText("Tool One")).toBeInTheDocument();
    expect(screen.getByText("Tool Two")).toBeInTheDocument();
  });

  it("navigates to tool page on favorite tool click", () => {
    mockAllTools = [makeTool("t1", "Tool One")];
    mockFavorites = ["t1"];

    render(<ToolboxFavoritesWidget />);
    fireEvent.click(screen.getByText("Tool One"));
    expect(mockPush).toHaveBeenCalledWith("/toolbox/t1");
  });

  it("renders recent tools section with label", () => {
    mockAllTools = [makeTool("r1", "Recent Tool")];
    mockRecentTools = ["r1"];

    render(<ToolboxFavoritesWidget />);
    expect(screen.getByText("toolbox.categories.recent")).toBeInTheDocument();
    expect(screen.getByText("Recent Tool")).toBeInTheDocument();
  });

  it("navigates to tool page on recent tool click", () => {
    mockAllTools = [makeTool("r1", "Recent Tool")];
    mockRecentTools = ["r1"];

    render(<ToolboxFavoritesWidget />);
    fireEvent.click(screen.getByText("Recent Tool"));
    expect(mockPush).toHaveBeenCalledWith("/toolbox/r1");
  });

  it("limits favorites to 6 and recent tools to 4", () => {
    mockAllTools = Array.from({ length: 10 }, (_, i) => makeTool(`t${i}`, `Tool ${i}`));
    mockFavorites = mockAllTools.map((t) => t.id);
    mockRecentTools = mockAllTools.map((t) => t.id);

    render(<ToolboxFavoritesWidget />);

    // Favorites grid (3-col): first 6 tools should appear
    // Recent section: first 4 tools should also appear
    // Some names appear in both sections, so use getAllByText
    expect(screen.getAllByText("Tool 0").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Tool 5").length).toBe(1); // Tool 5 is in favorites only (not in recent top 4)
    expect(screen.queryByText("Tool 6")).toBeNull(); // Tool 6 is NOT in favorites (>6) and not in recent top 4

    // Recent section label present
    expect(screen.getByText("toolbox.categories.recent")).toBeInTheDocument();
  });
});
