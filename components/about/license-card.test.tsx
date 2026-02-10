import { render, screen } from "@testing-library/react";
import { LicenseCard } from "./license-card";

const mockT = (key: string) => {
  const translations: Record<string, string> = {
    "about.licenseCertificates": "License & Certificates",
    "about.licenseCertificatesDesc": "Open source license and copyright information",
    "about.mitLicense": "MIT License",
    "about.mitLicenseDesc": "Open source license",
    "about.copyright": "Copyright",
    "about.copyrightDesc": "All rights reserved",
    "about.openInNewTab": "opens in new tab",
  };
  return translations[key] || key;
};

describe("LicenseCard", () => {
  it("renders license heading", () => {
    render(<LicenseCard t={mockT} />);
    expect(screen.getByText("License & Certificates")).toBeInTheDocument();
  });

  it("renders MIT license link", () => {
    render(<LicenseCard t={mockT} />);
    expect(screen.getByText("MIT License")).toBeInTheDocument();
    expect(screen.getByText("Open source license")).toBeInTheDocument();
  });

  it("renders copyright info", () => {
    render(<LicenseCard t={mockT} />);
    expect(screen.getByText("Copyright")).toBeInTheDocument();
    expect(screen.getByText("All rights reserved")).toBeInTheDocument();
  });

  it("has MIT license link to opensource.org", () => {
    render(<LicenseCard t={mockT} />);
    const link = screen.getByLabelText(/MIT License/);
    expect(link).toHaveAttribute("href", "https://opensource.org/licenses/MIT");
    expect(link).toHaveAttribute("target", "_blank");
  });

  it("has correct aria region", () => {
    render(<LicenseCard t={mockT} />);
    expect(screen.getByRole("region")).toBeInTheDocument();
  });
});
