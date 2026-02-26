import { render, waitFor } from "@testing-library/react";
import ErrorBoundary from "./error";
import { captureFrontendCrash } from "@/lib/crash-reporter";

jest.mock("@/lib/crash-reporter", () => ({
  captureFrontendCrash: jest.fn(),
}));

const mockCaptureFrontendCrash =
  captureFrontendCrash as jest.MockedFunction<typeof captureFrontendCrash>;

describe("app/error.tsx", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCaptureFrontendCrash.mockResolvedValue({
      captured: false,
      reason: "not-tauri",
    });
    jest.spyOn(console, "error").mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("reports error boundary crash via unified crash reporter", async () => {
    const reset = jest.fn();
    const error = Object.assign(new Error("boundary crashed"), {
      digest: "digest-001",
    });

    render(<ErrorBoundary error={error} reset={reset} />);

    await waitFor(() => {
      expect(mockCaptureFrontendCrash).toHaveBeenCalledWith(
        expect.objectContaining({
          source: "next.error-boundary",
          error,
          includeConfig: true,
          extra: expect.objectContaining({
            digest: "digest-001",
            boundary: "app/error.tsx",
          }),
        }),
      );
    });
  });
});
