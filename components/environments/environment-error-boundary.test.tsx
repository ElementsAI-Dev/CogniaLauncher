import { render, screen, fireEvent } from "@testing-library/react";
import {
  EnvironmentErrorBoundary,
  EnvironmentCardErrorBoundary,
} from "./environment-error-boundary";

// Component that throws an error for testing
const ThrowError = ({ shouldThrow }: { shouldThrow: boolean }) => {
  if (shouldThrow) {
    throw new Error("Test error message");
  }
  return <div>Child content</div>;
};

// Suppress console.error for these tests since we expect errors
const originalError = console.error;
beforeAll(() => {
  console.error = jest.fn();
});
afterAll(() => {
  console.error = originalError;
});

// Default props for EnvironmentErrorBoundary tests
const defaultProps = {
  fallbackTitle: "Something went wrong",
  fallbackDescription:
    "An error occurred while loading this component. Please try again.",
  retryLabel: "Try Again",
};

describe("EnvironmentErrorBoundary", () => {
  it("renders children when no error occurs", () => {
    render(
      <EnvironmentErrorBoundary {...defaultProps}>
        <div>Test content</div>
      </EnvironmentErrorBoundary>,
    );
    expect(screen.getByText("Test content")).toBeInTheDocument();
  });

  it("renders fallback UI when error occurs", () => {
    render(
      <EnvironmentErrorBoundary {...defaultProps}>
        <ThrowError shouldThrow={true} />
      </EnvironmentErrorBoundary>,
    );
    expect(screen.getByText("Something went wrong")).toBeInTheDocument();
    expect(
      screen.getByText(
        "An error occurred while loading this component. Please try again.",
      ),
    ).toBeInTheDocument();
  });

  it("renders custom fallback title when provided", () => {
    render(
      <EnvironmentErrorBoundary
        {...defaultProps}
        fallbackTitle="Custom Error Title"
      >
        <ThrowError shouldThrow={true} />
      </EnvironmentErrorBoundary>,
    );
    expect(screen.getByText("Custom Error Title")).toBeInTheDocument();
  });

  it("renders custom fallback description when provided", () => {
    render(
      <EnvironmentErrorBoundary
        {...defaultProps}
        fallbackDescription="Custom error description"
      >
        <ThrowError shouldThrow={true} />
      </EnvironmentErrorBoundary>,
    );
    expect(screen.getByText("Custom error description")).toBeInTheDocument();
  });

  it("renders custom retry label when provided", () => {
    render(
      <EnvironmentErrorBoundary {...defaultProps} retryLabel="Retry Now">
        <ThrowError shouldThrow={true} />
      </EnvironmentErrorBoundary>,
    );
    expect(screen.getByText("Retry Now")).toBeInTheDocument();
  });

  it("displays error message in error state", () => {
    render(
      <EnvironmentErrorBoundary {...defaultProps}>
        <ThrowError shouldThrow={true} />
      </EnvironmentErrorBoundary>,
    );
    expect(screen.getByText("Test error message")).toBeInTheDocument();
  });

  it("renders Try Again button", () => {
    render(
      <EnvironmentErrorBoundary {...defaultProps}>
        <ThrowError shouldThrow={true} />
      </EnvironmentErrorBoundary>,
    );
    expect(screen.getByText("Try Again")).toBeInTheDocument();
  });

  it("retry button is clickable", () => {
    render(
      <EnvironmentErrorBoundary {...defaultProps}>
        <ThrowError shouldThrow={true} />
      </EnvironmentErrorBoundary>,
    );

    expect(screen.getByText("Something went wrong")).toBeInTheDocument();

    // Verify retry button exists and is clickable
    const retryButton = screen.getByText("Try Again");
    expect(retryButton).toBeInTheDocument();
    fireEvent.click(retryButton);
    // Button click should not throw
  });

  it("has destructive styling for error card", () => {
    const { container } = render(
      <EnvironmentErrorBoundary {...defaultProps}>
        <ThrowError shouldThrow={true} />
      </EnvironmentErrorBoundary>,
    );
    expect(
      container.querySelector('[role="alert"]'),
    ).toBeInTheDocument();
  });
});

describe("EnvironmentCardErrorBoundary", () => {
  it("renders children when no error occurs", () => {
    render(
      <EnvironmentCardErrorBoundary envType="Node">
        <div>Node Card</div>
      </EnvironmentCardErrorBoundary>,
    );
    expect(screen.getByText("Node Card")).toBeInTheDocument();
  });

  it("renders fallback with environment type when error occurs", () => {
    render(
      <EnvironmentCardErrorBoundary envType="Node">
        <ThrowError shouldThrow={true} />
      </EnvironmentCardErrorBoundary>,
    );
    expect(screen.getByText("Error loading Node")).toBeInTheDocument();
    expect(
      screen.getByText("Failed to render the Node environment card."),
    ).toBeInTheDocument();
  });

  it("uses translation function when provided", () => {
    const mockT = (key: string) => {
      const translations: Record<string, string> = {
        "environments.errorBoundary.cardTitle": "Error with {envType}",
        "environments.errorBoundary.cardDescription": "{envType} card failed",
        "environments.errorBoundary.tryAgain": "Retry",
      };
      return translations[key] || key;
    };

    render(
      <EnvironmentCardErrorBoundary envType="Python" t={mockT}>
        <ThrowError shouldThrow={true} />
      </EnvironmentCardErrorBoundary>,
    );
    expect(screen.getByText("Error with Python")).toBeInTheDocument();
    expect(screen.getByText("Python card failed")).toBeInTheDocument();
    expect(screen.getByText("Retry")).toBeInTheDocument();
  });

  it("falls back to English when translation function is not provided", () => {
    render(
      <EnvironmentCardErrorBoundary envType="Go">
        <ThrowError shouldThrow={true} />
      </EnvironmentCardErrorBoundary>,
    );
    expect(screen.getByText("Error loading Go")).toBeInTheDocument();
  });

  it("isolates error to single card", () => {
    render(
      <div>
        <EnvironmentCardErrorBoundary envType="Node">
          <div>Node Card</div>
        </EnvironmentCardErrorBoundary>
        <EnvironmentCardErrorBoundary envType="Python">
          <ThrowError shouldThrow={true} />
        </EnvironmentCardErrorBoundary>
      </div>,
    );
    expect(screen.getByText("Node Card")).toBeInTheDocument();
    expect(screen.getByText("Error loading Python")).toBeInTheDocument();
  });
});
