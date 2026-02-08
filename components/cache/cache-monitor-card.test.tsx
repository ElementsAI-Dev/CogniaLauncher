import { render, screen } from "@testing-library/react";
import { CacheMonitorCard } from "./cache-monitor-card";

jest.mock("@/components/providers/locale-provider", () => ({
  useLocale: () => ({ t: (key: string) => key }),
}));

jest.mock("@/lib/tauri", () => ({
  isTauri: () => false,
  cacheSizeMonitor: jest.fn(() => Promise.resolve({ total_size: 0, entries: [] })),
}));

describe("CacheMonitorCard", () => {
  it("renders monitor card title", () => {
    render(<CacheMonitorCard />);
    expect(screen.getByText("cache.sizeMonitor")).toBeInTheDocument();
  });
});
