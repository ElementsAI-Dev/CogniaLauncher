import { render } from "@testing-library/react";
import { PackageVersionList } from "./package-version-list";

jest.mock("@/components/providers/locale-provider", () => ({
  useLocale: () => ({ t: (key: string) => key }),
}));

jest.mock("sonner", () => ({
  toast: { success: jest.fn(), error: jest.fn() },
}));

describe("PackageVersionList", () => {
  it("renders without crashing", () => {
    const { container } = render(
      <PackageVersionList
        versions={[]}
        currentVersion="1.0.0"
        isInstalled={false}
        isInstalling={false}
        onInstall={jest.fn()}
        onRollback={jest.fn()}
      />,
    );
    expect(container).toBeInTheDocument();
  });
});
