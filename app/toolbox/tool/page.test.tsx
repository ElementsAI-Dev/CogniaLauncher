import { render, screen } from "@testing-library/react";
import { waitFor } from "@testing-library/react";
import LegacyToolDetailPage from "./page";

const mockReplace = jest.fn();
const mockGet = jest.fn();
let mockSearchParamsShouldSuspend = false;
const mockSearchParamsSuspensePromise = Promise.resolve();

jest.mock("next/navigation", () => ({
  useRouter: () => ({
    replace: (href: string) => mockReplace(href),
  }),
  useSearchParams: () => {
    if (mockSearchParamsShouldSuspend) {
      throw mockSearchParamsSuspensePromise;
    }

    return {
      get: (key: string) => mockGet(key),
    };
  },
}));

jest.mock("@/components/toolbox/tool-detail-page-client", () => ({
  ToolDetailPageClient: ({ toolId }: { toolId: string }) => (
    <div data-testid="tool-detail-page-client" data-tool-id={toolId} />
  ),
}));

jest.mock("@/components/layout/page-loading-skeleton", () => ({
  PageLoadingSkeleton: () => <div data-testid="page-loading-skeleton">Loading</div>,
}));

describe("LegacyToolDetailPage", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSearchParamsShouldSuspend = false;
  });

  it("keeps built-in tool ids on legacy query route", async () => {
    mockGet.mockImplementation((key: string) =>
      key === "id" ? "builtin%3Ajson-formatter" : null,
    );
    render(<LegacyToolDetailPage />);

    expect(screen.getByTestId("tool-detail-page-client")).toHaveAttribute(
      "data-tool-id",
      "builtin:json-formatter",
    );
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it("redirects unknown id to canonical route semantics", async () => {
    mockGet.mockImplementation((key: string) =>
      key === "id" ? "unknown-tool" : null,
    );
    render(<LegacyToolDetailPage />);

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith("/toolbox/unknown-tool");
    });
  });

  it("falls back to deterministic invalid-tool page when id is missing", async () => {
    mockGet.mockReturnValue(null);
    render(<LegacyToolDetailPage />);

    expect(screen.getByTestId("tool-detail-page-client")).toHaveAttribute(
      "data-tool-id",
      "",
    );
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it("renders a suspense fallback while search params are pending", () => {
    mockSearchParamsShouldSuspend = true;

    render(<LegacyToolDetailPage />);

    expect(screen.getByTestId("page-loading-skeleton")).toBeInTheDocument();
  });

  it("keeps plugin tool ids on legacy query route", async () => {
    mockGet.mockImplementation((key: string) =>
      key === "id" ? "plugin%3Acom.example%3Ainspect" : null,
    );
    render(<LegacyToolDetailPage />);

    expect(screen.getByTestId("tool-detail-page-client")).toHaveAttribute(
      "data-tool-id",
      "plugin:com.example:inspect",
    );
    expect(mockReplace).not.toHaveBeenCalled();
  });
});
