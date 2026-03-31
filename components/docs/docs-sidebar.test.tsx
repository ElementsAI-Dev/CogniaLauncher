/// <reference types="@testing-library/jest-dom" />

import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { DocsMobileSidebar, DocsSidebar } from "./docs-sidebar";

// Mock DocsSearch to avoid useRouter dependency in sidebar tests
jest.mock("./docs-search", () => ({
  DocsSearch: ({ searchIndex }: { searchIndex?: unknown[] }) => (
    <div data-testid="docs-search" data-has-index={!!searchIndex} />
  ),
}));

// Control usePathname return value per test
let mockPathname = "/docs";
jest.mock("next/navigation", () => ({
  usePathname: () => mockPathname,
  useRouter: () => ({ push: jest.fn(), back: jest.fn() }),
}));

jest.mock("next/link", () => {
  const React = jest.requireActual<typeof import("react")>("react");
  type AnchorProps = React.ComponentPropsWithoutRef<"a"> & {
    href: string;
  };
  const MockLink = React.forwardRef<
    HTMLAnchorElement,
    AnchorProps
  >(function MockLink({ children, href, ...props }, ref) {
    return (
      <a ref={ref} href={href} {...props}>
        {children}
      </a>
    );
  });
  MockLink.displayName = "MockLink";
  return MockLink;
});

// Control locale per test
let mockLocale = "en";
jest.mock("@/components/providers/locale-provider", () => ({
  useLocale: () => ({
    t: (key: string) => key,
    locale: mockLocale,
  }),
}));

jest.mock("@/components/ui/scroll-area", () => ({
  ScrollArea: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="scroll-area">{children}</div>
  ),
}));

jest.mock("@/components/ui/collapsible", () => ({
  Collapsible: ({
    children,
    open,
  }: {
    children: React.ReactNode;
    open: boolean;
  }) => (
    <div data-testid="collapsible" data-open={open}>
      {children}
    </div>
  ),
  CollapsibleTrigger: ({
    children,
    asChild,
    ...props
  }: {
    children: React.ReactNode;
    asChild?: boolean;
    [key: string]: unknown;
  }) => (
    asChild && React.isValidElement<Record<string, unknown>>(children)
      ? React.cloneElement(children, {
          ...(props as Record<string, unknown>),
          "data-testid": "collapsible-trigger",
        })
      : (
        <button data-testid="collapsible-trigger" {...props}>
          {children}
        </button>
      )
  ),
  CollapsibleContent: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="collapsible-content">{children}</div>
  ),
}));

jest.mock("@/components/ui/sheet", () => ({
  Sheet: ({
    children,
    open,
    onOpenChange,
  }: {
    children: React.ReactNode;
    open: boolean;
    onOpenChange: (next: boolean) => void;
  }) => {
    (globalThis as typeof globalThis & { __docsSheetState?: { open: boolean; onOpenChange: (next: boolean) => void } }).__docsSheetState = {
      open,
      onOpenChange,
    };
    return <div data-testid="sheet" data-open={open}>{children}</div>;
  },
  SheetTrigger: ({ children }: { children: React.ReactNode }) => {
    return React.isValidElement<Record<string, unknown>>(children)
      ? React.cloneElement(children, {
          onClick: () => {
            const state = (globalThis as typeof globalThis & { __docsSheetState?: { open: boolean; onOpenChange: (next: boolean) => void } }).__docsSheetState;
            state?.onOpenChange(true);
          },
        })
      : <>{children}</>;
  },
  SheetContent: ({ children }: { children: React.ReactNode }) => {
    const state = (globalThis as typeof globalThis & { __docsSheetState?: { open: boolean } }).__docsSheetState;
    return state?.open ? <div data-testid="sheet-content">{children}</div> : null;
  },
  SheetHeader: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  SheetTitle: ({ children }: { children: React.ReactNode }) => (
    <h2>{children}</h2>
  ),
}));

// Use a small controlled DOC_NAV for testing
jest.mock("@/lib/docs/navigation", () => ({
  DOC_NAV: [
    { title: "首页", titleEn: "Home", slug: "index" },
    {
      title: "快速开始",
      titleEn: "Getting Started",
      children: [
        { title: "概览", titleEn: "Overview", slug: "getting-started" },
        {
          title: "安装",
          titleEn: "Installation",
          slug: "getting-started/installation",
        },
      ],
    },
    { title: "无Slug节", titleEn: "No Slug Section" },
    {
      title: "空子节",
      titleEn: "Empty Children Section",
      slug: "empty-children",
      children: [],
    },
    {
      title: "含无Slug子项",
      titleEn: "Section With No Slug Child",
      children: [{ title: "无Slug子项", titleEn: "No Slug Child" }],
    },
  ],
  slugToArray: (slug: string) => (slug === "index" ? [] : slug.split("/")),
}));

describe("DocsSidebar", () => {
  beforeEach(() => {
    mockPathname = "/docs";
    mockLocale = "en";
    Element.prototype.scrollIntoView = jest.fn();
  });

  it("renders the sidebar with navigation items", () => {
    render(<DocsSidebar />);
    expect(
      screen.getByRole("navigation", { name: "Documentation" }),
    ).toBeInTheDocument();
  });

  it("renders top-level items as direct links", () => {
    render(<DocsSidebar />);
    const homeLink = screen.getByText("Home");
    expect(homeLink).toBeInTheDocument();
    expect(homeLink.closest("a")).toHaveAttribute("href", "/docs");
  });

  it("renders section with children as collapsible", () => {
    render(<DocsSidebar />);
    expect(screen.getByText("Getting Started")).toBeInTheDocument();
    expect(screen.getByText("Overview")).toBeInTheDocument();
    expect(screen.getByText("Installation")).toBeInTheDocument();
  });

  it("generates correct href for nested slugs", () => {
    render(<DocsSidebar />);
    const installLink = screen.getByText("Installation").closest("a");
    expect(installLink).toHaveAttribute(
      "href",
      "/docs/getting-started/installation",
    );
  });

  it("generates /docs for index slug", () => {
    render(<DocsSidebar />);
    const homeLink = screen.getByText("Home").closest("a");
    expect(homeLink).toHaveAttribute("href", "/docs");
  });

  it("shows Chinese titles when locale is zh", () => {
    mockLocale = "zh";
    render(<DocsSidebar />);
    expect(screen.getByText("首页")).toBeInTheDocument();
    expect(screen.getByText("快速开始")).toBeInTheDocument();
    expect(screen.getByText("概览")).toBeInTheDocument();
    expect(screen.getByText("安装")).toBeInTheDocument();
  });

  it("shows English titles when locale is en", () => {
    mockLocale = "en";
    render(<DocsSidebar />);
    expect(screen.getByText("Home")).toBeInTheDocument();
    expect(screen.getByText("Getting Started")).toBeInTheDocument();
  });

  it("applies active style when pathname matches item href", () => {
    mockPathname = "/docs/getting-started/installation";
    render(<DocsSidebar />);
    const installLink = screen.getByText("Installation").closest("a");
    expect(installLink?.className).toContain("bg-primary/10");
  });

  it("marks the active item with aria-current", () => {
    mockPathname = "/docs/getting-started/installation";
    render(<DocsSidebar />);
    const installLink = screen.getByText("Installation").closest("a");
    expect(installLink).toHaveAttribute("aria-current", "page");
  });

  it("applies inactive style when pathname does not match", () => {
    mockPathname = "/docs";
    render(<DocsSidebar />);
    const installLink = screen.getByText("Installation").closest("a");
    expect(installLink?.className).toContain("text-muted-foreground");
  });

  it("opens collapsible section when child is active", () => {
    mockPathname = "/docs/getting-started/installation";
    render(<DocsSidebar />);
    const collapsibles = screen.getAllByTestId("collapsible");
    // First collapsible is "Getting Started" which has an active child
    expect(collapsibles[0]).toHaveAttribute("data-open", "true");
  });

  it("does not open collapsible section when no child is active", () => {
    mockPathname = "/docs";
    render(<DocsSidebar />);
    const collapsibles = screen.getAllByTestId("collapsible");
    // All collapsibles should be closed when no child is active
    collapsibles.forEach((c) => {
      expect(c).toHaveAttribute("data-open", "false");
    });
  });

  it("applies custom className to aside", () => {
    const { container } = render(<DocsSidebar className="custom-class" />);
    const aside = container.querySelector("aside");
    expect(aside?.className).toContain("custom-class");
  });

  it("applies sticky and flex layout classes to aside", () => {
    const { container } = render(<DocsSidebar />);
    const aside = container.querySelector("aside");
    expect(aside?.className).toContain("sticky");
    expect(aside?.className).toContain("flex");
    expect(aside?.className).toContain("h-screen");
  });

  it("passes searchIndex to DocsSearch", () => {
    const index = [
      {
        slug: "test",
        headingsZh: [],
        headingsEn: [],
        excerptZh: "",
        excerptEn: "",
      },
    ];
    render(<DocsSidebar searchIndex={index} />);
    const search = screen.getByTestId("docs-search");
    expect(search).toHaveAttribute("data-has-index", "true");
  });

  it("passes searchIndex to DocsSearch in mobile sidebar", () => {
    const index = [
      {
        slug: "test",
        headingsZh: [],
        headingsEn: [],
        excerptZh: "",
        excerptEn: "",
      },
    ];
    render(<DocsMobileSidebar searchIndex={index} />);
    screen.getByRole("button", { name: "docs.mobileMenu" }).click();
    return waitFor(() => {
      const search = screen.getByTestId("docs-search");
      expect(search).toHaveAttribute("data-has-index", "true");
    });
  });

  it("closes the mobile sheet after clicking a nav item", async () => {
    render(<DocsMobileSidebar />);

    expect(screen.queryByTestId("sheet-content")).not.toBeInTheDocument();

    await screen.getByRole("button", { name: "docs.mobileMenu" }).click();
    expect(screen.getByTestId("sheet-content")).toBeInTheDocument();

    screen.getByText("Installation").click();

    await waitFor(() => {
      expect(screen.queryByTestId("sheet-content")).not.toBeInTheDocument();
    });
  });

  it("renders DocsSearch without searchIndex by default", () => {
    render(<DocsSidebar />);
    const search = screen.getByTestId("docs-search");
    expect(search).toHaveAttribute("data-has-index", "false");
  });

  it("calls scrollIntoView on active nav item", async () => {
    const scrollIntoViewMock = jest.fn();
    HTMLElement.prototype.scrollIntoView = scrollIntoViewMock;
    mockPathname = "/docs/getting-started/installation";
    render(<DocsSidebar />);
    await waitFor(() => {
      expect(scrollIntoViewMock).toHaveBeenCalled();
    });
  });

  it("does not render link for item without slug and no children", () => {
    render(<DocsSidebar />);
    // "No Slug Section" has no slug and no children — NavItem returns null
    expect(screen.queryByText("No Slug Section")).not.toBeInTheDocument();
  });

  it("renders correct number of links", () => {
    render(<DocsSidebar />);
    const links = screen.getAllByRole("link");
    // Home + Overview + Installation + Empty Children Section = 4 links
    expect(links).toHaveLength(4);
  });

  it("renders NavSection with empty children as NavItem link", () => {
    render(<DocsSidebar />);
    // "Empty Children Section" has slug but empty children array → NavSection falls through to NavItem
    const link = screen.getByText("Empty Children Section").closest("a");
    expect(link).toHaveAttribute("href", "/docs/empty-children");
  });

  it("handles section with child that has no slug in isSectionActive", () => {
    // pathname doesn't match any child (child has no slug) → section not active
    mockPathname = "/docs";
    render(<DocsSidebar />);
    // "Section With No Slug Child" should be rendered as a collapsible but not active
    expect(screen.getByText("Section With No Slug Child")).toBeInTheDocument();
  });
});
