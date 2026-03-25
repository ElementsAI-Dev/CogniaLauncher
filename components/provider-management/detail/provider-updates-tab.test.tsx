import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ProviderUpdatesTab } from "./provider-updates-tab";
import type { UpdateInfo } from "@/types/tauri";

global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};

jest.mock("@/lib/tauri", () => ({
  isTauri: () => false,
}));

jest.mock("sonner", () => ({
  toast: { success: jest.fn(), error: jest.fn() },
}));

jest.mock('@/components/providers/locale-provider', () => ({ useLocale: () => ({ t: (key: string) => key }) }));

const sampleUpdates: UpdateInfo[] = [
  { name: "lodash", current_version: "4.17.20", latest_version: "4.17.21", provider: "npm" },
  { name: "express", current_version: "4.18.0", latest_version: "4.19.0", provider: "npm" },
];

describe("ProviderUpdatesTab", () => {
  const defaultProps = {
    availableUpdates: [] as UpdateInfo[],
    loadingUpdates: false,
    onCheckUpdates: jest.fn(() => Promise.resolve([] as UpdateInfo[])),
    onUpdatePackage: jest.fn(() => Promise.resolve()),
    onUpdateAllPackages: jest.fn(() => Promise.resolve()),
  };

  beforeEach(() => jest.clearAllMocks());

  it("renders without crashing", () => {
    const { container } = render(<ProviderUpdatesTab {...defaultProps} />);
    expect(container).toBeInTheDocument();
  });

  it("shows empty state when no updates", () => {
    render(<ProviderUpdatesTab {...defaultProps} />);
    expect(screen.getByText("providerDetail.noUpdates")).toBeInTheDocument();
    expect(screen.getByText("providerDetail.noUpdatesDesc")).toBeInTheDocument();
  });

  it("shows loading skeleton when loading", () => {
    render(<ProviderUpdatesTab {...defaultProps} loadingUpdates={true} />);
    expect(screen.queryByText("providerDetail.noUpdates")).not.toBeInTheDocument();
  });

  it("renders update entries in a table", () => {
    render(<ProviderUpdatesTab {...defaultProps} availableUpdates={sampleUpdates} />);
    expect(screen.getByText("lodash")).toBeInTheDocument();
    expect(screen.getByText("4.17.20")).toBeInTheDocument();
    expect(screen.getByText("4.17.21")).toBeInTheDocument();
    expect(screen.getByText("express")).toBeInTheDocument();
  });

  it("shows update count badge", () => {
    render(<ProviderUpdatesTab {...defaultProps} availableUpdates={sampleUpdates} />);
    expect(screen.getByText("2")).toBeInTheDocument();
  });

  it("shows Update All button when updates exist", () => {
    render(<ProviderUpdatesTab {...defaultProps} availableUpdates={sampleUpdates} />);
    expect(screen.getByText("providerDetail.updateAll")).toBeInTheDocument();
  });

  it("does not show Update All button when no updates", () => {
    render(<ProviderUpdatesTab {...defaultProps} />);
    expect(screen.queryByText("providerDetail.updateAll")).not.toBeInTheDocument();
  });

  it("calls onCheckUpdates when check button clicked", async () => {
    const user = userEvent.setup();
    render(<ProviderUpdatesTab {...defaultProps} />);
    const checkBtn = screen.getByText("providerDetail.checkUpdates").closest("button")!;
    await user.click(checkBtn);
    expect(defaultProps.onCheckUpdates).toHaveBeenCalled();
  });

  it("disables check updates button when loading", () => {
    render(<ProviderUpdatesTab {...defaultProps} loadingUpdates={true} />);
    const checkBtn = screen.getByText("providerDetail.checkUpdates").closest("button")!;
    expect(checkBtn).toBeDisabled();
  });
});
