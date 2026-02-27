import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import {
  SettingItem,
  validateField,
  SwitchSettingItem,
  SelectSettingItem,
  SliderSettingItem,
} from "./setting-item";

// Mock translation function
const mockT = (key: string, params?: Record<string, string | number>) => {
  const translations: Record<string, string> = {
    "validation.mustBeNumber": "Must be a number",
    "validation.min": `Minimum value is ${params?.min ?? ""}`,
    "validation.max": `Maximum value is ${params?.max ?? ""}`,
    "validation.invalidFormat": "Invalid format",
    "validation.mustBeValidUrl": "Must be a valid URL",
    "validation.mustBeValidUrlOrEmpty": "Must be a valid URL or empty",
    "validation.mustBeValidProxyUrlOrEmpty": "Must be a valid proxy URL or empty",
    "validation.mustBeValidNoProxyList": "Must be a valid no_proxy list",
  };
  return translations[key] || key;
};

describe("validateField", () => {
  describe("numeric validation", () => {
    it("should return null for valid parallel downloads value", () => {
      expect(
        validateField("general.parallel_downloads", "4", mockT),
      ).toBeNull();
      expect(
        validateField("general.parallel_downloads", "1", mockT),
      ).toBeNull();
      expect(
        validateField("general.parallel_downloads", "16", mockT),
      ).toBeNull();
    });

    it("should return error for non-numeric value", () => {
      expect(validateField("general.parallel_downloads", "abc", mockT)).toBe(
        "Must be a number",
      );
    });

    it("should return error for value below minimum", () => {
      expect(validateField("general.parallel_downloads", "0", mockT)).toBe(
        "Minimum value is 1",
      );
    });

    it("should return error for value above maximum", () => {
      expect(validateField("general.parallel_downloads", "20", mockT)).toBe(
        "Maximum value is 16",
      );
    });

    it("should validate network timeout range", () => {
      expect(validateField("network.timeout", "30", mockT)).toBeNull();
      expect(validateField("network.timeout", "4", mockT)).toBe(
        "Minimum value is 5",
      );
      expect(validateField("network.timeout", "400", mockT)).toBe(
        "Maximum value is 300",
      );
    });

    it("should validate network retries range", () => {
      expect(validateField("network.retries", "3", mockT)).toBeNull();
      expect(validateField("network.retries", "-1", mockT)).toBe(
        "Minimum value is 0",
      );
      expect(validateField("network.retries", "15", mockT)).toBe(
        "Maximum value is 10",
      );
    });

    it("should validate metadata cache TTL range", () => {
      expect(
        validateField("general.metadata_cache_ttl", "3600", mockT),
      ).toBeNull();
      expect(validateField("general.metadata_cache_ttl", "30", mockT)).toBe(
        "Minimum value is 60",
      );
      expect(validateField("general.metadata_cache_ttl", "100000", mockT)).toBe(
        "Maximum value is 86400",
      );
    });
  });

  describe("URL pattern validation", () => {
    it("should return null for valid proxy URL", () => {
      expect(
        validateField("network.proxy", "http://localhost:8080", mockT),
      ).toBeNull();
      expect(
        validateField("network.proxy", "https://proxy.example.com", mockT),
      ).toBeNull();
      expect(
        validateField("network.proxy", "socks5://127.0.0.1:1080", mockT),
      ).toBeNull();
      expect(validateField("network.proxy", "", mockT)).toBeNull(); // Empty is allowed
    });

    it("should return error for invalid proxy URL", () => {
      expect(validateField("network.proxy", "not-a-url", mockT)).toBe(
        "Must be a valid proxy URL or empty",
      );
    });

    it("should return null for valid no_proxy list", () => {
      expect(validateField("network.no_proxy", "localhost,127.0.0.1,.corp.com", mockT)).toBeNull();
      expect(validateField("network.no_proxy", "", mockT)).toBeNull();
    });

    it("should return error for invalid no_proxy list", () => {
      expect(validateField("network.no_proxy", "localhost;bad!chars", mockT)).toBe(
        "Must be a valid no_proxy list",
      );
    });

    it("should validate NPM registry URL", () => {
      expect(
        validateField("mirrors.npm", "https://registry.npmjs.org", mockT),
      ).toBeNull();
      expect(validateField("mirrors.npm", "invalid", mockT)).toBe(
        "Must be a valid URL",
      );
    });

    it("should validate PyPI index URL", () => {
      expect(
        validateField("mirrors.pypi", "https://pypi.org/simple", mockT),
      ).toBeNull();
      expect(validateField("mirrors.pypi", "ftp://invalid", mockT)).toBe(
        "Must be a valid URL",
      );
    });
  });

  describe("unknown keys", () => {
    it("should return null for unknown config keys", () => {
      expect(validateField("unknown.key", "any value", mockT)).toBeNull();
    });
  });
});

describe("SettingItem", () => {
  const defaultProps = {
    id: "test-setting",
    label: "Test Label",
    description: "Test description",
    value: "test value",
    onChange: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should render label and description", () => {
    render(<SettingItem {...defaultProps} />);

    expect(screen.getByText("Test Label")).toBeInTheDocument();
    expect(screen.getByText("Test description")).toBeInTheDocument();
  });

  it("should render input with correct value", () => {
    render(<SettingItem {...defaultProps} />);

    const input = screen.getByRole("textbox");
    expect(input).toHaveValue("test value");
  });

  it("should call onChange when input value changes", () => {
    const onChange = jest.fn();
    render(<SettingItem {...defaultProps} onChange={onChange} />);

    const input = screen.getByRole("textbox");
    fireEvent.change(input, { target: { value: "new value" } });

    expect(onChange).toHaveBeenCalledWith("new value");
  });

  it("should render number input when type is number", () => {
    render(<SettingItem {...defaultProps} type="number" value="42" />);

    const input = screen.getByRole("spinbutton");
    expect(input).toHaveValue(42);
  });

  it("should display error message when error prop is provided", () => {
    render(<SettingItem {...defaultProps} error="This is an error" />);

    expect(screen.getByText("This is an error")).toBeInTheDocument();
    expect(screen.getByRole("textbox")).toHaveAttribute("aria-invalid", "true");
  });

  it("should have proper accessibility attributes", () => {
    render(<SettingItem {...defaultProps} />);

    const input = screen.getByRole("textbox");
    expect(input).toHaveAttribute("id", "test-setting");
    expect(input).toHaveAttribute("aria-describedby", "test-setting-desc");
  });

  it("should apply min and max attributes for number inputs", () => {
    render(
      <SettingItem
        {...defaultProps}
        type="number"
        value="5"
        min={1}
        max={10}
      />,
    );

    const input = screen.getByRole("spinbutton");
    expect(input).toHaveAttribute("min", "1");
    expect(input).toHaveAttribute("max", "10");
  });

  it("should render disabled input when disabled prop is true", () => {
    render(<SettingItem {...defaultProps} disabled={true} />);

    expect(screen.getByRole("textbox")).toBeDisabled();
  });

  it("should render placeholder text", () => {
    render(<SettingItem {...defaultProps} placeholder="Enter value" />);

    expect(screen.getByPlaceholderText("Enter value")).toBeInTheDocument();
  });

  it("should show modified indicator when value differs from originalValue", () => {
    render(
      <SettingItem
        {...defaultProps}
        value="new"
        originalValue="old"
        modifiedLabel="Changed"
      />,
    );

    expect(screen.getByLabelText("Changed")).toBeInTheDocument();
  });

  it("should not show modified indicator when value matches originalValue", () => {
    render(
      <SettingItem {...defaultProps} value="same" originalValue="same" />,
    );

    expect(screen.queryByLabelText("Modified")).not.toBeInTheDocument();
  });

  it("should apply highlight style when highlightMatch is true", () => {
    const { container } = render(
      <SettingItem {...defaultProps} highlightMatch={true} />,
    );

    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper.className).toContain("bg-yellow");
  });

  it("should include error id in aria-describedby when error is present", () => {
    render(<SettingItem {...defaultProps} error="Some error" />);

    const input = screen.getByRole("textbox");
    expect(input).toHaveAttribute(
      "aria-describedby",
      "test-setting-desc test-setting-error",
    );
  });
});

describe("SwitchSettingItem", () => {
  const defaultProps = {
    id: "test-switch",
    label: "Enable Feature",
    description: "Toggle this feature on or off",
    checked: false,
    onCheckedChange: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should render label and description", () => {
    render(<SwitchSettingItem {...defaultProps} />);

    expect(screen.getByText("Enable Feature")).toBeInTheDocument();
    expect(
      screen.getByText("Toggle this feature on or off"),
    ).toBeInTheDocument();
  });

  it("should render switch with correct checked state", () => {
    render(<SwitchSettingItem {...defaultProps} checked={true} />);

    expect(screen.getByRole("switch")).toBeChecked();
  });

  it("should render switch unchecked", () => {
    render(<SwitchSettingItem {...defaultProps} checked={false} />);

    expect(screen.getByRole("switch")).not.toBeChecked();
  });

  it("should call onCheckedChange when toggled", () => {
    const onCheckedChange = jest.fn();
    render(
      <SwitchSettingItem {...defaultProps} onCheckedChange={onCheckedChange} />,
    );

    fireEvent.click(screen.getByRole("switch"));

    expect(onCheckedChange).toHaveBeenCalledWith(true);
  });

  it("should be disabled when disabled prop is true", () => {
    render(<SwitchSettingItem {...defaultProps} disabled={true} />);

    expect(screen.getByRole("switch")).toBeDisabled();
  });

  it("should have proper accessibility attributes", () => {
    render(<SwitchSettingItem {...defaultProps} />);

    const switchEl = screen.getByRole("switch");
    expect(switchEl).toHaveAttribute("id", "test-switch");
    expect(switchEl).toHaveAttribute("aria-describedby", "test-switch-desc");
  });

  it("should apply highlight style when highlightMatch is true", () => {
    const { container } = render(
      <SwitchSettingItem {...defaultProps} highlightMatch={true} />,
    );

    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper.className).toContain("bg-yellow");
  });
});

describe("SelectSettingItem", () => {
  const options = [
    { value: "a", label: "Option A" },
    { value: "b", label: "Option B" },
    { value: "c", label: "Option C" },
  ];

  const defaultProps = {
    id: "test-select",
    label: "Choose Option",
    description: "Select one of the options",
    value: "a",
    onValueChange: jest.fn(),
    options,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should render label and description", () => {
    render(<SelectSettingItem {...defaultProps} />);

    expect(screen.getByText("Choose Option")).toBeInTheDocument();
    expect(
      screen.getByText("Select one of the options"),
    ).toBeInTheDocument();
  });

  it("should render with current value displayed", () => {
    render(<SelectSettingItem {...defaultProps} />);

    expect(screen.getByText("Option A")).toBeInTheDocument();
  });

  it("should be disabled when disabled prop is true", () => {
    render(<SelectSettingItem {...defaultProps} disabled={true} />);

    const trigger = screen.getByRole("combobox");
    expect(trigger).toBeDisabled();
  });

  it("should have proper accessibility attributes", () => {
    render(<SelectSettingItem {...defaultProps} />);

    const trigger = screen.getByRole("combobox");
    expect(trigger).toHaveAttribute("id", "test-select");
    expect(trigger).toHaveAttribute("aria-describedby", "test-select-desc");
  });

  it("should apply custom triggerClassName", () => {
    render(
      <SelectSettingItem {...defaultProps} triggerClassName="w-32" />,
    );

    const trigger = screen.getByRole("combobox");
    expect(trigger.className).toContain("w-32");
  });

  it("should apply highlight style when highlightMatch is true", () => {
    const { container } = render(
      <SelectSettingItem {...defaultProps} highlightMatch={true} />,
    );

    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper.className).toContain("bg-yellow");
  });
});

describe("SliderSettingItem", () => {
  const defaultProps = {
    id: "test-slider",
    label: "Volume",
    description: "Adjust the volume level",
    value: 50,
    onValueChange: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should render label and description", () => {
    render(<SliderSettingItem {...defaultProps} />);

    expect(screen.getByText("Volume")).toBeInTheDocument();
    expect(screen.getByText("Adjust the volume level")).toBeInTheDocument();
  });

  it("should display current value", () => {
    render(<SliderSettingItem {...defaultProps} value={75} />);

    expect(screen.getByText("75")).toBeInTheDocument();
  });

  it("should display value with unit", () => {
    render(<SliderSettingItem {...defaultProps} value={50} unit="%" />);

    expect(screen.getByText("50%")).toBeInTheDocument();
  });

  it("should render slider element", () => {
    render(<SliderSettingItem {...defaultProps} />);

    expect(screen.getByRole("slider")).toBeInTheDocument();
  });

  it("should be disabled when disabled prop is true", () => {
    render(<SliderSettingItem {...defaultProps} disabled={true} />);

    const slider = screen.getByRole("slider");
    // Radix Slider sets data-disabled on the root and aria-disabled on the thumb
    expect(slider).toHaveAttribute("data-disabled");
  });

  it("should have proper id attribute", () => {
    const { container } = render(<SliderSettingItem {...defaultProps} />);

    // The Slider root receives the id
    const sliderRoot = container.querySelector("#test-slider");
    expect(sliderRoot).toBeInTheDocument();
  });

  it("should apply highlight style when highlightMatch is true", () => {
    const { container } = render(
      <SliderSettingItem {...defaultProps} highlightMatch={true} />,
    );

    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper.className).toContain("bg-yellow");
  });
});

describe("validateField - additional cases", () => {
  it("should validate cache_max_size range", () => {
    expect(
      validateField("general.cache_max_size", "5368709120", mockT),
    ).toBeNull();
    expect(
      validateField("general.cache_max_size", "100", mockT),
    ).toBe("Minimum value is 104857600");
  });

  it("should validate cache_max_age_days range", () => {
    expect(
      validateField("general.cache_max_age_days", "30", mockT),
    ).toBeNull();
    expect(
      validateField("general.cache_max_age_days", "0", mockT),
    ).toBe("Minimum value is 1");
    expect(
      validateField("general.cache_max_age_days", "400", mockT),
    ).toBe("Maximum value is 365");
  });

  it("should validate cache_auto_clean_threshold range", () => {
    expect(
      validateField("general.cache_auto_clean_threshold", "80", mockT),
    ).toBeNull();
    expect(
      validateField("general.cache_auto_clean_threshold", "-1", mockT),
    ).toBe("Minimum value is 0");
    expect(
      validateField("general.cache_auto_clean_threshold", "101", mockT),
    ).toBe("Maximum value is 100");
  });

  it("should validate cache_monitor_interval range", () => {
    expect(
      validateField("general.cache_monitor_interval", "300", mockT),
    ).toBeNull();
    expect(
      validateField("general.cache_monitor_interval", "-1", mockT),
    ).toBe("Minimum value is 0");
    expect(
      validateField("general.cache_monitor_interval", "4000", mockT),
    ).toBe("Maximum value is 3600");
  });

  it("should validate download_speed_limit range", () => {
    expect(
      validateField("general.download_speed_limit", "0", mockT),
    ).toBeNull();
    expect(
      validateField("general.download_speed_limit", "-1", mockT),
    ).toBe("Minimum value is 0");
  });

  it("should validate crates registry URL", () => {
    expect(
      validateField("mirrors.crates", "https://crates.io", mockT),
    ).toBeNull();
    expect(validateField("mirrors.crates", "bad", mockT)).toBe(
      "Must be a valid URL",
    );
  });

  it("should validate go proxy URL", () => {
    expect(
      validateField("mirrors.go", "https://proxy.golang.org", mockT),
    ).toBeNull();
    expect(validateField("mirrors.go", "bad", mockT)).toBe(
      "Must be a valid URL",
    );
  });

  it("should validate min_install_space_mb range", () => {
    expect(
      validateField("general.min_install_space_mb", "100", mockT),
    ).toBeNull();
    expect(
      validateField("general.min_install_space_mb", "5", mockT),
    ).toBe("Minimum value is 10");
    expect(
      validateField("general.min_install_space_mb", "20000", mockT),
    ).toBe("Maximum value is 10240");
  });
});
