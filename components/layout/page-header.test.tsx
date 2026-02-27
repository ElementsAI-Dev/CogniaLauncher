import { render, screen } from "@testing-library/react";
import { PageHeader } from "./page-header";

describe("PageHeader", () => {
  it("renders title and description", () => {
    render(<PageHeader title="Page Title" description="Page description" />);

    expect(
      screen.getByRole("heading", { name: /page title/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/page description/i)).toBeInTheDocument();
  });

  it("renders actions when provided", () => {
    render(
      <PageHeader
        title="Actions Title"
        actions={<button type="button">Action</button>}
      />,
    );

    expect(screen.getByRole("button", { name: /action/i })).toBeInTheDocument();
  });

  it("does not render description when not provided", () => {
    const { container } = render(<PageHeader title="No Desc" />);

    expect(
      screen.getByRole("heading", { name: /no desc/i }),
    ).toBeInTheDocument();
    expect(container.querySelector("p")).toBeNull();
  });

  it("does not render actions wrapper when actions not provided", () => {
    const { container } = render(<PageHeader title="No Actions" />);

    // Only the title container div should exist inside the root div
    const rootDiv = container.firstElementChild as HTMLElement;
    expect(rootDiv.children.length).toBe(1);
  });

  it("applies custom className", () => {
    const { container } = render(
      <PageHeader title="Styled" className="my-custom-class" />,
    );

    const rootDiv = container.firstElementChild as HTMLElement;
    expect(rootDiv.className).toContain("my-custom-class");
  });

  it("supports ReactNode as title", () => {
    render(
      <PageHeader
        title={
          <span data-testid="custom-title">
            <strong>Bold</strong> Title
          </span>
        }
      />,
    );

    expect(screen.getByTestId("custom-title")).toBeInTheDocument();
    expect(screen.getByText("Bold")).toBeInTheDocument();
  });
});
