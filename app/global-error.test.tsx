import { render, waitFor } from "@testing-library/react";
import GlobalError from "./global-error";
import { captureFrontendCrash } from "@/lib/crash-reporter";

jest.mock("@/lib/crash-reporter", () => ({
  captureFrontendCrash: jest.fn(),
}));

const mockCaptureFrontendCrash =
  captureFrontendCrash as jest.MockedFunction<typeof captureFrontendCrash>;

describe("app/global-error.tsx", () => {
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

  it("reports global error boundary crash via unified crash reporter", async () => {
    const reset = jest.fn();
    const error = Object.assign(new Error("global crash"), {
      digest: "digest-002",
    });

    render(<GlobalError error={error} reset={reset} />);

    await waitFor(() => {
      expect(mockCaptureFrontendCrash).toHaveBeenCalledWith(
        expect.objectContaining({
          source: "next.global-error-boundary",
          error,
          includeConfig: true,
          extra: expect.objectContaining({
            digest: "digest-002",
            boundary: "app/global-error.tsx",
          }),
        }),
      );
    });
  });
});
