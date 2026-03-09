import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  SelectableCardButton,
  selectableCheckboxRowClass,
} from "./selectable-list-patterns";

describe("selectable-list-patterns", () => {
  it("renders SelectableCardButton with semantic selected state", () => {
    render(
      <SelectableCardButton selected={true} onClick={jest.fn()}>
        Release v1.0.0
      </SelectableCardButton>,
    );

    const button = screen.getByRole("button", { name: "Release v1.0.0" });
    expect(button).toHaveAttribute("aria-pressed", "true");
    expect(button).toHaveAttribute("data-state", "selected");
  });

  it("calls onClick when SelectableCardButton is clicked", async () => {
    const onClick = jest.fn();
    render(
      <SelectableCardButton selected={false} onClick={onClick}>
        Click me
      </SelectableCardButton>,
    );

    await userEvent.click(screen.getByRole("button", { name: "Click me" }));
    expect(onClick).toHaveBeenCalled();
  });

  it("supports disabled SelectableCardButton", () => {
    render(
      <SelectableCardButton selected={false} onClick={jest.fn()} disabled={true}>
        Disabled row
      </SelectableCardButton>,
    );

    expect(screen.getByRole("button", { name: "Disabled row" })).toBeDisabled();
  });

  it("returns selected class set for default tone", () => {
    const className = selectableCheckboxRowClass({ selected: true });
    expect(className).toContain("border-primary");
    expect(className).toContain("bg-primary/10");
  });

  it("returns selected class set for success tone", () => {
    const className = selectableCheckboxRowClass({
      selected: true,
      tone: "success",
    });
    expect(className).toContain("border-green-500/20");
    expect(className).toContain("bg-green-500/5");
  });

  it("returns unselected and disabled class set", () => {
    const className = selectableCheckboxRowClass({
      selected: false,
      disabled: true,
      className: "extra-class",
    });
    expect(className).toContain("hover:bg-muted");
    expect(className).toContain("opacity-60");
    expect(className).toContain("extra-class");
  });
});
