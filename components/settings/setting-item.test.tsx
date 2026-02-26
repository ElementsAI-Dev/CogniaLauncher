import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { SettingItem, validateField } from "./setting-item";

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
});
