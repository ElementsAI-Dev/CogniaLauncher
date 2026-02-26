import { render } from "@testing-library/react";
import { WslDistroDetailPage } from "./wsl-distro-detail-page";

jest.mock("@/components/providers/locale-provider", () => ({
  useLocale: () => ({ t: (key: string) => key }),
}));

jest.mock("@/hooks/use-wsl", () => ({
  useWsl: () => ({
    available: false,
    distros: [],
    capabilities: null,
    status: null,
    loading: false,
    error: null,
    checkAvailability: jest.fn(),
    getCapabilities: jest.fn(),
    refreshDistros: jest.fn(),
    refreshStatus: jest.fn(),
    terminate: jest.fn(),
    launch: jest.fn(),
    setDefault: jest.fn(),
    setVersion: jest.fn(),
    exportDistro: jest.fn(),
    execCommand: jest.fn(),
    setSparse: jest.fn(),
    moveDistro: jest.fn(),
    resizeDistro: jest.fn(),
    getDistroConfig: jest.fn(() => Promise.resolve(null)),
    setDistroConfigValue: jest.fn(),
    getIpAddress: jest.fn(),
    changeDefaultUser: jest.fn(),
    detectDistroEnv: jest.fn(() => Promise.resolve(null)),
    getDiskUsage: jest.fn(),
  }),
}));

jest.mock("@/lib/tauri", () => ({
  isTauri: () => false,
}));

jest.mock("next/link", () => {
  const MockLink = ({ children, ...props }: { children: React.ReactNode; href: string }) => (
    <a {...props}>{children}</a>
  );
  MockLink.displayName = "MockLink";
  return MockLink;
});

describe("WslDistroDetailPage", () => {
  it("renders without crashing", () => {
    const { container } = render(<WslDistroDetailPage distroName="Ubuntu" />);
    expect(container).toBeInTheDocument();
  });
});
