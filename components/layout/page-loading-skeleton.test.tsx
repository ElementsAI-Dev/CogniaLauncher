import { render } from "@testing-library/react";
import { PageLoadingSkeleton } from "./page-loading-skeleton";

describe("PageLoadingSkeleton", () => {
  it("renders list variant by default", () => {
    const { container } = render(<PageLoadingSkeleton />);
    expect(container.querySelector(".skeleton-shimmer")).toBeInTheDocument();
    expect(container.querySelector(".skeleton-card-1")).toBeInTheDocument();
  });

  it("renders dashboard variant with stat cards", () => {
    const { container } = render(<PageLoadingSkeleton variant="dashboard" />);
    expect(container.querySelector(".skeleton-card-1")).toBeInTheDocument();
    expect(container.querySelector(".skeleton-card-4")).toBeInTheDocument();
  });

  it("renders cards variant", () => {
    const { container } = render(<PageLoadingSkeleton variant="cards" />);
    expect(container.querySelector(".skeleton-card-2")).toBeInTheDocument();
    expect(container.querySelector(".skeleton-card-5")).toBeInTheDocument();
  });

  it("renders settings variant with sections", () => {
    const { container } = render(<PageLoadingSkeleton variant="settings" />);
    expect(container.querySelector(".skeleton-card-2")).toBeInTheDocument();
    expect(container.querySelector(".skeleton-card-4")).toBeInTheDocument();
  });

  it("renders detail variant with header and grid", () => {
    const { container } = render(<PageLoadingSkeleton variant="detail" />);
    expect(container.querySelector(".skeleton-card-1")).toBeInTheDocument();
    expect(container.querySelector(".skeleton-card-5")).toBeInTheDocument();
  });

  it("renders tabs variant with header, tabs bar and cards", () => {
    const { container } = render(<PageLoadingSkeleton variant="tabs" />);
    expect(container.querySelector(".skeleton-card-1")).toBeInTheDocument();
    expect(container.querySelector(".skeleton-card-2")).toBeInTheDocument();
    expect(container.querySelector(".skeleton-card-5")).toBeInTheDocument();
  });

  it("has accessibility attributes on all variants", () => {
    const variants = ["dashboard", "list", "cards", "settings", "detail", "tabs"] as const;
    for (const variant of variants) {
      const { container, unmount } = render(<PageLoadingSkeleton variant={variant} />);
      const root = container.firstElementChild as HTMLElement;
      expect(root).toHaveAttribute("role", "status");
      expect(root).toHaveAttribute("aria-busy", "true");
      expect(root).toHaveAttribute("aria-label", "Loading...");
      unmount();
    }
  });
});
