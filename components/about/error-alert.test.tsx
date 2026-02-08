import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ErrorAlert } from "./error-alert";

const mockT = (key: string) => {
  const translations: Record<string, string> = {
    "about.networkError": "Network error",
    "about.timeoutError": "Timeout error",
    "about.updateCheckFailed": "Update check failed",
    "common.retry": "Retry",
    "common.close": "Close",
  };
  return translations[key] || key;
};

const defaultProps = {
  error: "network_error",
  onRetry: jest.fn(),
  onDismiss: jest.fn(),
  t: mockT,
};

describe("ErrorAlert", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns null when error is null", () => {
    const { container } = render(
      <ErrorAlert {...defaultProps} error={null} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders alert when error is present", () => {
    render(<ErrorAlert {...defaultProps} />);
    expect(screen.getByRole("alert")).toBeInTheDocument();
  });

  it("maps network_error to translated message", () => {
    render(<ErrorAlert {...defaultProps} error="network_error" />);
    expect(screen.getByText("Network error")).toBeInTheDocument();
  });

  it("maps timeout_error to translated message", () => {
    render(<ErrorAlert {...defaultProps} error="timeout_error" />);
    expect(screen.getByText("Timeout error")).toBeInTheDocument();
  });

  it("maps update_check_failed to translated message", () => {
    render(<ErrorAlert {...defaultProps} error="update_check_failed" />);
    expect(screen.getByText("Update check failed")).toBeInTheDocument();
  });

  it("shows raw error string for unknown errors", () => {
    render(<ErrorAlert {...defaultProps} error="some_unknown_error" />);
    expect(screen.getByText("some_unknown_error")).toBeInTheDocument();
  });

  it("calls onRetry when Retry button is clicked", async () => {
    render(<ErrorAlert {...defaultProps} />);
    await userEvent.click(screen.getByText("Retry"));
    expect(defaultProps.onRetry).toHaveBeenCalledTimes(1);
  });

  it("calls onDismiss when dismiss button is clicked", async () => {
    render(<ErrorAlert {...defaultProps} />);
    await userEvent.click(screen.getByLabelText("Close"));
    expect(defaultProps.onDismiss).toHaveBeenCalledTimes(1);
  });
});
