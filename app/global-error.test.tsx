import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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
    // Default to English
    Object.defineProperty(document, "cookie", {
      writable: true,
      value: "NEXT_LOCALE=en",
    });
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

  it("renders title and error message", () => {
    const error = Object.assign(new Error("boom"), { digest: undefined });
    render(<GlobalError error={error} reset={jest.fn()} />);

    expect(screen.getByText("Application Error")).toBeInTheDocument();
    expect(screen.getByText("boom")).toBeInTheDocument();
  });

  it("renders default message when error.message is empty", () => {
    const error = Object.assign(new Error(""), { digest: undefined });
    render(<GlobalError error={error} reset={jest.fn()} />);

    expect(
      screen.getByText("A critical error occurred in the application."),
    ).toBeInTheDocument();
  });

  it("renders error digest when present", () => {
    const error = Object.assign(new Error("err"), { digest: "abc-123" });
    render(<GlobalError error={error} reset={jest.fn()} />);

    expect(screen.getByText(/abc-123/)).toBeInTheDocument();
  });

  it("calls reset when Try Again is clicked", async () => {
    const user = userEvent.setup();
    const reset = jest.fn();
    const error = Object.assign(new Error("err"), { digest: undefined });

    render(<GlobalError error={error} reset={reset} />);

    await user.click(screen.getByText(/Try Again/));
    expect(reset).toHaveBeenCalled();
  });

  it("renders dashboard link pointing to /", () => {
    const error = Object.assign(new Error("err"), { digest: undefined });
    render(<GlobalError error={error} reset={jest.fn()} />);

    const link = screen.getByText("Go to Dashboard");
    expect(link.closest("a")).toHaveAttribute("href", "/");
  });

  it("detects Chinese locale from cookie", () => {
    Object.defineProperty(document, "cookie", {
      writable: true,
      value: "NEXT_LOCALE=zh",
    });

    const error = Object.assign(new Error("err"), { digest: undefined });
    render(<GlobalError error={error} reset={jest.fn()} />);

    expect(screen.getByText("应用程序错误")).toBeInTheDocument();
    expect(screen.getByText(/重试/)).toBeInTheDocument();
    expect(screen.getByText("返回首页")).toBeInTheDocument();
  });

  it("toggles error details section", async () => {
    const user = userEvent.setup();
    const error = Object.assign(new Error("err"), {
      digest: "d-999",
      stack: "Error: err\n  at GlobalError",
    });

    render(<GlobalError error={error} reset={jest.fn()} />);

    // Click to expand details
    await user.click(screen.getByText("Copy error details"));

    // Stack trace should now be visible in the details box
    expect(screen.getByText(/at GlobalError/)).toBeInTheDocument();
  });
});
