import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { EnvDetailHeader } from "./env-detail-header";

jest.mock("next/link", () => {
  const MockLink = ({ children, ...props }: { children: React.ReactNode; href: string }) => (
    <a {...props}>{children}</a>
  );
  MockLink.displayName = "MockLink";
  return MockLink;
});

const t = (key: string) => key;

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
  detectedVersion: null,
  isRefreshing: false,
  onRefresh: jest.fn(),
  onOpenVersionBrowser: jest.fn(),
  t,
};

describe("EnvDetailHeader", () => {
  it("renders environment type name", () => {
    render(<EnvDetailHeader {...defaultProps} />);
    expect(screen.getByText("environments.title")).toBeInTheDocument();
  });

  it("calls onRefresh when refresh button is clicked", async () => {
    const onRefresh = jest.fn();
    render(<EnvDetailHeader {...defaultProps} onRefresh={onRefresh} />);
    const refreshBtn = screen.getByText("environments.refresh");
    await userEvent.click(refreshBtn);
    expect(onRefresh).toHaveBeenCalled();
  });

  it("renders back link to environments page", () => {
    render(<EnvDetailHeader {...defaultProps} />);
    expect(screen.getByRole("link", { name: "environments.title" })).toHaveAttribute("href", "/environments");
  });

  it("renders open in terminal action and forwards clicks", async () => {
    const onOpenInTerminal = jest.fn();
    render(
      <EnvDetailHeader
        {...defaultProps}
        onOpenInTerminal={onOpenInTerminal}
      />,
    );

    await userEvent.click(screen.getByText("environments.detail.openInTerminal"));
    expect(onOpenInTerminal).toHaveBeenCalled();
  });

  it("renders compiler-aware subtitle details for C++ environments", () => {
    render(
      <EnvDetailHeader
        {...defaultProps}
        envType="cpp"
        env={{
          ...defaultProps.env,
          env_type: "cpp",
          provider_id: "system-cpp",
          provider: "C++ (System)",
          compiler_metadata: {
            family: "gcc",
            variant: "g++",
            version: "13.2.0",
            target_architecture: "x64",
            host_architecture: null,
            target_triple: "x86_64-w64-windows-gnu",
            subsystem: "ucrt64",
            discovery_origin: "path",
            executable_name: "g++.exe",
          },
        }}
      />,
    );

    expect(screen.getByText(/ucrt64 g\+\+ 13\.2\.0 x64/)).toBeInTheDocument();
  });
});
