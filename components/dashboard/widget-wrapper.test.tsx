import { render, screen } from "@testing-library/react";
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
});
