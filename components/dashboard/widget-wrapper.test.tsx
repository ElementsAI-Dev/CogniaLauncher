import { render, screen, fireEvent } from "@testing-library/react";
import { WidgetWrapper } from "./widget-wrapper";

jest.mock("@/components/providers/locale-provider", () => ({
  useLocale: () => ({ t: (key: string) => key }),
}));

jest.mock("@dnd-kit/sortable", () => ({
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
  widget: {
    id: "test-1",
    type: "stats-overview" as const,
    visible: true,
    size: "md" as const,
  },
  isEditMode: false,
  onRemove: jest.fn(),
  onToggleVisibility: jest.fn(),
  onResize: jest.fn(),
};

describe("WidgetWrapper", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders children", () => {
    render(
      <WidgetWrapper {...defaultProps}>
        <div>Test Content</div>
      </WidgetWrapper>,
    );
    expect(screen.getByText("Test Content")).toBeInTheDocument();
  });

  it("renders in edit mode without crashing", () => {
    const { container } = render(
      <WidgetWrapper {...defaultProps} isEditMode={true}>
        <div>Content</div>
      </WidgetWrapper>,
    );
    expect(container).toBeInTheDocument();
  });

  it("renders in view mode without crashing", () => {
    const { container } = render(
      <WidgetWrapper {...defaultProps} isEditMode={false}>
        <div>Content</div>
      </WidgetWrapper>,
    );
    expect(container).toBeInTheDocument();
  });

  it("returns null when widget is not visible and not in edit mode", () => {
    const { container } = render(
      <WidgetWrapper
        {...defaultProps}
        widget={{ ...defaultProps.widget, visible: false }}
        isEditMode={false}
      >
        <div>Hidden Content</div>
      </WidgetWrapper>,
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders hidden widget with reduced opacity in edit mode", () => {
    const { container } = render(
      <WidgetWrapper
        {...defaultProps}
        widget={{ ...defaultProps.widget, visible: false }}
        isEditMode={true}
      >
        <div>Hidden Content</div>
      </WidgetWrapper>,
    );
    expect(screen.getByText("Hidden Content")).toBeInTheDocument();
    expect(container.firstChild).toHaveClass("opacity-50");
  });

  it("shows edit controls in edit mode", () => {
    render(
      <WidgetWrapper {...defaultProps} isEditMode={true}>
        <div>Content</div>
      </WidgetWrapper>,
    );
    // Edit mode toolbar has drag handle, shrink, expand, toggle visibility, remove buttons
    const buttons = screen.getAllByRole("button");
    expect(buttons.length).toBeGreaterThanOrEqual(5);
  });

  it("does not show edit controls in view mode", () => {
    render(
      <WidgetWrapper {...defaultProps} isEditMode={false}>
        <div>Content</div>
      </WidgetWrapper>,
    );
    // No buttons should be rendered in view mode (no edit toolbar)
    expect(screen.queryAllByRole("button").length).toBe(0);
  });

  it("calls onRemove with widget id when remove button is clicked", () => {
    const mockOnRemove = jest.fn();
    render(
      <WidgetWrapper {...defaultProps} isEditMode={true} onRemove={mockOnRemove}>
        <div>Content</div>
      </WidgetWrapper>,
    );
    // The remove button is the last one in the toolbar
    const buttons = screen.getAllByRole("button");
    const removeButton = buttons[buttons.length - 1];
    fireEvent.click(removeButton);
    expect(mockOnRemove).toHaveBeenCalledWith("test-1");
  });

  it("calls onToggleVisibility with widget id when toggle button is clicked", () => {
    const mockToggle = jest.fn();
    render(
      <WidgetWrapper {...defaultProps} isEditMode={true} onToggleVisibility={mockToggle}>
        <div>Content</div>
      </WidgetWrapper>,
    );
    // Toggle visibility button is the 4th button (drag, shrink, expand, toggle, remove)
    const buttons = screen.getAllByRole("button");
    fireEvent.click(buttons[3]);
    expect(mockToggle).toHaveBeenCalledWith("test-1");
  });

  it("calls onResize when expand button is clicked", () => {
    const mockResize = jest.fn();
    render(
      <WidgetWrapper {...defaultProps} isEditMode={true} onResize={mockResize}>
        <div>Content</div>
      </WidgetWrapper>,
    );
    // Expand is the 3rd button (drag, shrink, expand, toggle, remove)
    const buttons = screen.getAllByRole("button");
    fireEvent.click(buttons[2]);
    // md -> lg (next size)
    expect(mockResize).toHaveBeenCalledWith("test-1", "lg");
  });

  it("calls onResize when shrink button is clicked", () => {
    const mockResize = jest.fn();
    render(
      <WidgetWrapper {...defaultProps} isEditMode={true} onResize={mockResize}>
        <div>Content</div>
      </WidgetWrapper>,
    );
    // Shrink is the 2nd button
    const buttons = screen.getAllByRole("button");
    fireEvent.click(buttons[1]);
    // md -> sm (prev size)
    expect(mockResize).toHaveBeenCalledWith("test-1", "sm");
  });

  it("applies ring styling in edit mode", () => {
    const { container } = render(
      <WidgetWrapper {...defaultProps} isEditMode={true}>
        <div>Content</div>
      </WidgetWrapper>,
    );
    expect(container.firstChild).toHaveClass("ring-1");
  });

  it("applies correct size class for lg widget", () => {
    const { container } = render(
      <WidgetWrapper
        {...defaultProps}
        widget={{ ...defaultProps.widget, size: "lg" }}
      >
        <div>Content</div>
      </WidgetWrapper>,
    );
    expect(container.firstChild).toHaveClass("lg:col-span-2");
  });
});
