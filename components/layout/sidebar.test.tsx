import { render, screen } from "@testing-library/react";
import { Sidebar } from "./sidebar";

const mockPathname = jest.fn(() => "/");

jest.mock("next/navigation", () => ({
  usePathname: () => mockPathname(),
}));

describe("Sidebar", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPathname.mockReturnValue("/");
  });

  it("renders navigation links", () => {
    render(<Sidebar />);
    expect(screen.getAllByRole("link").length).toBeGreaterThan(0);
  });

  it("highlights active link based on pathname", () => {
    mockPathname.mockReturnValue("/settings");
    render(<Sidebar />);

    const settingsLink = screen.getByRole("link", { name: /settings/i });
    expect(settingsLink).toHaveClass("bg-primary");
  });

  it("renders all main navigation items", () => {
    render(<Sidebar />);

    expect(
      screen.getByRole("link", { name: /dashboard/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /settings/i })).toBeInTheDocument();
  });
});
