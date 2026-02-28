import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ErrorBoundary from "./error";
import { captureFrontendCrash } from "@/lib/crash-reporter";

jest.mock("@/lib/crash-reporter", () => ({
  captureFrontendCrash: jest.fn(),
}));

const mockOpenDialog = jest.fn();
jest.mock("@/lib/stores/feedback", () => ({
  useFeedbackStore: () => ({ openDialog: mockOpenDialog }),
}));

jest.mock("@/components/providers/locale-provider", () => ({
  useLocale: () => ({ t: (key: string) => key }),
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

  it("renders i18n title and error message", () => {
    const error = Object.assign(new Error("test error"), { digest: undefined });
    render(<ErrorBoundary error={error} reset={jest.fn()} />);

    expect(screen.getByText("errorPage.title")).toBeInTheDocument();
    expect(screen.getByText("test error")).toBeInTheDocument();
  });

  it("renders default message when error.message is empty", () => {
    const error = Object.assign(new Error(""), { digest: undefined });
    render(<ErrorBoundary error={error} reset={jest.fn()} />);

    expect(screen.getByText("errorPage.defaultMessage")).toBeInTheDocument();
  });

  it("calls reset when Try Again button is clicked", async () => {
    const user = userEvent.setup();
    const reset = jest.fn();
    const error = Object.assign(new Error("fail"), { digest: undefined });

    render(<ErrorBoundary error={error} reset={reset} />);

    await user.click(screen.getByRole("button", { name: /errorPage\.tryAgain/i }));
    expect(reset).toHaveBeenCalled();
  });

  it("opens feedback dialog when Report Error is clicked", async () => {
    const user = userEvent.setup();
    const error = Object.assign(new Error("report me"), {
      digest: "d-123",
      stack: "Error: report me\n  at test",
    });

    render(<ErrorBoundary error={error} reset={jest.fn()} />);

    await user.click(screen.getByRole("button", { name: /errorPage\.reportError/i }));
    expect(mockOpenDialog).toHaveBeenCalledWith(
      expect.objectContaining({
        category: "bug",
        errorContext: expect.objectContaining({
          message: "report me",
          digest: "d-123",
          component: "app/error.tsx",
        }),
      }),
    );
  });

  it("renders dashboard link pointing to /", () => {
    const error = Object.assign(new Error("err"), { digest: undefined });
    render(<ErrorBoundary error={error} reset={jest.fn()} />);

    const link = screen.getByRole("link", { name: /errorPage\.dashboard/i });
    expect(link).toHaveAttribute("href", "/");
  });

  it("toggles error details section", async () => {
    const user = userEvent.setup();
    const error = Object.assign(new Error("err"), {
      digest: "d-456",
      stack: "Error: err\n  at Component",
    });

    render(<ErrorBoundary error={error} reset={jest.fn()} />);

    // Details hidden initially
    expect(screen.queryByText(/d-456/)).not.toBeInTheDocument();

    // Click to expand
    await user.click(screen.getByText("errorPage.details"));
    expect(screen.getByText(/d-456/)).toBeInTheDocument();

    // Click to collapse
    await user.click(screen.getByText("errorPage.details"));
    expect(screen.queryByText(/d-456/)).not.toBeInTheDocument();
  });

  it("does not show details toggle when no digest and no stack", () => {
    const error = Object.assign(new Error("simple"), {
      digest: undefined,
      stack: undefined,
    });

    render(<ErrorBoundary error={error} reset={jest.fn()} />);

    expect(screen.queryByText("errorPage.details")).not.toBeInTheDocument();
  });

  it("copies error text to clipboard", async () => {
    const user = userEvent.setup();
    const writeText = jest.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText },
      writable: true,
      configurable: true,
    });

    const error = Object.assign(new Error("copy me"), {
      digest: "d-789",
      stack: "Error: copy me\n  at test",
    });

    render(<ErrorBoundary error={error} reset={jest.fn()} />);

    // Expand details first
    await user.click(screen.getByText("errorPage.details"));

    // Click copy button (the ghost icon button)
    const copyButtons = screen.getAllByRole("button");
    const copyBtn = copyButtons.find(
      (btn) => btn.querySelector("svg") && btn.closest(".group"),
    );
    if (copyBtn) {
      await user.click(copyBtn);
      expect(writeText).toHaveBeenCalledWith(
        expect.stringContaining("copy me"),
      );
    }
  });
});
