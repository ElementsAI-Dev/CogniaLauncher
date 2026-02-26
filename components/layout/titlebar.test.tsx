import { render } from "@testing-library/react";
import { Titlebar } from "./titlebar";

describe("Titlebar (deprecated)", () => {
  it("renders nothing (window controls moved to header)", () => {
    const { container } = render(<Titlebar />);
    expect(container.firstChild).toBeNull();
  });
});
