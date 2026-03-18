import React from "react";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SidebarOrderCustomizer } from "./sidebar-order-customizer";
import {
  type PrimarySidebarItemId,
  type SecondarySidebarItemId,
} from "@/lib/sidebar/order";

const mockT = (key: string) => {
  const translations: Record<string, string> = {
    "settings.sidebarOrderTitle": "Sidebar Order",
    "settings.sidebarOrderDesc": "Reorder sidebar entries",
    "settings.sidebarOrderReset": "Reset Order",
    "settings.sidebarOrderMainGroup": "Main Navigation",
    "settings.sidebarOrderSettingsGroup": "Secondary Navigation",
    "settings.sidebarOrderMoveUp": "Move Up",
    "settings.sidebarOrderMoveDown": "Move Down",
    "settings.sidebarOrderScopeHint": "Changes only affect the desktop shell.",
    "nav.environments": "Environments",
    "nav.packages": "Packages",
    "nav.logs": "Logs",
    "nav.settings": "Settings",
    "nav.about": "About",
  };
  return translations[key] || key;
};

describe("SidebarOrderCustomizer", () => {
  const defaultProps = {
    t: mockT,
    primaryOrder: ["environments", "packages"] as PrimarySidebarItemId[],
    secondaryOrder: ["logs", "settings", "about"] as SecondarySidebarItemId[],
    onMovePrimary: jest.fn(),
    onMoveSecondary: jest.fn(),
    onReset: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders both groups and sidebar item labels", () => {
    render(<SidebarOrderCustomizer {...defaultProps} />);

    expect(screen.getByText("Sidebar Order")).toBeInTheDocument();
    expect(screen.getByText("Main Navigation")).toBeInTheDocument();
    expect(screen.getByText("Secondary Navigation")).toBeInTheDocument();
    expect(screen.getByText("Environments")).toBeInTheDocument();
    expect(screen.getByText("Settings")).toBeInTheDocument();
    expect(screen.getByText("Changes only affect the desktop shell.")).toBeInTheDocument();
  });

  it("disables boundary move buttons", () => {
    render(<SidebarOrderCustomizer {...defaultProps} />);

    const environmentRow = screen.getByText("Environments").closest("div");
    const aboutRow = screen.getByText("About").closest("div");

    expect(environmentRow).toBeTruthy();
    expect(aboutRow).toBeTruthy();

    const environmentButtons = within(environmentRow as HTMLElement).getAllByRole("button");
    const aboutButtons = within(aboutRow as HTMLElement).getAllByRole("button");

    expect(environmentButtons[0]).toBeDisabled();
    expect(environmentButtons[1]).toBeEnabled();
    expect(aboutButtons[0]).toBeEnabled();
    expect(aboutButtons[1]).toBeDisabled();
  });

  it("triggers move callbacks for primary and secondary groups", async () => {
    const onMovePrimary = jest.fn();
    const onMoveSecondary = jest.fn();

    render(
      <SidebarOrderCustomizer
        {...defaultProps}
        onMovePrimary={onMovePrimary}
        onMoveSecondary={onMoveSecondary}
      />,
    );

    const packagesRow = screen.getByText("Packages").closest("div");
    const settingsRow = screen.getByText("Settings").closest("div");

    expect(packagesRow).toBeTruthy();
    expect(settingsRow).toBeTruthy();

    await userEvent.click(within(packagesRow as HTMLElement).getAllByRole("button")[0]);
    await userEvent.click(within(settingsRow as HTMLElement).getAllByRole("button")[1]);

    expect(onMovePrimary).toHaveBeenCalledWith("packages", "up");
    expect(onMoveSecondary).toHaveBeenCalledWith("settings", "down");
  });

  it("resets sidebar order", async () => {
    const onReset = jest.fn();
    render(<SidebarOrderCustomizer {...defaultProps} onReset={onReset} />);

    await userEvent.click(screen.getByRole("button", { name: "Reset Order" }));

    expect(onReset).toHaveBeenCalled();
  });
});
