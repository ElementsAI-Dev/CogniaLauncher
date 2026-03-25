import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { GitWorkbenchPanel } from "./git-workbench-panel";

describe("GitWorkbenchPanel", () => {
  it("renders content when expanded and triggers collapse/hide callbacks", async () => {
    const user = userEvent.setup();
    const onToggleCollapsed = jest.fn();
    const onHide = jest.fn();

    render(
      <GitWorkbenchPanel
        panelId="changesInspector"
        title="Diff inspector"
        description="Review diff context"
        state={{ collapsed: false, hidden: false }}
        onToggleCollapsed={onToggleCollapsed}
        onHide={onHide}
      >
        <div>panel content</div>
      </GitWorkbenchPanel>,
    );

    expect(screen.getByText("panel content")).toBeInTheDocument();

    await user.click(
      screen.getByTestId("git-workbench-toggle-changesInspector"),
    );
    await user.click(screen.getByTestId("git-workbench-hide-changesInspector"));

    expect(onToggleCollapsed).toHaveBeenCalledTimes(1);
    expect(onHide).toHaveBeenCalledTimes(1);
  });

  it("keeps header visible while collapsed", () => {
    render(
      <GitWorkbenchPanel
        panelId="historyDetail"
        title="History details"
        state={{ collapsed: true, hidden: false }}
        onToggleCollapsed={jest.fn()}
        onHide={jest.fn()}
      >
        <div>hidden content</div>
      </GitWorkbenchPanel>,
    );

    expect(screen.getByText("History details")).toBeInTheDocument();
    expect(screen.queryByText("hidden content")).not.toBeInTheDocument();
  });
});
