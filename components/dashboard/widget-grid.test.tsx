import { render } from "@testing-library/react";
import { WidgetGrid } from "./widget-grid";

jest.mock("@/components/providers/locale-provider", () => ({
  useLocale: () => ({ t: (key: string) => key }),
}));

jest.mock("@/lib/stores/dashboard", () => {
  const store = {
    widgets: [],
    isEditMode: false,
    addWidget: jest.fn(),
    removeWidget: jest.fn(),
    toggleWidgetVisibility: jest.fn(),
    updateWidget: jest.fn(),
    reorderWidgets: jest.fn(),
  };
  return {
    useDashboardStore: (selector: (s: typeof store) => unknown) => selector(store),
    WIDGET_DEFINITIONS: [],
  };
});

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
  it("renders without crashing", () => {
    const { container } = render(<WidgetGrid {...defaultProps} />);
    expect(container).toBeInTheDocument();
  });
});
