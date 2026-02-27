import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ProfileManager } from "./profile-manager";

jest.mock("@/components/providers/locale-provider", () => ({
  useLocale: () => ({
    t: (key: string, params?: Record<string, string | number>) => {
      const translations: Record<string, string> = {
        "environments.profiles.title": "Environment Profiles",
        "environments.profiles.description": "Save and restore environment configurations",
        "environments.profiles.saveCurrentTitle": "Save Current Configuration",
        "environments.profiles.saveCurrentDesc": "Save your current environments as a profile",
        "environments.profiles.namePlaceholder": "Profile name",
        "environments.profiles.save": "Save",
        "environments.profiles.importJson": "Import JSON",
        "environments.profiles.importFile": "Import File",
        "environments.profiles.import": "Import",
        "environments.profiles.pasteJson": "Paste JSON here",
        "environments.profiles.noProfiles": "No profiles saved",
        "environments.profiles.noProfilesHint": "Save your current setup to get started",
        "environments.profiles.envCount": "envs",
        "environments.profiles.apply": "Apply",
        "environments.profiles.export": "Export",
        "environments.profiles.created": "Profile created",
        "environments.profiles.applied": `Applied ${params?.name || ""}`,
        "environments.profiles.partiallyApplied": `Partially applied ${params?.name || ""}`,
        "environments.profiles.deleted": "Profile deleted",
        "environments.profiles.exported": "Exported to clipboard",
        "environments.profiles.exportedFile": "Exported as file",
        "environments.profiles.imported": `Imported ${params?.name || ""}`,
        "environments.profiles.createdAt": `Created ${params?.date || ""}`,
        "environments.profiles.deleteConfirm": `Delete ${params?.name || ""}?`,
        "environments.profiles.applyResultTitle": `Results for ${params?.name || ""}`,
        "environments.refresh": "Refresh",
        "common.close": "Close",
        "common.cancel": "Cancel",
        "common.confirm": "Confirm",
        "common.delete": "Delete",
        "common.dismiss": "Dismiss",
      };
      return translations[key] || key;
    },
  }),
}));

const mockCreateFromCurrent = jest.fn();
const mockApplyProfile = jest.fn();
const mockDeleteProfile = jest.fn();
const mockExportProfile = jest.fn();
const mockImportProfile = jest.fn();
const mockRefresh = jest.fn();

let mockProfilesState = {
  profiles: [] as Array<{
    id: string;
    name: string;
    description: string | null;
    environments: Array<{ env_type: string; version: string; provider_id: string }>;
    created_at: string;
  }>,
  loading: false,
  error: null as string | null,
};

jest.mock("@/hooks/use-profiles", () => ({
  useProfiles: () => ({
    ...mockProfilesState,
    refresh: mockRefresh,
    createFromCurrent: mockCreateFromCurrent,
    applyProfile: mockApplyProfile,
    deleteProfile: mockDeleteProfile,
    exportProfile: mockExportProfile,
    importProfile: mockImportProfile,
  }),
}));

jest.mock("@/lib/clipboard", () => ({
  writeClipboard: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("sonner", () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
    warning: jest.fn(),
  },
}));

import { toast } from "sonner";

const sampleProfile = {
  id: "p1",
  name: "Dev Setup",
  description: "My dev environment",
  environments: [
    { env_type: "node", version: "18.0.0", provider_id: "fnm" },
    { env_type: "python", version: "3.11.0", provider_id: "pyenv" },
  ],
  created_at: "2024-06-01T00:00:00Z",
};

describe("ProfileManager", () => {
  const defaultProps = {
    open: true,
    onOpenChange: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockCreateFromCurrent.mockResolvedValue({ id: "1", name: "Test" });
    mockApplyProfile.mockResolvedValue({
      profile_id: "p1",
      profile_name: "Dev Setup",
      successful: [{ env_type: "node", version: "18.0.0" }],
      failed: [],
      skipped: [],
    });
    mockDeleteProfile.mockResolvedValue(true);
    mockExportProfile.mockResolvedValue('{"name":"Dev Setup"}');
    mockImportProfile.mockResolvedValue({ id: "p2", name: "Imported" });
    mockProfilesState = {
      profiles: [],
      loading: false,
      error: null,
    };
  });

  it("renders dialog with title", () => {
    render(<ProfileManager {...defaultProps} />);
    expect(screen.getByText("Environment Profiles")).toBeInTheDocument();
  });

  it("renders dialog description", () => {
    render(<ProfileManager {...defaultProps} />);
    expect(
      screen.getByText("Save and restore environment configurations"),
    ).toBeInTheDocument();
  });

  it("renders save current section", () => {
    render(<ProfileManager {...defaultProps} />);
    expect(screen.getByText("Save Current Configuration")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Profile name")).toBeInTheDocument();
  });

  it("renders save button disabled when name is empty", () => {
    render(<ProfileManager {...defaultProps} />);
    const saveBtn = screen.getByText("Save").closest("button");
    expect(saveBtn).toBeDisabled();
  });

  it("enables save button when name is entered", async () => {
    const user = userEvent.setup();
    render(<ProfileManager {...defaultProps} />);
    await user.type(screen.getByPlaceholderText("Profile name"), "My Profile");
    const saveBtn = screen.getByText("Save").closest("button");
    expect(saveBtn).not.toBeDisabled();
  });

  it("calls createFromCurrent when save is clicked", async () => {
    const user = userEvent.setup();
    render(<ProfileManager {...defaultProps} />);
    await user.type(screen.getByPlaceholderText("Profile name"), "My Profile");
    await user.click(screen.getByText("Save"));

    await waitFor(() => {
      expect(mockCreateFromCurrent).toHaveBeenCalledWith("My Profile");
    });
  });

  it("shows success toast after creating profile", async () => {
    const user = userEvent.setup();
    render(<ProfileManager {...defaultProps} />);
    await user.type(screen.getByPlaceholderText("Profile name"), "My Profile");
    await user.click(screen.getByText("Save"));

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith("Profile created");
    });
  });

  it("shows error toast when create fails", async () => {
    mockCreateFromCurrent.mockRejectedValue(new Error("Create failed"));
    const user = userEvent.setup();
    render(<ProfileManager {...defaultProps} />);
    await user.type(screen.getByPlaceholderText("Profile name"), "Fail");
    await user.click(screen.getByText("Save"));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Error: Create failed");
    });
  });

  it("renders empty profiles state", () => {
    render(<ProfileManager {...defaultProps} />);
    expect(screen.getByText("No profiles saved")).toBeInTheDocument();
    expect(screen.getByText("Save your current setup to get started")).toBeInTheDocument();
  });

  it("renders profile cards when profiles exist", () => {
    mockProfilesState.profiles = [sampleProfile];
    render(<ProfileManager {...defaultProps} />);
    expect(screen.getByText("Dev Setup")).toBeInTheDocument();
    expect(screen.getByText("My dev environment")).toBeInTheDocument();
    expect(screen.getByText(/2 envs/)).toBeInTheDocument();
  });

  it("renders environment badges on profile card", () => {
    mockProfilesState.profiles = [sampleProfile];
    render(<ProfileManager {...defaultProps} />);
    expect(screen.getByText("node@18.0.0")).toBeInTheDocument();
    expect(screen.getByText("python@3.11.0")).toBeInTheDocument();
  });

  it("calls applyProfile when apply button is clicked", async () => {
    mockProfilesState.profiles = [sampleProfile];
    const user = userEvent.setup();
    render(<ProfileManager {...defaultProps} />);
    const applyBtn = screen.getByTitle("Apply");
    await user.click(applyBtn);

    await waitFor(() => {
      expect(mockApplyProfile).toHaveBeenCalledWith("p1");
    });
  });

  it("shows apply result after successful apply", async () => {
    mockProfilesState.profiles = [sampleProfile];
    const user = userEvent.setup();
    render(<ProfileManager {...defaultProps} />);
    await user.click(screen.getByTitle("Apply"));

    await waitFor(() => {
      expect(screen.getByText("Results for Dev Setup")).toBeInTheDocument();
    });
  });

  it("shows warning toast for partial apply", async () => {
    mockApplyProfile.mockResolvedValue({
      profile_id: "p1",
      profile_name: "Dev Setup",
      successful: [{ env_type: "node", version: "18.0.0" }],
      failed: [{ env_type: "python", version: "3.11.0", error: "Not found" }],
      skipped: [],
    });
    mockProfilesState.profiles = [sampleProfile];
    const user = userEvent.setup();
    render(<ProfileManager {...defaultProps} />);
    await user.click(screen.getByTitle("Apply"));

    await waitFor(() => {
      expect(toast.warning).toHaveBeenCalled();
    });
  });

  it("calls exportProfile when export button is clicked", async () => {
    mockProfilesState.profiles = [sampleProfile];
    const user = userEvent.setup();
    render(<ProfileManager {...defaultProps} />);
    await user.click(screen.getByTitle("Export"));

    await waitFor(() => {
      expect(mockExportProfile).toHaveBeenCalledWith("p1");
    });
  });

  it("renders import JSON button", () => {
    render(<ProfileManager {...defaultProps} />);
    expect(screen.getByText("Import JSON")).toBeInTheDocument();
  });

  it("renders import file button", () => {
    render(<ProfileManager {...defaultProps} />);
    expect(screen.getByText("Import File")).toBeInTheDocument();
  });

  it("toggles import JSON textarea when import JSON is clicked", async () => {
    const user = userEvent.setup();
    render(<ProfileManager {...defaultProps} />);
    await user.click(screen.getByText("Import JSON"));
    expect(screen.getByPlaceholderText("Paste JSON here")).toBeInTheDocument();
  });

  it("calls importProfile when import is submitted", async () => {
    const user = userEvent.setup();
    render(<ProfileManager {...defaultProps} />);
    await user.click(screen.getByText("Import JSON"));
    const textarea = screen.getByPlaceholderText("Paste JSON here");
    // Use paste to avoid userEvent interpreting curly braces as special keys
    await user.click(textarea);
    await user.paste('{"name":"test"}');
    await user.click(screen.getByText("Import"));

    await waitFor(() => {
      expect(mockImportProfile).toHaveBeenCalledWith('{"name":"test"}');
    });
  });

  it("renders close button in footer", () => {
    render(<ProfileManager {...defaultProps} />);
    const closeButtons = screen.getAllByText("Close");
    expect(closeButtons.length).toBeGreaterThanOrEqual(1);
  });

  it("calls onOpenChange when footer close button is clicked", async () => {
    const user = userEvent.setup();
    render(<ProfileManager {...defaultProps} />);
    const closeButtons = screen.getAllByText("Close");
    const footerCloseBtn = closeButtons[closeButtons.length - 1];
    await user.click(footerCloseBtn);
    expect(defaultProps.onOpenChange).toHaveBeenCalledWith(false);
  });

  it("renders refresh button and calls refresh", async () => {
    const user = userEvent.setup();
    render(<ProfileManager {...defaultProps} />);
    await user.click(screen.getByText("Refresh"));
    expect(mockRefresh).toHaveBeenCalled();
  });

  it("shows error alert when error exists", () => {
    mockProfilesState.error = "Failed to load profiles";
    render(<ProfileManager {...defaultProps} />);
    expect(screen.getByText("Failed to load profiles")).toBeInTheDocument();
  });

  it("does not render when open is false", () => {
    render(<ProfileManager open={false} onOpenChange={jest.fn()} />);
    expect(screen.queryByText("Environment Profiles")).toBeNull();
  });

  it("shows +N badge when profile has more than 5 environments", () => {
    mockProfilesState.profiles = [
      {
        ...sampleProfile,
        environments: [
          { env_type: "node", version: "18.0.0", provider_id: "fnm" },
          { env_type: "python", version: "3.11.0", provider_id: "pyenv" },
          { env_type: "rust", version: "1.70.0", provider_id: "rustup" },
          { env_type: "go", version: "1.21.0", provider_id: "goenv" },
          { env_type: "java", version: "17.0.0", provider_id: "sdkman" },
          { env_type: "ruby", version: "3.2.0", provider_id: "rbenv" },
        ],
      },
    ];
    render(<ProfileManager {...defaultProps} />);
    expect(screen.getByText("+1")).toBeInTheDocument();
  });
});
