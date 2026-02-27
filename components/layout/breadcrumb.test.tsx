import { render, screen } from "@testing-library/react";
import React from "react";
import { Breadcrumb } from "./breadcrumb";

let mockPathname = "/packages";
jest.mock("next/navigation", () => ({
  usePathname: () => mockPathname,
}));

jest.mock("next/link", () => ({
  __esModule: true,
  default: ({
    href,
    children,
  }: {
    href: string;
    children: React.ReactNode;
  }) => <a href={href}>{children}</a>,
}));

jest.mock("@/components/providers/locale-provider", () => ({
  useLocale: () => ({
    t: (key: string) => {
      const translations: Record<string, string> = {
        "nav.dashboard": "Dashboard",
        "nav.packages": "Packages",
        "nav.cache": "Cache",
      };
      return translations[key] || key;
    },
  }),
}));

describe("Breadcrumb", () => {
  beforeEach(() => {
    mockPathname = "/packages";
  });

  it("renders breadcrumb items for the current path", () => {
    render(<Breadcrumb />);

    // shadcn Breadcrumb uses aria-label="breadcrumb" by default
    expect(screen.getByLabelText("breadcrumb")).toBeInTheDocument();
    expect(screen.getByText("Dashboard")).toBeInTheDocument();
    expect(screen.getByText("Packages")).toBeInTheDocument();
  });

  it("renders current page with aria-current", () => {
    render(<Breadcrumb />);

    const currentPage = screen.getByText("Packages");
    expect(currentPage).toHaveAttribute("aria-current", "page");
  });

  it("renders dashboard as a link", () => {
    render(<Breadcrumb />);

    const dashboardLink = screen.getByText("Dashboard").closest("a");
    expect(dashboardLink).toHaveAttribute("href", "/");
  });

  it("renders only Dashboard for root path", () => {
    mockPathname = "/";
    render(<Breadcrumb />);

    expect(screen.getByText("Dashboard")).toBeInTheDocument();
    // Dashboard is the only item and should be the current page
    expect(screen.getByText("Dashboard")).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  it("capitalizes unknown segments as fallback", () => {
    mockPathname = "/custom-page";
    render(<Breadcrumb />);

    expect(screen.getByText("Dashboard")).toBeInTheDocument();
    expect(screen.getByText("Custom-page")).toBeInTheDocument();
  });

  it("renders multi-level breadcrumb paths", () => {
    mockPathname = "/cache/npm";
    render(<Breadcrumb />);

    expect(screen.getByText("Dashboard")).toBeInTheDocument();
    expect(screen.getByText("Cache")).toBeInTheDocument();
    expect(screen.getByText("Npm")).toBeInTheDocument();

    // Cache should be a link to /cache
    const cacheLink = screen.getByText("Cache").closest("a");
    expect(cacheLink).toHaveAttribute("href", "/cache");

    // Npm is the last segment → current page
    expect(screen.getByText("Npm")).toHaveAttribute("aria-current", "page");
  });
});
