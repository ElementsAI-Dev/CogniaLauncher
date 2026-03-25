import { render, screen } from "@testing-library/react";
import { AboutProductContextCard } from "./about-product-context-card";

const mockT = (key: string) => {
  const translations: Record<string, string> = {
    "about.productContextTitle": "Product Context",
    "about.productContextDesc": "What CogniaLauncher covers and where to go next.",
    "about.productHighlightEnvironmentsTitle": "Environment & Runtime Management",
    "about.productHighlightEnvironmentsDesc": "Manage language runtimes, versions, and setup workflows from one place.",
    "about.productHighlightProvidersTitle": "Providers & Package Workflows",
    "about.productHighlightProvidersDesc": "Work across package managers and providers without switching tools.",
    "about.productHighlightSupportTitle": "Diagnostics & Support",
    "about.productHighlightSupportDesc": "Collect diagnostics, inspect system state, and prepare higher-signal feedback.",
    "about.diagnosticsExpectationTitle": "Diagnostics Expectations",
    "about.diagnosticsExpectationDesktop": "Desktop mode can export a fuller diagnostics bundle with logs, configuration, and runtime context.",
    "about.diagnosticsExpectationWeb": "Web mode exports a limited report and should defer log-heavy support work to the desktop app.",
    "about.diagnosticsExpectationFollowUp": "Export diagnostics before opening a bug report so support receives the current runtime state.",
  };

  return translations[key] || key;
};

describe("AboutProductContextCard", () => {
  it("renders the structured product overview highlights", () => {
    render(<AboutProductContextCard isDesktop={true} t={mockT} />);

    expect(screen.getByText("Product Context")).toBeInTheDocument();
    expect(screen.getByText("Environment & Runtime Management")).toBeInTheDocument();
    expect(screen.getByText("Providers & Package Workflows")).toBeInTheDocument();
    expect(screen.getByText("Diagnostics & Support")).toBeInTheDocument();
  });

  it("renders desktop diagnostics expectations in desktop mode", () => {
    render(<AboutProductContextCard isDesktop={true} t={mockT} />);

    expect(
      screen.getByText(
        "Desktop mode can export a fuller diagnostics bundle with logs, configuration, and runtime context.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "Export diagnostics before opening a bug report so support receives the current runtime state.",
      ),
    ).toBeInTheDocument();
  });

  it("renders web diagnostics expectations in web mode", () => {
    render(<AboutProductContextCard isDesktop={false} t={mockT} />);

    expect(
      screen.getByText(
        "Web mode exports a limited report and should defer log-heavy support work to the desktop app.",
      ),
    ).toBeInTheDocument();
  });
});
