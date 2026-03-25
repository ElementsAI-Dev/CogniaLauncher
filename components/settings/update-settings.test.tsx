import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { UpdateSettings } from "./update-settings";
import type { AppSettings } from "@/lib/stores/settings";
import { DEFAULT_SIDEBAR_ITEM_ORDER } from "@/lib/sidebar/order";

const mockT = (key: string) => {
  const translations: Record<string, string> = {
    "settings.updates": "Updates",
    "settings.updatesDesc": "Configure update checks and notifications",
    "settings.checkUpdatesOnStart": "Check on Start",
    "settings.checkUpdatesOnStartDesc": "Auto check",
    "settings.autoInstallUpdates": "Auto Install Updates",
    "settings.autoInstallUpdatesDesc": "Auto install",
    "settings.notifyOnUpdates": "Notify on Updates",
    "settings.notifyOnUpdatesDesc": "Notify on updates",
    "settings.updateSourceMode": "Update Source",
    "settings.updateSourceModeDesc": "Select update source",
    "settings.updateSourceModeOfficial": "Official",
    "settings.updateSourceModeMirror": "Mirror",
    "settings.updateSourceModeCustom": "Custom",
    "settings.updateCustomEndpoints": "Custom Endpoints",
    "settings.updateCustomEndpointsDesc": "One endpoint per line",
    "settings.updateCustomEndpointsPlaceholder":
      "https://updates.example.com/{{target}}/{{current_version}}",
    "settings.updateCustomEndpointsHint": "Only HTTPS endpoints are allowed",
    "settings.updateCustomEndpointsErrorRequired":
      "At least one valid HTTPS endpoint is required for custom mode.",
    "settings.updateCustomEndpointsErrorInvalid":
      "Please provide valid HTTPS endpoint URLs (one per line).",
    "settings.updateFallbackToOfficial": "Fallback to Official",
    "settings.updateFallbackToOfficialDesc": "Retry official source",
  };
  return translations[key] || key;
};

describe("UpdateSettings", () => {
  const appSettings: AppSettings = {
    checkUpdatesOnStart: true,
    autoInstallUpdates: false,
    notifyOnUpdates: true,
    updateSourceMode: "official",
    updateCustomEndpoints: [],
    updateFallbackToOfficial: true,
    minimizeToTray: true,
    startMinimized: false,
    autostart: false,
    trayClickBehavior: "toggle_window",
    showNotifications: true,
    trayNotificationLevel: "all",
    sidebarItemOrder: [...DEFAULT_SIDEBAR_ITEM_ORDER],
  };

  it("should render update settings content", () => {
    render(
      <UpdateSettings
        appSettings={appSettings}
        onValueChange={jest.fn()}
        t={mockT}
      />,
    );

    // Title/description are now provided by parent CollapsibleSection
    expect(screen.getByText("Check on Start")).toBeInTheDocument();
    expect(screen.getByText("Update Source")).toBeInTheDocument();
    expect(screen.getByText("Fallback to Official")).toBeInTheDocument();
  });

  it("should call onValueChange when toggles change", () => {
    const onValueChange = jest.fn();
    render(
      <UpdateSettings
        appSettings={appSettings}
        onValueChange={onValueChange}
        t={mockT}
      />,
    );

    fireEvent.click(screen.getByRole("switch", { name: "Check on Start" }));
    fireEvent.click(
      screen.getByRole("switch", { name: "Auto Install Updates" }),
    );
    fireEvent.click(screen.getByRole("switch", { name: "Notify on Updates" }));
    fireEvent.click(
      screen.getByRole("switch", { name: "Fallback to Official" }),
    );

    expect(onValueChange).toHaveBeenCalledWith("checkUpdatesOnStart", false);
    expect(onValueChange).toHaveBeenCalledWith("autoInstallUpdates", true);
    expect(onValueChange).toHaveBeenCalledWith("notifyOnUpdates", false);
    expect(onValueChange).toHaveBeenCalledWith("updateFallbackToOfficial", false);
  });

  it("switches source mode through select interaction", async () => {
    const onValueChange = jest.fn();
    render(
      <UpdateSettings
        appSettings={appSettings}
        onValueChange={onValueChange}
        t={mockT}
      />,
    );

    await userEvent.click(screen.getByRole("combobox", { name: "Update Source" }));
    await userEvent.click(screen.getByRole("option", { name: "Mirror" }));

    expect(onValueChange).toHaveBeenCalledWith("updateSourceMode", "mirror");
  });

  it("validates and commits custom endpoints in custom mode", async () => {
    const onValueChange = jest.fn();
    render(
      <UpdateSettings
        appSettings={{
          ...appSettings,
          updateSourceMode: "custom",
          updateCustomEndpoints: [],
        }}
        onValueChange={onValueChange}
        t={mockT}
      />,
    );

    const textarea = screen.getByRole("textbox", { name: "Custom Endpoints" });
    fireEvent.change(textarea, {
      target: {
        value: "https://updates.example.com/{{target}}/{{current_version}}",
      },
    });
    fireEvent.blur(textarea);

    expect(onValueChange).toHaveBeenCalledWith("updateCustomEndpoints", [
      "https://updates.example.com/{{target}}/{{current_version}}",
    ]);
  });

  it("blocks switching to custom mode when no custom endpoints are provided", async () => {
    const onValueChange = jest.fn();
    render(
      <UpdateSettings
        appSettings={appSettings}
        onValueChange={onValueChange}
        t={mockT}
      />,
    );

    await userEvent.click(screen.getByRole("combobox", { name: "Update Source" }));
    await userEvent.click(screen.getByRole("option", { name: "Custom" }));

    expect(
      screen.getByText("At least one valid HTTPS endpoint is required for custom mode."),
    ).toBeInTheDocument();
    expect(onValueChange).not.toHaveBeenCalledWith("updateSourceMode", "custom");
  });

  it("shows validation error for invalid custom endpoint templates", () => {
    const onValueChange = jest.fn();
    render(
      <UpdateSettings
        appSettings={{
          ...appSettings,
          updateSourceMode: "custom",
          updateCustomEndpoints: [],
        }}
        onValueChange={onValueChange}
        t={mockT}
      />,
    );

    const textarea = screen.getByRole("textbox", { name: "Custom Endpoints" });
    fireEvent.change(textarea, {
      target: {
        value: "http://insecure.example.com/latest.json",
      },
    });
    fireEvent.blur(textarea);

    expect(
      screen.getByText("Please provide valid HTTPS endpoint URLs (one per line)."),
    ).toBeInTheDocument();
    expect(onValueChange).not.toHaveBeenCalledWith("updateCustomEndpoints", expect.anything());
  });

  it("deduplicates custom endpoints before committing them", () => {
    const onValueChange = jest.fn();
    render(
      <UpdateSettings
        appSettings={{
          ...appSettings,
          updateSourceMode: "custom",
          updateCustomEndpoints: [],
        }}
        onValueChange={onValueChange}
        t={mockT}
      />,
    );

    const textarea = screen.getByRole("textbox", { name: "Custom Endpoints" });
    fireEvent.change(textarea, {
      target: {
        value: [
          "https://updates.example.com/{{target}}/{{current_version}}",
          "https://updates.example.com/{{target}}/{{current_version}}",
        ].join("\n"),
      },
    });
    fireEvent.blur(textarea);

    expect(onValueChange).toHaveBeenCalledWith("updateCustomEndpoints", [
      "https://updates.example.com/{{target}}/{{current_version}}",
    ]);
  });

  it("does not commit blur updates when source mode is not custom", () => {
    const onValueChange = jest.fn();
    render(
      <UpdateSettings
        appSettings={appSettings}
        onValueChange={onValueChange}
        t={mockT}
      />,
    );

    fireEvent.blur(screen.queryByRole("textbox", { name: "Custom Endpoints" }) ?? document.body);

    expect(onValueChange).not.toHaveBeenCalledWith("updateCustomEndpoints", expect.anything());
  });

  it("switches source mode to custom on blur after valid custom endpoint input", () => {
    const onValueChange = jest.fn();
    render(
      <UpdateSettings
        appSettings={{
          ...appSettings,
          updateCustomEndpoints: [
            "https://updates.example.com/{{target}}/{{current_version}}",
          ],
        }}
        onValueChange={onValueChange}
        t={mockT}
      />,
    );

    fireEvent.click(screen.getByRole("combobox", { name: "Update Source" }));
    fireEvent.click(screen.getByRole("option", { name: "Custom" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Custom Endpoints" }), {
      target: {
        value: "https://updates.example.com/{{target}}/{{current_version}}",
      },
    });
    fireEvent.blur(screen.getByRole("textbox", { name: "Custom Endpoints" }));

    expect(onValueChange).toHaveBeenCalledWith("updateCustomEndpoints", [
      "https://updates.example.com/{{target}}/{{current_version}}",
    ]);
    expect(onValueChange).toHaveBeenCalledWith("updateSourceMode", "custom");
  });

  it("resets custom endpoint draft when app settings change", () => {
    const onValueChange = jest.fn();
    const { rerender } = render(
      <UpdateSettings
        appSettings={{
          ...appSettings,
          updateSourceMode: "custom",
          updateCustomEndpoints: [
            "https://updates.old.example.com/{{target}}/{{current_version}}",
          ],
        }}
        onValueChange={onValueChange}
        t={mockT}
      />,
    );

    const textarea = screen.getByRole("textbox", { name: "Custom Endpoints" });
    expect(textarea).toHaveValue(
      "https://updates.old.example.com/{{target}}/{{current_version}}",
    );

    fireEvent.change(textarea, {
      target: {
        value: "https://draft.example.com/{{target}}/{{current_version}}",
      },
    });

    expect(screen.getByRole("textbox", { name: "Custom Endpoints" })).toHaveValue(
      "https://draft.example.com/{{target}}/{{current_version}}",
    );

    rerender(
      <UpdateSettings
        appSettings={{
          ...appSettings,
          updateSourceMode: "custom",
          updateCustomEndpoints: [
            "https://updates.new.example.com/{{target}}/{{current_version}}",
          ],
        }}
        onValueChange={onValueChange}
        t={mockT}
      />,
    );

    expect(screen.getByRole("textbox", { name: "Custom Endpoints" })).toHaveValue(
      "https://updates.new.example.com/{{target}}/{{current_version}}",
    );
  });
});
