import { render, screen } from "@testing-library/react";
import { CustomizeDialog } from "./customize-dialog";

jest.mock("@/components/providers/locale-provider", () => ({
  useLocale: () => ({ t: (key: string) => key }),
}));

jest.mock("@/lib/stores/dashboard", () => {
  const store = {
    widgets: [],
    addWidget: jest.fn(),
    removeWidget: jest.fn(),
    resetToDefault: jest.fn(),
  };
  return {
    useDashboardStore: (selector: (s: typeof store) => unknown) => selector(store),
    WIDGET_DEFINITIONS: [
      { type: "stats", titleKey: "dashboard.stats", descriptionKey: "dashboard.statsDesc", defaultSize: "sm", category: "general" },
    ],
  };
});

describe("CustomizeDialog", () => {
  it("renders dialog title when open", () => {
    render(
      <CustomizeDialog open={true} onOpenChange={jest.fn()} />,
    );
    expect(screen.getByText("dashboard.widgets.customizeTitle")).toBeInTheDocument();
  });

  it("does not render content when closed", () => {
    render(
      <CustomizeDialog open={false} onOpenChange={jest.fn()} />,
    );
    expect(screen.queryByText("dashboard.widgets.customizeTitle")).not.toBeInTheDocument();
  });
});
