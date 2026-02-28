import { render } from "@testing-library/react";
import { EnvDetailVersions } from "./env-detail-versions";

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
    current_version: "20.0.0",
    installed_versions: [{ version: "20.0.0", install_path: "/usr/local/bin/node", size: null, is_current: true, installed_at: null }],
    available: true,
    total_size: 0,
    version_count: 1,
  },
  onInstall: jest.fn(() => Promise.resolve()),
  onUninstall: jest.fn(() => Promise.resolve()),
  onSetGlobal: jest.fn(() => Promise.resolve()),
  onSetLocal: jest.fn(() => Promise.resolve()),
  onOpenVersionBrowser: jest.fn(),
  availableProviders: [{ id: "fnm", name: "fnm" }],
  loading: false,
  t: (key: string) => key,
};

describe("EnvDetailVersions", () => {
  it("renders without crashing", () => {
    const { container } = render(<EnvDetailVersions {...defaultProps} />);
    expect(container).toBeInTheDocument();
  });
});
