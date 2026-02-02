import { render, screen, fireEvent } from "@testing-library/react";
import { ErrorAlert } from "../error-alert";

const mockT = (key: string) => {
  const translations: Record<string, string> = {
    "about.networkError": "Network error. Please check your connection.",
    "about.timeoutError": "Request timed out.",
    "about.updateCheckFailed": "Failed to check for updates.",
    "common.retry": "Retry",
    "common.close": "Close",
  };
  return translations[key] || key;
};

describe("ErrorAlert", () => {
  const mockOnRetry = jest.fn();
  const mockOnDismiss = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("visibility", () => {
    it("returns null when error is null", () => {
      const { container } = render(
        <ErrorAlert
          error={null}
          onRetry={mockOnRetry}
          onDismiss={mockOnDismiss}
          t={mockT}
        />
      );

      expect(container.firstChild).toBeNull();
    });

    it("renders alert when error exists", () => {
      render(
        <ErrorAlert
          error="Some error"
          onRetry={mockOnRetry}
          onDismiss={mockOnDismiss}
          t={mockT}
        />
      );

      expect(screen.getByRole("alert")).toBeInTheDocument();
    });
  });

  describe("error messages", () => {
    it("displays translated network error", () => {
      render(
        <ErrorAlert
          error="network_error"
          onRetry={mockOnRetry}
          onDismiss={mockOnDismiss}
          t={mockT}
        />
      );

      expect(screen.getByText("Network error. Please check your connection.")).toBeInTheDocument();
    });

    it("displays translated timeout error", () => {
      render(
        <ErrorAlert
          error="timeout_error"
          onRetry={mockOnRetry}
          onDismiss={mockOnDismiss}
          t={mockT}
        />
      );

      expect(screen.getByText("Request timed out.")).toBeInTheDocument();
    });

    it("displays raw error message for unknown errors", () => {
      render(
        <ErrorAlert
          error="Unknown error occurred"
          onRetry={mockOnRetry}
          onDismiss={mockOnDismiss}
          t={mockT}
        />
      );

      expect(screen.getByText("Unknown error occurred")).toBeInTheDocument();
    });
  });

  describe("actions", () => {
    it("calls onRetry when retry button is clicked", () => {
      render(
        <ErrorAlert
          error="Some error"
          onRetry={mockOnRetry}
          onDismiss={mockOnDismiss}
          t={mockT}
        />
      );

      fireEvent.click(screen.getByRole("button", { name: /retry/i }));
      expect(mockOnRetry).toHaveBeenCalledTimes(1);
    });

    it("calls onDismiss when dismiss button is clicked", () => {
      render(
        <ErrorAlert
          error="Some error"
          onRetry={mockOnRetry}
          onDismiss={mockOnDismiss}
          t={mockT}
        />
      );

      // The dismiss button has × symbol
      const dismissButton = screen.getByRole("button", { name: /close/i });
      fireEvent.click(dismissButton);
      expect(mockOnDismiss).toHaveBeenCalledTimes(1);
    });
  });

  describe("accessibility", () => {
    it("has role alert", () => {
      render(
        <ErrorAlert
          error="Some error"
          onRetry={mockOnRetry}
          onDismiss={mockOnDismiss}
          t={mockT}
        />
      );

      expect(screen.getByRole("alert")).toBeInTheDocument();
    });

    it("has aria-live assertive", () => {
      render(
        <ErrorAlert
          error="Some error"
          onRetry={mockOnRetry}
          onDismiss={mockOnDismiss}
          t={mockT}
        />
      );

      expect(screen.getByRole("alert")).toHaveAttribute("aria-live", "assertive");
    });
  });
});
