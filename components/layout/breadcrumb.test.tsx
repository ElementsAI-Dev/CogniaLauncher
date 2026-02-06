import { render, screen } from "@testing-library/react";
import React from "react";
import { Breadcrumb } from "./breadcrumb";

jest.mock("next/navigation", () => ({
  usePathname: () => "/packages",
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
        "breadcrumbs.label": "Breadcrumbs",
        "nav.dashboard": "Dashboard",
        "nav.packages": "Packages",
      };
      return translations[key] || key;
    },
  }),
}));

describe("Breadcrumb", () => {
  it("renders breadcrumb items for the current path", () => {
    render(<Breadcrumb />);

    expect(screen.getByLabelText("Breadcrumbs")).toBeInTheDocument();
    expect(screen.getByText("Dashboard")).toBeInTheDocument();
    expect(screen.getByText("Packages")).toBeInTheDocument();
  });
});
