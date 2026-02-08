import { render } from "@testing-library/react";
import { EnvDetailPackages } from "./env-detail-packages";

jest.mock("@/components/providers/locale-provider", () => ({
  useLocale: () => ({ t: (key: string) => key }),
}));

jest.mock("@/lib/tauri", () => ({
  isTauri: () => false,
}));

jest.mock("sonner", () => ({
  toast: { success: jest.fn(), error: jest.fn() },
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
  t: (key: string) => key,
};

describe("EnvDetailPackages", () => {
  it("renders without crashing", () => {
    const { container } = render(<EnvDetailPackages {...defaultProps} />);
    expect(container).toBeInTheDocument();
  });
});
