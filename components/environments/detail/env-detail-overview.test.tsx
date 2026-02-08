import { render } from "@testing-library/react";
import { EnvDetailOverview } from "./env-detail-overview";

jest.mock("@/components/providers/locale-provider", () => ({
  useLocale: () => ({ t: (key: string) => key }),
}));

jest.mock("@/lib/tauri", () => ({
  isTauri: () => false,
}));

const defaultProps = {
  envType: "node",
  env: {
    env_type: "node",
    provider_id: "fnm",
    provider: "fnm",
    current_version: null,
    installed_versions: [],
    available: true,
  },
  detectedVersion: null,
  t: (key: string) => key,
};

describe("EnvDetailOverview", () => {
  it("renders without crashing", () => {
    const { container } = render(<EnvDetailOverview {...defaultProps} />);
    expect(container).toBeInTheDocument();
  });
});
