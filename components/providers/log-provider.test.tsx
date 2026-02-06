import { render, screen } from "@testing-library/react";
import { LogProvider } from "./log-provider";

jest.mock("@/lib/tauri", () => ({
  isTauri: () => false,
}));

const mockAddLog = jest.fn();

jest.mock("@/lib/stores/log", () => ({
  useLogStore: () => ({
    addLog: mockAddLog,
  }),
}));

describe("LogProvider", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders children", () => {
    render(
      <LogProvider>
        <div data-testid="child">Child content</div>
      </LogProvider>,
    );

    expect(screen.getByTestId("child")).toBeInTheDocument();
  });

  it("provides log context to children", () => {
    render(
      <LogProvider>
        <div>Test</div>
      </LogProvider>,
    );

    expect(screen.getByText("Test")).toBeInTheDocument();
  });
});
