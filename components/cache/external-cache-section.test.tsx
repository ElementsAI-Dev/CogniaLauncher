import { render, screen } from "@testing-library/react";
import { ExternalCacheSection } from "./external-cache-section";

jest.mock("@/components/providers/locale-provider", () => ({
  useLocale: () => ({ t: (key: string) => key }),
}));

jest.mock("@/lib/tauri", () => ({
  isTauri: () => false,
  cacheExternalList: jest.fn(() => Promise.resolve([])),
  cacheExternalGetMonitoring: jest.fn(() => Promise.resolve(false)),
}));

jest.mock("sonner", () => ({
  toast: { success: jest.fn(), error: jest.fn() },
}));

describe("ExternalCacheSection", () => {
  it("renders section title", () => {
    render(<ExternalCacheSection useTrash={false} setUseTrash={jest.fn()} />);
    expect(screen.getByText("cache.externalCaches")).toBeInTheDocument();
  });
});
