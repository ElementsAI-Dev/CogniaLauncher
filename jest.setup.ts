/**
 * Jest setup file
 * This file is executed before each test file
 */

import "@testing-library/jest-dom";
import React from "react";

// Suppress stale Baseline dataset warnings from transitive Browserslist tooling in tests.
process.env.BASELINE_BROWSER_MAPPING_IGNORE_OLD_DATA = "true";
process.env.BROWSERSLIST_IGNORE_OLD_DATA = "true";

// Mock Next.js Image component
jest.mock("next/image", () => ({
  __esModule: true,
  default: (
    props: React.ImgHTMLAttributes<HTMLImageElement> & {
      unoptimized?: boolean;
      priority?: boolean;
      fill?: boolean;
      loader?: unknown;
      quality?: number;
    },
  ) => {
    // Strip Next.js-only props so tests don't emit React unknown-prop warnings.
    const imgProps = { ...props } as Record<string, unknown>;
    delete imgProps.unoptimized;
    delete imgProps.priority;
    delete imgProps.fill;
    delete imgProps.loader;
    delete imgProps.quality;
    return React.createElement("img", imgProps);
  },
}));

// Mock Recharts responsive container in jsdom to avoid zero-size warnings.
jest.mock("recharts", () => {
  const actual = jest.requireActual("recharts");

  return {
    ...actual,
    ResponsiveContainer: ({
      children,
      width,
      height,
      className,
    }: {
      children:
        | React.ReactNode
        | ((size: { width: number; height: number }) => React.ReactNode);
      width?: number | string;
      height?: number | string;
      className?: string;
    }) => {
      const resolvedWidth = typeof width === "number" ? width : 960;
      const resolvedHeight = typeof height === "number" ? height : 320;
      const content =
        typeof children === "function"
          ? children({ width: resolvedWidth, height: resolvedHeight })
          : children;

      return React.createElement(
        "div",
        {
          className,
          style: { width: resolvedWidth, height: resolvedHeight },
        },
        content,
      );
    },
  };
});

// Mock Next.js router
jest.mock("next/navigation", () => ({
  useRouter() {
    return {
      push: jest.fn(),
      replace: jest.fn(),
      prefetch: jest.fn(),
      back: jest.fn(),
      pathname: "/",
      query: {},
      asPath: "/",
    };
  },
  usePathname() {
    return "/";
  },
  useSearchParams() {
    return new URLSearchParams();
  },
}));

// Mock ResizeObserver for components using cmdk (Command) or Radix UI
global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};

// JSDOM does not implement this API; cmdk keyboard navigation calls it.
if (typeof window.HTMLElement.prototype.scrollIntoView !== "function") {
  Object.defineProperty(window.HTMLElement.prototype, "scrollIntoView", {
    value: jest.fn(),
    writable: true,
    configurable: true,
  });
}

Object.defineProperty(window, "open", {
  value: jest.fn(),
  writable: true,
  configurable: true,
});

// Radix Select relies on pointer-capture APIs that jsdom does not provide.
if (typeof window.Element.prototype.hasPointerCapture !== "function") {
  Object.defineProperty(window.Element.prototype, "hasPointerCapture", {
    value: () => false,
    writable: true,
    configurable: true,
  });
}

if (typeof window.Element.prototype.setPointerCapture !== "function") {
  Object.defineProperty(window.Element.prototype, "setPointerCapture", {
    value: () => undefined,
    writable: true,
    configurable: true,
  });
}

if (typeof window.Element.prototype.releasePointerCapture !== "function") {
  Object.defineProperty(window.Element.prototype, "releasePointerCapture", {
    value: () => undefined,
    writable: true,
    configurable: true,
  });
}

// Silence known third-party warning noise in test output.
const originalConsoleWarn = console.warn.bind(console);
console.warn = (...args: unknown[]) => {
  const firstArg = args[0];
  if (
    typeof firstArg === "string" &&
    (firstArg.includes("[baseline-browser-mapping]") ||
      firstArg.includes(
        "Missing `Description` or `aria-describedby={undefined}` for {DialogContent}",
      ) ||
      firstArg.includes(
        "Received `true` for a non-boolean attribute `unoptimized`.",
      ) ||
      firstArg.includes("[global-shortcut]"))
  ) {
    return;
  }
  originalConsoleWarn(...args);
};

// Keep test output focused by filtering known React async flush noise.
const originalConsoleError = console.error.bind(console);
console.error = (...args: unknown[]) => {
  const messages = args
    .map((arg) =>
      typeof arg === "string"
        ? arg
        : arg instanceof Error
          ? arg.message
          : typeof arg === "object" && arg !== null && "message" in arg
            ? String((arg as { message?: unknown }).message ?? "")
            : "",
    )
    .filter(Boolean);
  if (
    messages.some(
      (message) =>
        message.includes("not wrapped in act(...)") ||
        message.includes("You called act(async () =>") ||
        message.includes("Not implemented: navigation (except hash changes)") ||
        message.includes("Not implemented: window.open") ||
        message.includes("Encountered two children with the same key") ||
        message.includes("The tag <stop> is unrecognized in this browser.") ||
        message.includes("<linearGradient /> is using incorrect casing.") ||
        message.startsWith("Failed to load feedback history:") ||
        message.startsWith("Failed to export feedback:") ||
        message.startsWith("Failed to delete feedback:") ||
        message.startsWith("Failed to cleanup logs:") ||
        message.startsWith("Failed to get WSL status:") ||
        message.startsWith("Failed to load system info:") ||
        message === "test error message",
    )
  ) {
    return;
  }
  originalConsoleError(...args);
};

// Suppress console errors in tests (optional)
// global.console = {
//   ...console,
//   error: jest.fn(),
//   warn: jest.fn(),
// };
