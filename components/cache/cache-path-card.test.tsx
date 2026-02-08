import { render, screen } from "@testing-library/react";
import { CachePathCard } from "./cache-path-card";

jest.mock("@/components/providers/locale-provider", () => ({
  useLocale: () => ({ t: (key: string) => key }),
}));

jest.mock("@/lib/tauri", () => ({
  isTauri: () => false,
  cacheGetPathInfo: jest.fn(() => Promise.resolve(null)),
}));

jest.mock("sonner", () => ({
  toast: { success: jest.fn(), error: jest.fn() },
}));

describe("CachePathCard", () => {
  it("renders path card title", () => {
    render(<CachePathCard />);
    expect(screen.getByText("cache.pathManagement")).toBeInTheDocument();
  });
});
