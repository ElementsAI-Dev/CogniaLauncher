import { render, screen, fireEvent } from "@testing-library/react";
import { AccentColorPicker } from "./accent-color-picker";
import type { AccentColor } from "@/lib/theme/types";

describe("AccentColorPicker", () => {
  const mockOnAccentColorChange = jest.fn();

  const defaultProps = {
    accentColor: "blue" as AccentColor,
    onAccentColorChange: mockOnAccentColorChange,
  };

  beforeEach(() => {
    mockOnAccentColorChange.mockClear();
  });

  it("renders all color options", () => {
    render(<AccentColorPicker {...defaultProps} />);

    const buttons = screen.getAllByRole("button");
    expect(buttons).toHaveLength(6); // zinc, blue, green, purple, orange, rose
  });

  it("renders with correct aria labels", () => {
    render(<AccentColorPicker {...defaultProps} />);

    expect(
      screen.getByLabelText("Select Zinc accent color"),
    ).toBeInTheDocument();
    expect(
      screen.getByLabelText("Select Blue accent color"),
    ).toBeInTheDocument();
    expect(
      screen.getByLabelText("Select Green accent color"),
    ).toBeInTheDocument();
    expect(
      screen.getByLabelText("Select Purple accent color"),
    ).toBeInTheDocument();
    expect(
      screen.getByLabelText("Select Orange accent color"),
    ).toBeInTheDocument();
    expect(
      screen.getByLabelText("Select Rose accent color"),
    ).toBeInTheDocument();
  });

  it("marks current accent color as pressed", () => {
    render(<AccentColorPicker {...defaultProps} accentColor="green" />);

    const greenButton = screen.getByLabelText("Select Green accent color");
    expect(greenButton).toHaveAttribute("aria-pressed", "true");
  });

  it("calls onAccentColorChange when a color is clicked", () => {
    render(<AccentColorPicker {...defaultProps} />);

    const purpleButton = screen.getByLabelText("Select Purple accent color");
    fireEvent.click(purpleButton);

    expect(mockOnAccentColorChange).toHaveBeenCalledWith("purple");
  });

  it("shows check icon for selected color", () => {
    render(<AccentColorPicker {...defaultProps} accentColor="rose" />);

    const roseButton = screen.getByLabelText("Select Rose accent color");
    const checkIcon = roseButton.querySelector("svg");
    expect(checkIcon).toBeInTheDocument();
  });

  it("applies custom className", () => {
    render(<AccentColorPicker {...defaultProps} className="custom-class" />);

    const container = screen.getAllByRole("button")[0].parentElement;
    expect(container).toHaveClass("custom-class");
  });
});
