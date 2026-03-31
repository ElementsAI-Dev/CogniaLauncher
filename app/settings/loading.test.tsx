import { render, screen } from "@testing-library/react";
import SettingsLoading from "./loading";

jest.mock("@/components/layout/page-loading-skeleton", () => ({
  PageLoadingSkeleton: ({ variant }: { variant: string }) => (
    <div data-testid="settings-loading-skeleton" data-variant={variant}>
      loading
    </div>
  ),
}));

describe("SettingsLoading", () => {
  it("renders the settings loading skeleton variant", () => {
    render(<SettingsLoading />);

    expect(screen.getByTestId("settings-loading-skeleton")).toHaveAttribute(
      "data-variant",
      "settings",
    );
  });
});
