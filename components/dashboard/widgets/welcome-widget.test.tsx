import { render } from "@testing-library/react";
import { WelcomeWidget } from "./welcome-widget";

jest.mock("@/components/providers/locale-provider", () => ({
  useLocale: () => ({ t: (key: string) => key }),
}));

jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: jest.fn() }),
}));

describe("WelcomeWidget", () => {
  it("renders when user has no environments and no packages", () => {
    const { container } = render(
      <WelcomeWidget hasEnvironments={false} hasPackages={false} />,
    );
    expect(container.firstChild).not.toBeNull();
  });

  it("returns null when user has both environments and packages", () => {
    const { container } = render(
      <WelcomeWidget hasEnvironments={true} hasPackages={true} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders when user has environments but no packages", () => {
    const { container } = render(
      <WelcomeWidget hasEnvironments={true} hasPackages={false} />,
    );
    expect(container.firstChild).not.toBeNull();
  });
});
