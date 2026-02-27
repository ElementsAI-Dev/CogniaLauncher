import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { VersionPinningSection } from "./version-pinning-section";

jest.mock("@/lib/tauri", () => ({
  isTauri: jest.fn(() => false),
}));

jest.mock("sonner", () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
  },
}));

import { toast } from "sonner";
import { isTauri } from "@/lib/tauri";

const mockIsTauri = isTauri as unknown as jest.Mock;

describe("VersionPinningSection", () => {
  const mockT = (key: string) => {
    const translations: Record<string, string> = {
      "environments.details.globalVersion": "Global Version",
      "environments.details.globalVersionDesc": "Set the default version",
      "environments.details.localVersion": "Local Version",
      "environments.details.localVersionDesc": "Set version for a project",
      "environments.details.globalVersionSet": "Global version set",
      "environments.details.localVersionSet": "Local version set",
      "environments.details.manualPathRequired": "Enter path manually",
      "environments.details.selectProjectFolder": "Select project folder",
      "environments.details.browseFolder": "Browse folder",
      "environments.selectVersion": "Select version",
      "environments.projectPath": "Project Path",
      "environments.setLocal": "Set Local",
    };
    return translations[key] || key;
  };

  const mockOnSetGlobal = jest.fn();
  const mockOnSetLocal = jest.fn();

  const installedVersions = [
    { version: "18.0.0", is_current: true },
    { version: "20.0.0", is_current: false },
  ];

  const defaultProps = {
    installedVersions,
    currentVersion: "18.0.0",
    onSetGlobal: mockOnSetGlobal,
    onSetLocal: mockOnSetLocal,
    t: mockT,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockOnSetGlobal.mockResolvedValue(undefined);
    mockOnSetLocal.mockResolvedValue(undefined);
    mockIsTauri.mockReturnValue(false);
  });

  it("renders global version section", () => {
    render(<VersionPinningSection {...defaultProps} />);
    expect(screen.getByText("Global Version")).toBeInTheDocument();
    expect(screen.getByText("Set the default version")).toBeInTheDocument();
  });

  it("renders local version section", () => {
    render(<VersionPinningSection {...defaultProps} />);
    expect(screen.getByText("Local Version")).toBeInTheDocument();
    expect(screen.getByText("Set version for a project")).toBeInTheDocument();
  });

  it("renders set local button as disabled when no version or path", () => {
    render(<VersionPinningSection {...defaultProps} />);
    const setLocalBtn = screen.getByText("Set Local");
    expect(setLocalBtn.closest("button")).toBeDisabled();
  });

  it("renders project path input", () => {
    render(<VersionPinningSection {...defaultProps} />);
    expect(screen.getByPlaceholderText("Project Path")).toBeInTheDocument();
  });

  it("renders browse folder button", () => {
    render(<VersionPinningSection {...defaultProps} />);
    expect(screen.getByTitle("Browse folder")).toBeInTheDocument();
  });

  it("shows toast info when browse clicked in non-Tauri mode", async () => {
    render(<VersionPinningSection {...defaultProps} />);
    fireEvent.click(screen.getByTitle("Browse folder"));
    await waitFor(() => {
      expect(toast.info).toHaveBeenCalledWith("Enter path manually");
    });
  });

  it("renders with null currentVersion", () => {
    render(
      <VersionPinningSection {...defaultProps} currentVersion={null} />,
    );
    expect(screen.getByText("Global Version")).toBeInTheDocument();
  });

  it("renders version options in select triggers", () => {
    render(<VersionPinningSection {...defaultProps} />);
    // Both global and local select triggers should be present
    const triggers = screen.getAllByRole("combobox");
    expect(triggers.length).toBe(2);
  });

  it("allows typing in project path input", async () => {
    const user = userEvent.setup();
    render(<VersionPinningSection {...defaultProps} />);
    const input = screen.getByPlaceholderText("Project Path");
    await user.type(input, "/my/project");
    expect(input).toHaveValue("/my/project");
  });

  it("shows toast info when browse clicked in Tauri mode without dialog module", async () => {
    mockIsTauri.mockReturnValue(true);
    render(<VersionPinningSection {...defaultProps} />);
    fireEvent.click(screen.getByTitle("Browse folder"));
    await waitFor(() => {
      // Dynamic import of @tauri-apps/plugin-dialog will fail, fallback to manual path
      expect(toast.info).toHaveBeenCalledWith("Enter path manually");
    });
  });

  it("renders empty installed versions", () => {
    render(
      <VersionPinningSection
        {...defaultProps}
        installedVersions={[]}
      />,
    );
    expect(screen.getByText("Global Version")).toBeInTheDocument();
  });
});
