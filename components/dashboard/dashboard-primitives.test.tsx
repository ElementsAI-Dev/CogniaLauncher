import userEvent from "@testing-library/user-event";
import { render, screen } from "@testing-library/react";
import {
  DashboardClickableRow,
  DashboardEmptyState,
  DashboardLegendList,
  DashboardMetaRow,
  DashboardMetricGrid,
  DashboardMetricItem,
  DashboardSectionLabel,
  DashboardStatusBadge,
} from "./dashboard-primitives";

describe("dashboard-primitives", () => {
  it("renders DashboardMetricGrid with the requested column layout", () => {
    render(
      <DashboardMetricGrid columns={3} data-testid="metric-grid">
        <div>child</div>
      </DashboardMetricGrid>,
    );

    const grid = screen.getByTestId("metric-grid");
    expect(grid).toHaveClass("grid");
    expect(grid).toHaveClass("grid-cols-3");
    expect(screen.getByText("child")).toBeInTheDocument();
  });

  it("renders DashboardMetricItem label, value, and icon", () => {
    render(
      <DashboardMetricItem
        label="Active Envs"
        value={<span data-testid="metric-value">7</span>}
        icon={<svg data-testid="metric-icon" />}
        valueClassName="text-red-500"
      />,
    );

    expect(screen.getByText("Active Envs")).toBeInTheDocument();
    expect(screen.getByTestId("metric-icon")).toBeInTheDocument();
    expect(screen.getByTestId("metric-value")).toBeInTheDocument();
    expect(screen.getByTestId("metric-value").parentElement).toHaveClass("text-red-500");
  });

  it("renders DashboardSectionLabel as a paragraph", () => {
    render(<DashboardSectionLabel>Section</DashboardSectionLabel>);

    const label = screen.getByText("Section");
    expect(label.tagName).toBe("P");
  });

  it("renders DashboardEmptyState message, optional icon, and action", () => {
    render(
      <DashboardEmptyState
        message="No data"
        icon={<svg data-testid="empty-icon" />}
        action={<button type="button">Retry</button>}
      />,
    );

    expect(screen.getByText("No data")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();

    const icon = screen.getByTestId("empty-icon");
    const wrapper = icon.closest('[data-slot="empty-icon"]');
    expect(wrapper).toHaveAttribute("data-variant", "icon");
  });

  it("does not render an empty icon wrapper when no icon is provided", () => {
    const { container } = render(<DashboardEmptyState message="Nothing here" />);

    expect(screen.getByText("Nothing here")).toBeInTheDocument();
    expect(container.querySelector('[data-slot="empty-icon"]')).toBeNull();
  });

  it("renders DashboardClickableRow as a button and uses type=button by default", async () => {
    const user = userEvent.setup();
    const onClick = jest.fn();

    render(
      <DashboardClickableRow onClick={onClick}>
        Click me
      </DashboardClickableRow>,
    );

    const button = screen.getByRole("button", { name: "Click me" });
    expect(button).toHaveAttribute("type", "button");

    await user.click(button);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("respects explicit button type for DashboardClickableRow", () => {
    render(
      <DashboardClickableRow type="submit">
        Submit
      </DashboardClickableRow>,
    );

    const button = screen.getByRole("button", { name: "Submit" });
    expect(button).toHaveAttribute("type", "submit");
  });

  it("applies tone styling via DashboardStatusBadge", () => {
    render(
      <DashboardStatusBadge tone="success">
        Healthy
      </DashboardStatusBadge>,
    );

    // Tone classes are additive; we only assert a representative token.
    expect(screen.getByText("Healthy")).toHaveClass("bg-green-50");
  });

  it("renders DashboardMetaRow with children and preserves custom className", () => {
    render(
      <DashboardMetaRow className="my-meta-row">
        <span>meta</span>
      </DashboardMetaRow>,
    );

    const meta = screen.getByText("meta");
    expect(meta.closest("div")).toHaveClass("my-meta-row");
  });

  it("renders DashboardLegendList items and only shows values when provided", () => {
    render(
      <DashboardLegendList
        items={[
          { key: "healthy", label: "Healthy", value: "10", tone: "success" },
          { key: "unknown", label: "Unknown" },
        ]}
      />,
    );

    expect(screen.getByText("Healthy")).toBeInTheDocument();
    expect(screen.getByText("Unknown")).toBeInTheDocument();
    expect(screen.getByText("10")).toHaveClass("font-medium");

    const unknownBadge = screen.getByText("Unknown");
    const unknownItem = unknownBadge.parentElement as HTMLElement | null;
    expect(unknownItem).toBeTruthy();
    expect(unknownItem?.children.length).toBe(1);
  });
});
