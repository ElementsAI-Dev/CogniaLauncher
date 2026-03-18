/* eslint-disable @next/next/no-img-element */
import { render, screen } from "@testing-library/react";
import { BuildDepsCard } from "./build-deps-card";

jest.mock("next/image", () => ({
  __esModule: true,
  default: ({ unoptimized, alt, ...props }: React.ComponentProps<"img"> & { unoptimized?: boolean }) => {
    void unoptimized;
    return <img {...props} alt={alt ?? ""} />;
  },
}));

jest.mock("next-themes", () => ({
  useTheme: () => ({ resolvedTheme: "light" }),
}));

const mockT = (key: string) => {
  const translations: Record<string, string> = {
    "about.buildDependencies": "Build Dependencies",
    "about.buildDependenciesDesc": "Core frameworks and libraries used to build this application",
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

  it("renders description text", () => {
    render(<BuildDepsCard t={mockT} />);
    expect(
      screen.getByText(
        "Core frameworks and libraries used to build this application",
      ),
    ).toBeInTheDocument();
  });

  it("renders all dependency links with noopener noreferrer", () => {
    render(<BuildDepsCard t={mockT} />);
    const links = screen.getAllByRole("link");
    expect(links).toHaveLength(4);
    for (const link of links) {
      expect(link).toHaveAttribute("rel", "noopener noreferrer");
      expect(link).toHaveAttribute("target", "_blank");
    }
  });

  it("renders dependency list with table semantics", () => {
    render(<BuildDepsCard t={mockT} />);
    expect(screen.getByRole("table")).toBeInTheDocument();
  });

  it("renders repository-managed brand icons for primary dependencies", () => {
    const { container } = render(<BuildDepsCard t={mockT} />);

    expect(
      container.querySelector('img[src="/icons/brands/light/tauri.svg"]'),
    ).toBeInTheDocument();
    expect(
      container.querySelector('img[src="/icons/languages/light/rust.svg"]'),
    ).toBeInTheDocument();
    expect(
      container.querySelector('img[src="/icons/brands/light/nextjs.svg"]'),
    ).toBeInTheDocument();
    expect(
      container.querySelector('img[src="/icons/brands/light/react.svg"]'),
    ).toBeInTheDocument();
  });
});
