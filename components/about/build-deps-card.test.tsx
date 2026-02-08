import { render, screen } from "@testing-library/react";
import { BuildDepsCard } from "./build-deps-card";

jest.mock("next-themes", () => ({
  useTheme: () => ({ resolvedTheme: "light" }),
}));

jest.mock("@/lib/constants/about", () => ({
  BUILD_DEPENDENCIES: [
    {
      name: "Tauri",
      version: "v2.9.0",
      color: "#FFC131",
      textColor: "#000",
      darkColor: "#FFC131",
      darkTextColor: "#000",
      letter: "T",
      url: "https://tauri.app",
    },
    {
      name: "Rust",
      version: "v1.77.2",
      color: "#DEA584",
      textColor: "#000",
      darkColor: "#DEA584",
      darkTextColor: "#000",
      letter: "R",
      url: "https://www.rust-lang.org",
    },
    {
      name: "Next.js",
      version: "v16.0.0",
      color: "#000",
      textColor: "#FFF",
      darkColor: "#FFF",
      darkTextColor: "#000",
      letter: "N",
      url: "https://nextjs.org",
    },
    {
      name: "React",
      version: "v19.0.0",
      color: "#61DAFB",
      textColor: "#000",
      darkColor: "#61DAFB",
      darkTextColor: "#000",
      letter: "⚛",
      url: "https://react.dev",
    },
  ],
}));

const mockT = (key: string) => {
  const translations: Record<string, string> = {
    "about.buildDependencies": "Build Dependencies",
    "about.openInNewTab": "opens in new tab",
  };
  return translations[key] || key;
};

describe("BuildDepsCard", () => {
  it("renders heading", () => {
    render(<BuildDepsCard t={mockT} />);
    expect(screen.getByText("Build Dependencies")).toBeInTheDocument();
  });

  it("renders all dependency names", () => {
    render(<BuildDepsCard t={mockT} />);
    expect(screen.getByText("Tauri")).toBeInTheDocument();
    expect(screen.getByText("Rust")).toBeInTheDocument();
    expect(screen.getByText("Next.js")).toBeInTheDocument();
    expect(screen.getByText("React")).toBeInTheDocument();
  });

  it("renders dependency versions", () => {
    render(<BuildDepsCard t={mockT} />);
    expect(screen.getByText("v2.9.0")).toBeInTheDocument();
    expect(screen.getByText("v1.77.2")).toBeInTheDocument();
  });

  it("renders dependency links", () => {
    render(<BuildDepsCard t={mockT} />);
    const tauriLink = screen.getByLabelText(/Tauri/);
    expect(tauriLink).toHaveAttribute("href", "https://tauri.app");
    expect(tauriLink).toHaveAttribute("target", "_blank");
  });

  it("has correct aria region", () => {
    render(<BuildDepsCard t={mockT} />);
    expect(screen.getByRole("region")).toBeInTheDocument();
  });
});
