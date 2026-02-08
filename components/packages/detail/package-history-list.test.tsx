import { render } from "@testing-library/react";
import { PackageHistoryList } from "./package-history-list";

jest.mock("@/components/providers/locale-provider", () => ({
  useLocale: () => ({ t: (key: string) => key }),
}));

describe("PackageHistoryList", () => {
  it("renders without crashing", () => {
    const { container } = render(
      <PackageHistoryList history={[]} loading={false} />,
    );
    expect(container).toBeInTheDocument();
  });
});
