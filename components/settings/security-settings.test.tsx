import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { SecuritySettings } from "./security-settings";

const mockT = (key: string) => {
  const translations: Record<string, string> = {
    "settings.security": "Security",
    "settings.securityDesc": "Security and verification settings",
    "settings.allowHttp": "Allow HTTP",
    "settings.allowHttpDesc":
      "Allow insecure HTTP connections (not recommended)",
    "settings.verifyCerts": "Verify Certificates",
    "settings.verifyCertsDesc":
      "Validate SSL/TLS certificates for secure connections",
    "settings.allowSelfSigned": "Allow Self-Signed",
    "settings.allowSelfSignedDesc": "Allow self-signed certificates",
  };
  return translations[key] || key;
};

describe("SecuritySettings", () => {
  const defaultProps = {
    localConfig: {
      "security.allow_http": "false",
      "security.verify_certificates": "true",
      "security.allow_self_signed": "false",
    },
    onValueChange: jest.fn(),
    t: mockT,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should render security settings card", () => {
    render(<SecuritySettings {...defaultProps} />);

    expect(screen.getByText("Security")).toBeInTheDocument();
    expect(
      screen.getByText("Security and verification settings"),
    ).toBeInTheDocument();
  });

  it("should render allow HTTP toggle", () => {
    render(<SecuritySettings {...defaultProps} />);

    expect(screen.getByText("Allow HTTP")).toBeInTheDocument();
    expect(
      screen.getByText("Allow insecure HTTP connections (not recommended)"),
    ).toBeInTheDocument();
  });

  it("should render verify certificates toggle", () => {
    render(<SecuritySettings {...defaultProps} />);

    expect(screen.getByText("Verify Certificates")).toBeInTheDocument();
  });

  it("should render allow self-signed toggle", () => {
    render(<SecuritySettings {...defaultProps} />);

    expect(screen.getByText("Allow Self-Signed")).toBeInTheDocument();
  });

  it("should show allow HTTP as unchecked by default", () => {
    render(<SecuritySettings {...defaultProps} />);

    const switches = screen.getAllByRole("switch");
    expect(switches[0]).not.toBeChecked(); // allow_http is false
  });

  it("should show verify certificates as checked by default", () => {
    render(<SecuritySettings {...defaultProps} />);

    const switches = screen.getAllByRole("switch");
    expect(switches[1]).toBeChecked(); // verify_certificates is true
  });

  it("should call onValueChange when allow HTTP is toggled", () => {
    const onValueChange = jest.fn();
    render(
      <SecuritySettings {...defaultProps} onValueChange={onValueChange} />,
    );

    const switches = screen.getAllByRole("switch");
    fireEvent.click(switches[0]);

    expect(onValueChange).toHaveBeenCalledWith("security.allow_http", "true");
  });

  it("should call onValueChange when verify certificates is toggled", () => {
    const onValueChange = jest.fn();
    render(
      <SecuritySettings {...defaultProps} onValueChange={onValueChange} />,
    );

    const switches = screen.getAllByRole("switch");
    fireEvent.click(switches[1]);

    expect(onValueChange).toHaveBeenCalledWith(
      "security.verify_certificates",
      "false",
    );
  });

  it("should call onValueChange when allow self-signed is toggled", () => {
    const onValueChange = jest.fn();
    render(
      <SecuritySettings {...defaultProps} onValueChange={onValueChange} />,
    );

    const switches = screen.getAllByRole("switch");
    fireEvent.click(switches[2]);

    expect(onValueChange).toHaveBeenCalledWith(
      "security.allow_self_signed",
      "true",
    );
  });
});
