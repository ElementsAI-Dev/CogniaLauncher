import { render, screen } from "@testing-library/react";
import { waitFor } from "@testing-library/react";
import LegacyToolDetailPage from "./page";

const mockReplace = jest.fn();
const mockGet = jest.fn();

jest.mock("next/navigation", () => ({
  useRouter: () => ({
    replace: (href: string) => mockReplace(href),
  }),
  useSearchParams: () => ({
    get: (key: string) => mockGet(key),
  }),
}));

jest.mock("@/components/toolbox/tool-detail-page-client", () => ({
  ToolDetailPageClient: ({ toolId }: { toolId: string }) => (
    <div data-testid="tool-detail-page-client" data-tool-id={toolId} />
  ),
}));

describe("LegacyToolDetailPage", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("redirects encoded legacy id to canonical toolbox route", async () => {
    mockGet.mockImplementation((key: string) =>
      key === "id" ? "builtin%3Ajson-formatter" : null,
    );
    render(<LegacyToolDetailPage />);

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith(
        "/toolbox/builtin%3Ajson-formatter",
      );
    });
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
});
