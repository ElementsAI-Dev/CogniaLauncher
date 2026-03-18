import { render, screen } from "@testing-library/react";
import { WidgetEmptyCard } from "./widget-empty-card";

describe("WidgetEmptyCard", () => {
  it("renders title and message", () => {
    render(<WidgetEmptyCard title="Empty Widget" message="Nothing to show" />);

    expect(screen.getByText("Empty Widget")).toBeInTheDocument();
    expect(screen.getByText("Nothing to show")).toBeInTheDocument();
  });

  it("passes icon through to the underlying dashboard empty state", () => {
    render(
      <WidgetEmptyCard
        title="Empty Widget"
        message="Nothing to show"
        icon={<svg data-testid="empty-card-icon" />}
      />,
    );

    const icon = screen.getByTestId("empty-card-icon");
    const wrapper = icon.closest('[data-slot="empty-icon"]');
    expect(wrapper).toHaveAttribute("data-variant", "icon");
  });

  it("applies custom className to the card root", () => {
    const { container } = render(
      <WidgetEmptyCard
        title="Styled"
        message="Styled message"
        className="my-widget-empty-card"
      />,
    );

    const card = container.querySelector('[data-slot="card"]');
    expect(card).toHaveClass("my-widget-empty-card");
  });
});

