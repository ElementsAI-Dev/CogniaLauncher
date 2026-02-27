import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { ProviderSettings } from "./provider-settings";

const mockT = (key: string) => {
  const translations: Record<string, string> = {
    "settings.providerSettings": "Provider Settings",
    "settings.providerSettingsDesc": "Control provider availability globally",
    "settings.disabledProviders": "Disabled Providers",
    "settings.disabledProvidersDesc": "Comma-separated provider IDs to disable",
    "settings.disabledProvidersPlaceholder": "e.g., brew, apt",
    "settings.disabledProvidersHint": "Changes apply after restarting the app",
  };
  return translations[key] || key;
};

describe("ProviderSettings", () => {
  const defaultProps = {
    localConfig: {
      "provider_settings.disabled_providers": "brew, apt",
    },
    errors: {},
    onValueChange: jest.fn(),
    t: mockT,
  };

  it("should render provider settings content", () => {
    render(<ProviderSettings {...defaultProps} />);

    // Title/description are now provided by parent CollapsibleSection
    expect(screen.getByText("Disabled Providers")).toBeInTheDocument();
  });

  it("should display current disabled providers", () => {
    render(<ProviderSettings {...defaultProps} />);

    expect(screen.getByLabelText("Disabled Providers")).toHaveValue(
      "brew, apt",
    );
  });

  it("should call onValueChange when input changes", () => {
    const onValueChange = jest.fn();
    render(
      <ProviderSettings {...defaultProps} onValueChange={onValueChange} />,
    );

    fireEvent.change(screen.getByLabelText("Disabled Providers"), {
      target: { value: "brew" },
    });

    expect(onValueChange).toHaveBeenCalledWith(
      "provider_settings.disabled_providers",
      "brew",
    );
  });

  it("should normalize JSON array to comma-separated string", () => {
    render(
      <ProviderSettings
        {...defaultProps}
        localConfig={{
          "provider_settings.disabled_providers": '["brew", "apt", "snap"]',
        }}
      />,
    );

    expect(screen.getByLabelText("Disabled Providers")).toHaveValue(
      "brew, apt, snap",
    );
  });

  it("should pass through plain comma-separated values unchanged", () => {
    render(
      <ProviderSettings
        {...defaultProps}
        localConfig={{
          "provider_settings.disabled_providers": "brew, apt",
        }}
      />,
    );

    expect(screen.getByLabelText("Disabled Providers")).toHaveValue(
      "brew, apt",
    );
  });

  it("should handle empty string gracefully", () => {
    render(
      <ProviderSettings
        {...defaultProps}
        localConfig={{ "provider_settings.disabled_providers": "" }}
      />,
    );

    expect(screen.getByLabelText("Disabled Providers")).toHaveValue("");
  });

  it("should handle invalid JSON by returning raw value", () => {
    render(
      <ProviderSettings
        {...defaultProps}
        localConfig={{
          "provider_settings.disabled_providers": "[invalid json",
        }}
      />,
    );

    expect(screen.getByLabelText("Disabled Providers")).toHaveValue(
      "[invalid json",
    );
  });

  it("should render hint alert", () => {
    render(<ProviderSettings {...defaultProps} />);

    expect(
      screen.getByText("Changes apply after restarting the app"),
    ).toBeInTheDocument();
  });

  it("should display validation errors", () => {
    render(
      <ProviderSettings
        {...defaultProps}
        errors={{ "provider_settings.disabled_providers": "Invalid provider" }}
      />,
    );

    expect(screen.getByText("Invalid provider")).toBeInTheDocument();
  });

  it("should handle missing config key", () => {
    render(<ProviderSettings {...defaultProps} localConfig={{}} />);

    expect(screen.getByLabelText("Disabled Providers")).toHaveValue("");
  });
});
