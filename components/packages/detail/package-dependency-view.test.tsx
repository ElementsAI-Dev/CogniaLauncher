import { render } from "@testing-library/react";
import { PackageDependencyView } from "./package-dependency-view";

jest.mock("@/components/providers/locale-provider", () => ({
  useLocale: () => ({ t: (key: string) => key }),
}));

jest.mock("@/lib/tauri", () => ({
  isTauri: () => false,
  packageGetDependencies: jest.fn(() => Promise.resolve([])),
}));

describe("PackageDependencyView", () => {
  it("renders without crashing", () => {
    const { container } = render(
      <PackageDependencyView
        resolution={null}
        loading={false}
        onResolve={jest.fn()}
      />,
    );
    expect(container).toBeInTheDocument();
  });
});
