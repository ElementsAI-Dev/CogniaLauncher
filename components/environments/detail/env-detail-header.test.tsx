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
    expect(screen.getByRole("link")).toHaveAttribute("href", "/environments");
  });
});
