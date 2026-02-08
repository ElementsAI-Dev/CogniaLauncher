import { render, screen } from "@testing-library/react";
import { CacheMigrationDialog } from "./cache-migration-dialog";

jest.mock("@/components/providers/locale-provider", () => ({
  useLocale: () => ({ t: (key: string) => key }),
}));

jest.mock("@/lib/tauri", () => ({
  isTauri: () => false,
}));

jest.mock("sonner", () => ({
  toast: { success: jest.fn(), error: jest.fn() },
}));

describe("CacheMigrationDialog", () => {
  it("renders dialog title when open", () => {
    render(
      <CacheMigrationDialog open={true} onOpenChange={jest.fn()} />,
    );
    expect(screen.getByText("cache.migration")).toBeInTheDocument();
  });

  it("does not render when closed", () => {
    render(
      <CacheMigrationDialog open={false} onOpenChange={jest.fn()} />,
    );
    expect(screen.queryByText("cache.migration")).not.toBeInTheDocument();
  });
});
