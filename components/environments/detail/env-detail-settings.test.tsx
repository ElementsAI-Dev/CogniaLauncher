import { render } from "@testing-library/react";
import { EnvDetailSettings } from "./env-detail-settings";

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

describe("EnvDetailSettings", () => {
  it("renders without crashing", () => {
    const { container } = render(<EnvDetailSettings {...defaultProps} />);
    expect(container).toBeInTheDocument();
  });
});
