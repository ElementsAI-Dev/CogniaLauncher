import { render, screen } from "@testing-library/react";
import { TrayProvider } from "./tray-provider";
import * as useTraySync from "@/hooks/use-tray-sync";

jest.mock("@/hooks/use-tray-sync", () => ({
  useTraySync: jest.fn(),
}));

describe("TrayProvider", () => {
  it("renders children", () => {
    render(
      <TrayProvider>
        <div data-testid="child">Child content</div>
      </TrayProvider>,
    );

    expect(screen.getByTestId("child")).toBeInTheDocument();
  });

  it("calls useTraySync hook", () => {
    render(
      <TrayProvider>
        <div>Test</div>
      </TrayProvider>,
    );

    expect(useTraySync.useTraySync).toHaveBeenCalled();
  });
});
