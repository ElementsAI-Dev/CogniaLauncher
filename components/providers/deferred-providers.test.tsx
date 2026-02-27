import { render, screen, act } from "@testing-library/react";
import { DeferredProviders } from "./deferred-providers";

describe("DeferredProviders", () => {
  let mockIdleCallback: ((...args: unknown[]) => void) | undefined;
  let mockCancelIdleCallback: jest.Mock;

  beforeEach(() => {
    jest.useFakeTimers();
    mockIdleCallback = undefined;
    mockCancelIdleCallback = jest.fn();

    // Always provide working requestIdleCallback + cancelIdleCallback
    // (jsdom doesn't have them; testing-library cleanup needs cancelIdleCallback
    //  to remain valid when it unmounts the component after afterEach runs)
    window.requestIdleCallback = jest.fn((cb) => {
      mockIdleCallback = cb as (...args: unknown[]) => void;
      return 42;
    }) as unknown as typeof window.requestIdleCallback;
    window.cancelIdleCallback = mockCancelIdleCallback;
  });

  afterEach(() => {
    jest.useRealTimers();
    // Do NOT restore original (undefined) requestIdleCallback / cancelIdleCallback here,
    // because testing-library cleanup runs after afterEach and needs cancelIdleCallback.
  });

  it("renders fallback before idle callback fires", () => {
    render(
      <DeferredProviders fallback={<div data-testid="fallback">Loading...</div>}>
        <div data-testid="child">Content</div>
      </DeferredProviders>,
    );

    expect(screen.getByTestId("fallback")).toBeInTheDocument();
    expect(screen.queryByTestId("child")).not.toBeInTheDocument();
  });

  it("renders children after requestIdleCallback fires", () => {
    render(
      <DeferredProviders fallback={<div data-testid="fallback">Loading...</div>}>
        <div data-testid="child">Content</div>
      </DeferredProviders>,
    );

    expect(screen.queryByTestId("child")).not.toBeInTheDocument();

    // Fire the idle callback
    act(() => {
      mockIdleCallback!();
    });

    expect(screen.getByTestId("child")).toBeInTheDocument();
    expect(screen.queryByTestId("fallback")).not.toBeInTheDocument();
  });

  it("falls back to setTimeout when requestIdleCallback is unavailable", () => {
    // Remove requestIdleCallback to trigger setTimeout fallback
    window.requestIdleCallback = undefined as unknown as typeof window.requestIdleCallback;

    render(
      <DeferredProviders fallback={<div data-testid="fallback">Loading...</div>}>
        <div data-testid="child">Content</div>
      </DeferredProviders>,
    );

    expect(screen.getByTestId("fallback")).toBeInTheDocument();
    expect(screen.queryByTestId("child")).not.toBeInTheDocument();

    // Advance past the 16ms setTimeout
    act(() => {
      jest.advanceTimersByTime(20);
    });

    expect(screen.getByTestId("child")).toBeInTheDocument();
    expect(screen.queryByTestId("fallback")).not.toBeInTheDocument();
  });

  it("defaults to null fallback when no fallback prop provided", () => {
    const { container } = render(
      <DeferredProviders>
        <div data-testid="child">Content</div>
      </DeferredProviders>,
    );

    expect(screen.queryByTestId("child")).not.toBeInTheDocument();
    // Container should be empty (null fallback)
    expect(container.innerHTML).toBe("");
  });

  it("renders custom fallback element", () => {
    render(
      <DeferredProviders fallback={<span data-testid="spinner">Spinning...</span>}>
        <div data-testid="child">Content</div>
      </DeferredProviders>,
    );

    expect(screen.getByTestId("spinner")).toBeInTheDocument();
    expect(screen.getByText("Spinning...")).toBeInTheDocument();
  });

  it("calls cancelIdleCallback on unmount", () => {
    window.requestIdleCallback = jest.fn(() => 99) as unknown as typeof window.requestIdleCallback;

    const { unmount } = render(
      <DeferredProviders>
        <div>Content</div>
      </DeferredProviders>,
    );

    unmount();
    expect(mockCancelIdleCallback).toHaveBeenCalledWith(99);
  });

  it("calls clearTimeout on unmount when using setTimeout fallback", () => {
    window.requestIdleCallback = undefined as unknown as typeof window.requestIdleCallback;
    const clearTimeoutSpy = jest.spyOn(global, "clearTimeout");

    const { unmount } = render(
      <DeferredProviders>
        <div>Content</div>
      </DeferredProviders>,
    );

    unmount();
    expect(clearTimeoutSpy).toHaveBeenCalled();
    clearTimeoutSpy.mockRestore();
  });
});
