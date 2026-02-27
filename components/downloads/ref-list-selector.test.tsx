import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RefListSelector, type RefItem } from "./ref-list-selector";

// ScrollArea uses ResizeObserver internally
beforeAll(() => {
  global.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
});

const sampleItems: RefItem[] = [
  { name: "main", badges: [{ label: "default", variant: "secondary" }] },
  {
    name: "develop",
    badges: [
      { label: "protected", variant: "outline" },
      { label: "active", variant: "default" },
    ],
  },
  { name: "feature/login" },
];

describe("RefListSelector", () => {
  const defaultProps = {
    items: sampleItems,
    selectedValue: null,
    onSelect: jest.fn(),
    emptyMessage: "No items found",
    idPrefix: "test-ref",
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders empty message when items array is empty", () => {
    render(<RefListSelector {...defaultProps} items={[]} />);

    expect(screen.getByText("No items found")).toBeInTheDocument();
  });

  it("renders list of items with radio buttons", () => {
    render(<RefListSelector {...defaultProps} />);

    const radios = screen.getAllByRole("radio");
    expect(radios).toHaveLength(3);
  });

  it("displays item names in mono font", () => {
    render(<RefListSelector {...defaultProps} />);

    expect(screen.getByText("main")).toBeInTheDocument();
    expect(screen.getByText("develop")).toBeInTheDocument();
    expect(screen.getByText("feature/login")).toBeInTheDocument();
  });

  it("shows badges when present on items", () => {
    render(<RefListSelector {...defaultProps} />);

    expect(screen.getByText("default")).toBeInTheDocument();
    expect(screen.getByText("protected")).toBeInTheDocument();
    expect(screen.getByText("active")).toBeInTheDocument();
  });

  it("does not render badges when item has no badges", () => {
    const noBadgeItems: RefItem[] = [{ name: "simple-branch" }];
    render(<RefListSelector {...defaultProps} items={noBadgeItems} />);

    expect(screen.getByText("simple-branch")).toBeInTheDocument();
    // No badge elements
    expect(screen.queryByText("default")).not.toBeInTheDocument();
  });

  it("calls onSelect when clicking an item", async () => {
    const onSelect = jest.fn();
    render(<RefListSelector {...defaultProps} onSelect={onSelect} />);

    await userEvent.click(screen.getByText("develop"));

    expect(onSelect).toHaveBeenCalledWith("develop");
  });

  it("marks selected value as checked", () => {
    render(
      <RefListSelector {...defaultProps} selectedValue="main" />,
    );

    const mainRadio = document.getElementById("test-ref-main") as HTMLButtonElement;
    expect(mainRadio).toHaveAttribute("data-state", "checked");
  });

  it("applies custom height class", () => {
    const { container } = render(
      <RefListSelector {...defaultProps} height="h-[300px]" />,
    );

    const scrollArea = container.firstChild as HTMLElement;
    expect(scrollArea.className).toContain("h-[300px]");
  });
});
