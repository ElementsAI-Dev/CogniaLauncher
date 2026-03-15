import userEvent from "@testing-library/user-event";
import { render, screen } from "@testing-library/react";
import { WidgetSettingsToolbar } from "./widget-settings-toolbar";

jest.mock("@/components/providers/locale-provider", () => ({
  useLocale: () => ({ t: (key: string) => key }),
}));

describe("WidgetSettingsToolbar", () => {
  it("updates workspace trend range and metric settings", async () => {
    const user = userEvent.setup();
    const onUpdateSettings = jest.fn();

    render(
      <WidgetSettingsToolbar
        widget={{
          id: "w-trends",
          type: "workspace-trends",
          size: "lg",
          visible: true,
          settings: { range: "7d", metric: "installations" },
        }}
        onUpdateSettings={onUpdateSettings}
        onResetSettings={jest.fn()}
      />,
    );

    await user.click(screen.getByTestId("widget-settings-range-w-trends"));
    await user.click(screen.getByTestId("widget-settings-metric-w-trends"));

    expect(onUpdateSettings).toHaveBeenNthCalledWith(1, "w-trends", {
      range: "30d",
      metric: "installations",
    });
    expect(onUpdateSettings).toHaveBeenNthCalledWith(2, "w-trends", {
      range: "7d",
      metric: "downloads",
    });
  });

  it("toggles attention center item limit and resets settings", async () => {
    const user = userEvent.setup();
    const onUpdateSettings = jest.fn();
    const onResetSettings = jest.fn();

    render(
      <WidgetSettingsToolbar
        widget={{
          id: "w-attention",
          type: "attention-center",
          size: "md",
          visible: true,
          settings: { maxItems: 3 },
        }}
        onUpdateSettings={onUpdateSettings}
        onResetSettings={onResetSettings}
      />,
    );

    await user.click(screen.getByTestId("widget-settings-limit-w-attention"));
    await user.click(screen.getByTestId("widget-settings-reset-w-attention"));

    expect(onUpdateSettings).toHaveBeenCalledWith("w-attention", { maxItems: 5 });
    expect(onResetSettings).toHaveBeenCalledWith("w-attention");
  });
});
