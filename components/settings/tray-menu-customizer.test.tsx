import React from "react";
import { render, screen, fireEvent, act, within } from "@testing-library/react";
import * as dndCore from "@dnd-kit/core";
import { TrayMenuCustomizer } from "./tray-menu-customizer";

const mockTrayGetMenuConfig = jest.fn();
const mockTraySetMenuConfig = jest.fn();
const mockTrayGetAvailableMenuItems = jest.fn();
const mockTrayResetMenuConfig = jest.fn();
const mockIsTauri = jest.fn();

jest.mock("@/lib/tauri", () => ({
  isTauri: () => mockIsTauri(),
  trayGetMenuConfig: (...args: unknown[]) => mockTrayGetMenuConfig(...args),
  traySetMenuConfig: (...args: unknown[]) => mockTraySetMenuConfig(...args),
  trayGetAvailableMenuItems: (...args: unknown[]) =>
    mockTrayGetAvailableMenuItems(...args),
  trayResetMenuConfig: (...args: unknown[]) =>
    mockTrayResetMenuConfig(...args),
}));

let dndHandlers: Array<(event: unknown) => void> = [];

jest.mock("@dnd-kit/core", () => {
  return {
    DndContext: ({
      children,
      onDragEnd,
    }: {
      children: React.ReactNode;
      onDragEnd: (event: unknown) => void;
    }) => {
      const indexRef = React.useRef<number | null>(null);
      if (indexRef.current === null) {
        indexRef.current = dndHandlers.length;
        dndHandlers.push(onDragEnd);
      } else {
        dndHandlers[indexRef.current] = onDragEnd;
      }
      return <div>{children}</div>;
    },
    closestCenter: jest.fn(),
    KeyboardSensor: jest.fn(),
    PointerSensor: jest.fn(),
    useSensor: jest.fn(() => ({})),
    useSensors: jest.fn(() => []),
    __resetHandlers: () => {
      dndHandlers = [];
    },
    __triggerDragEnd: (
      index: number,
      activeId: string,
      overId: string | null,
    ) => {
      const handler = dndHandlers[index];
      if (!handler) return;
      handler({
        active: { id: activeId },
        over: overId ? { id: overId } : null,
      });
    },
  };
});

jest.mock("@dnd-kit/sortable", () => ({
  SortableContext: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  sortableKeyboardCoordinates: jest.fn(),
  verticalListSortingStrategy: jest.fn(),
  useSortable: ({ id, disabled }: { id: string; disabled?: boolean }) => ({
    attributes: { "data-sort-id": id },
    listeners: disabled ? {} : { "data-sort-listener": id },
    setNodeRef: jest.fn(),
    transform: null,
    transition: null,
    isDragging: false,
  }),
  arrayMove: (array: unknown[], from: number, to: number) => {
    const next = [...array];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    return next;
  },
}));

jest.mock("@dnd-kit/utilities", () => ({
  CSS: { Transform: { toString: () => "" } },
}));

const mockT = (key: string) => {
  const translations: Record<string, string> = {
    "settings.trayMenuCustomize": "Customize Menu",
    "settings.trayMenuCustomizeDesc": "Drag to reorder, toggle to show/hide",
    "settings.trayMenuSections.priority": "Priority Items",
    "settings.trayMenuSections.priorityEmpty": "No priority items",
    "settings.trayMenuSections.enabled": "Enabled Items",
    "settings.trayMenuSections.disabled": "Disabled Items",
    "settings.trayMenuSections.disabledEmpty": "No disabled items",
    "settings.trayMenu.showHide": "Show/Hide",
    "settings.trayMenu.quickNav": "Quick Nav",
    "settings.trayMenu.downloads": "Downloads",
    "settings.trayMenu.settings": "Settings",
    "settings.trayMenu.checkUpdates": "Check Updates",
    "settings.trayMenu.toggleNotifications": "Toggle Notifications",
    "settings.trayMenu.openLogs": "Open Logs",
    "settings.trayMenu.alwaysOnTop": "Always on Top",
    "settings.trayMenu.autostart": "Autostart",
    "settings.trayMenu.dragHint": "Drag to reorder",
    "settings.trayMenu.priority": "Mark as Priority",
    "settings.trayMenu.quit": "Quit",
    "common.reset": "Reset",
  };
  return translations[key] || key;
};

describe("TrayMenuCustomizer", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (dndCore as unknown as { __resetHandlers: () => void }).__resetHandlers();
    mockIsTauri.mockReturnValue(true);
    mockTrayGetAvailableMenuItems.mockResolvedValue([
      "show_hide",
      "settings",
      "downloads",
      "quit",
    ]);
    mockTrayGetMenuConfig.mockResolvedValue({
      items: ["show_hide", "settings", "quit"],
      priorityItems: ["settings"],
    });
    mockTraySetMenuConfig.mockResolvedValue(undefined);
    mockTrayResetMenuConfig.mockResolvedValue(undefined);
  });

  it("renders loading skeleton initially", () => {
    const { container } = render(<TrayMenuCustomizer t={mockT} />);
    const skeleton = container.querySelector('[class*="animate-pulse"]');
    expect(skeleton).toBeInTheDocument();
  });

  it("renders sectioned menu layout", async () => {
    await act(async () => {
      render(<TrayMenuCustomizer t={mockT} />);
    });

    expect(screen.getByText("Customize Menu")).toBeInTheDocument();
    expect(screen.getByText("Priority Items")).toBeInTheDocument();
    expect(screen.getByText("Enabled Items")).toBeInTheDocument();
    expect(screen.getByText("Disabled Items")).toBeInTheDocument();
    expect(screen.getByText("Settings")).toBeInTheDocument();
    expect(screen.getByText("Show/Hide")).toBeInTheDocument();
    expect(screen.getByText("Downloads")).toBeInTheDocument();
    expect(screen.getByText("Quit")).toBeInTheDocument();
  });

  it("keeps quit switch and priority button disabled", async () => {
    await act(async () => {
      render(<TrayMenuCustomizer t={mockT} />);
    });

    const quitRow = screen.getByText("Quit").closest("div");
    expect(quitRow).not.toBeNull();
    if (!quitRow) return;

    expect(
      within(quitRow).getByRole("button", { name: "Mark as Priority" }),
    ).toBeDisabled();
    expect(within(quitRow).getByRole("switch")).toBeDisabled();
  });

  it("enables a disabled item and persists config", async () => {
    await act(async () => {
      render(<TrayMenuCustomizer t={mockT} />);
    });

    const downloadsRow = screen.getByText("Downloads").closest("div");
    expect(downloadsRow).not.toBeNull();
    if (!downloadsRow) return;

    await act(async () => {
      fireEvent.click(within(downloadsRow).getByRole("switch"));
    });

    expect(mockTraySetMenuConfig).toHaveBeenCalledWith({
      items: ["settings", "show_hide", "downloads", "quit"],
      priorityItems: ["settings"],
    });
  });

  it("reorders enabled items on drag end and persists order", async () => {
    mockTrayGetMenuConfig.mockResolvedValue({
      items: ["show_hide", "settings", "downloads", "quit"],
      priorityItems: [],
    });

    await act(async () => {
      render(<TrayMenuCustomizer t={mockT} />);
    });

    await act(async () => {
      (
        dndCore as unknown as {
          __triggerDragEnd: (
            index: number,
            activeId: string,
            overId: string | null,
          ) => void;
        }
      ).__triggerDragEnd(0, "downloads", "show_hide");
    });

    expect(mockTraySetMenuConfig).toHaveBeenCalledWith({
      items: ["downloads", "show_hide", "settings", "quit"],
      priorityItems: [],
    });
  });

  it("persists priority as ordered enabled subset without quit", async () => {
    mockTrayGetMenuConfig.mockResolvedValue({
      items: ["show_hide", "settings", "downloads", "quit"],
      priorityItems: ["settings"],
    });

    await act(async () => {
      render(<TrayMenuCustomizer t={mockT} />);
    });

    const downloadsRow = screen.getByText("Downloads").closest("div");
    expect(downloadsRow).not.toBeNull();
    if (!downloadsRow) return;

    await act(async () => {
      fireEvent.click(
        within(downloadsRow).getByRole("button", { name: "Mark as Priority" }),
      );
    });

    await act(async () => {
      (
        dndCore as unknown as {
          __triggerDragEnd: (
            index: number,
            activeId: string,
            overId: string | null,
          ) => void;
        }
      ).__triggerDragEnd(0, "downloads", "settings");
    });

    expect(mockTraySetMenuConfig).toHaveBeenLastCalledWith({
      items: ["downloads", "settings", "show_hide", "quit"],
      priorityItems: ["downloads", "settings"],
    });
  });

  it("reset button calls trayResetMenuConfig and reloads config", async () => {
    mockTrayResetMenuConfig.mockResolvedValue(undefined);
    mockTrayGetMenuConfig.mockResolvedValue({
      items: ["show_hide", "settings", "quit"],
      priorityItems: [],
    });

    await act(async () => {
      render(<TrayMenuCustomizer t={mockT} />);
    });

    await act(async () => {
      fireEvent.click(screen.getByText("Reset"));
    });

    expect(mockTrayResetMenuConfig).toHaveBeenCalled();
    expect(mockTrayGetMenuConfig).toHaveBeenCalledTimes(2);
  });

  it("does nothing when not in Tauri", async () => {
    mockIsTauri.mockReturnValue(false);

    await act(async () => {
      render(<TrayMenuCustomizer t={mockT} />);
    });

    expect(mockTrayGetAvailableMenuItems).not.toHaveBeenCalled();
  });

  it("handles API error gracefully", async () => {
    const consoleSpy = jest
      .spyOn(console, "error")
      .mockImplementation(() => {});
    mockTrayGetAvailableMenuItems.mockRejectedValue(new Error("API error"));

    await act(async () => {
      render(<TrayMenuCustomizer t={mockT} />);
    });

    expect(screen.queryByText("Customize Menu")).toBeInTheDocument();
    consoleSpy.mockRestore();
  });
});
