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
          settings: {
            range: "7d",
            metric: "installations",
            viewMode: "single",
            useSharedRange: true,
          },
        }}
        onUpdateSettings={onUpdateSettings}
        onResetSettings={jest.fn()}
      />,
    );

    await user.click(screen.getByTestId("widget-settings-range-w-trends"));
    await user.click(screen.getByTestId("widget-settings-metric-w-trends"));
    await user.click(screen.getByTestId("widget-settings-view-mode-w-trends"));
    await user.click(screen.getByTestId("widget-settings-shared-range-w-trends"));

    expect(onUpdateSettings).toHaveBeenNthCalledWith(1, "w-trends", {
      range: "30d",
      metric: "installations",
      viewMode: "single",
      useSharedRange: true,
    });
    expect(onUpdateSettings).toHaveBeenNthCalledWith(2, "w-trends", {
      range: "7d",
      metric: "downloads",
      viewMode: "single",
      useSharedRange: true,
    });
    expect(onUpdateSettings).toHaveBeenNthCalledWith(3, "w-trends", {
      range: "7d",
      metric: "installations",
      viewMode: "comparison",
      useSharedRange: true,
    });
    expect(onUpdateSettings).toHaveBeenNthCalledWith(4, "w-trends", {
      range: "7d",
      metric: "installations",
      viewMode: "single",
      useSharedRange: false,
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

  it("updates provider health matrix settings and resets them", async () => {
    const user = userEvent.setup();
    const onUpdateSettings = jest.fn();
    const onResetSettings = jest.fn();

    render(
      <WidgetSettingsToolbar
        widget={{
          id: "w-health",
          type: "provider-health-matrix",
          size: "md",
          visible: true,
          settings: {
            groupBy: "provider",
            showHealthy: true,
            viewMode: "status-list",
          },
        }}
        onUpdateSettings={onUpdateSettings}
        onResetSettings={onResetSettings}
      />,
    );

    await user.click(screen.getByTestId("widget-settings-group-w-health"));
    await user.click(screen.getByTestId("widget-settings-healthy-w-health"));
    await user.click(screen.getByTestId("widget-settings-view-mode-w-health"));
    await user.click(screen.getByTestId("widget-settings-reset-w-health"));

    expect(onUpdateSettings).toHaveBeenNthCalledWith(1, "w-health", {
      groupBy: "environment",
      showHealthy: true,
      viewMode: "status-list",
    });
    expect(onUpdateSettings).toHaveBeenNthCalledWith(2, "w-health", {
      groupBy: "provider",
      showHealthy: false,
      viewMode: "status-list",
    });
    expect(onUpdateSettings).toHaveBeenNthCalledWith(3, "w-health", {
      groupBy: "provider",
      showHealthy: true,
      viewMode: "heatmap",
    });
    expect(onResetSettings).toHaveBeenCalledWith("w-health");
  });

  it("uses fallback defaults for provider health matrix when settings are missing", async () => {
    const user = userEvent.setup();
    const onUpdateSettings = jest.fn();

    render(
      <WidgetSettingsToolbar
        widget={{
          id: "w-health-defaults",
          type: "provider-health-matrix",
          size: "md",
          visible: true,
        }}
        onUpdateSettings={onUpdateSettings}
        onResetSettings={jest.fn()}
      />,
    );

    await user.click(screen.getByTestId("widget-settings-group-w-health-defaults"));

    expect(onUpdateSettings).toHaveBeenCalledWith("w-health-defaults", {
      groupBy: "environment",
      showHealthy: true,
      viewMode: "status-list",
    });
  });

  it("updates activity timeline settings and resets them", async () => {
    const user = userEvent.setup();
    const onUpdateSettings = jest.fn();
    const onResetSettings = jest.fn();

    render(
      <WidgetSettingsToolbar
        widget={{
          id: "w-activity",
          type: "activity-timeline",
          size: "md",
          visible: true,
          settings: {
            range: "7d",
            viewMode: "distribution",
            useSharedRange: true,
          },
        }}
        onUpdateSettings={onUpdateSettings}
        onResetSettings={onResetSettings}
      />,
    );

    await user.click(screen.getByTestId("widget-settings-range-w-activity"));
    await user.click(screen.getByTestId("widget-settings-view-mode-w-activity"));
    await user.click(screen.getByTestId("widget-settings-shared-range-w-activity"));
    await user.click(screen.getByTestId("widget-settings-reset-w-activity"));

    expect(onUpdateSettings).toHaveBeenNthCalledWith(1, "w-activity", {
      range: "30d",
      viewMode: "distribution",
      useSharedRange: true,
    });
    expect(onUpdateSettings).toHaveBeenNthCalledWith(2, "w-activity", {
      range: "7d",
      viewMode: "intensity",
      useSharedRange: true,
    });
    expect(onUpdateSettings).toHaveBeenNthCalledWith(3, "w-activity", {
      range: "7d",
      viewMode: "distribution",
      useSharedRange: false,
    });
    expect(onResetSettings).toHaveBeenCalledWith("w-activity");
  });

  it("updates recent activity feed settings and resets them", async () => {
    const user = userEvent.setup();
    const onUpdateSettings = jest.fn();
    const onResetSettings = jest.fn();

    render(
      <WidgetSettingsToolbar
        widget={{
          id: "w-feed",
          type: "recent-activity-feed",
          size: "md",
          visible: true,
          settings: {
            limit: 5,
            useSharedRange: true,
          },
        }}
        onUpdateSettings={onUpdateSettings}
        onResetSettings={onResetSettings}
      />,
    );

    await user.click(screen.getByTestId("widget-settings-limit-w-feed"));
    await user.click(screen.getByTestId("widget-settings-shared-range-w-feed"));
    await user.click(screen.getByTestId("widget-settings-reset-w-feed"));

    expect(onUpdateSettings).toHaveBeenNthCalledWith(1, "w-feed", {
      limit: 10,
      useSharedRange: true,
    });
    expect(onUpdateSettings).toHaveBeenNthCalledWith(2, "w-feed", {
      limit: 5,
      useSharedRange: false,
    });
    expect(onResetSettings).toHaveBeenCalledWith("w-feed");
  });

  it("uses fallback defaults for recent activity feed when settings are missing", async () => {
    const user = userEvent.setup();
    const onUpdateSettings = jest.fn();

    render(
      <WidgetSettingsToolbar
        widget={{
          id: "w-feed-defaults",
          type: "recent-activity-feed",
          size: "md",
          visible: true,
        }}
        onUpdateSettings={onUpdateSettings}
        onResetSettings={jest.fn()}
      />,
    );

    await user.click(screen.getByTestId("widget-settings-limit-w-feed-defaults"));

    expect(onUpdateSettings).toHaveBeenCalledWith("w-feed-defaults", {
      limit: 10,
      useSharedRange: true,
    });
  });

  it("renders nothing for unsupported widget types", () => {
    const { container } = render(
      <WidgetSettingsToolbar
        widget={{
          id: "w-unsupported",
          type: "stats-overview",
          size: "full",
          visible: true,
        }}
        onUpdateSettings={jest.fn()}
        onResetSettings={jest.fn()}
      />,
    );

    expect(container).toBeEmptyDOMElement();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});
