import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CacheMigrationDialog } from "./cache-migration-dialog";

const mockCacheMigrationValidate = jest.fn();
const mockCacheMigrate = jest.fn();
let mockIsTauri = false;

jest.mock("@/components/providers/locale-provider", () => ({
  useLocale: () => ({ t: (key: string) => key }),
}));

jest.mock("@/lib/tauri", () => ({
  get isTauri() {
    return () => mockIsTauri;
  },
  get cacheMigrationValidate() {
    return mockCacheMigrationValidate;
  },
  get cacheMigrate() {
    return mockCacheMigrate;
  },
}));

jest.mock("sonner", () => ({
  toast: { success: jest.fn(), error: jest.fn() },
}));

const defaultProps = {
  open: true,
  onOpenChange: jest.fn(),
  onMigrationComplete: jest.fn(),
};

const validValidation = {
  isValid: true,
  sourceSizeHuman: "1.5 GB",
  sourceFileCount: 42,
  destinationSpaceHuman: "100 GB",
  isSameDrive: false,
  errors: [] as string[],
  warnings: [] as string[],
};

describe("CacheMigrationDialog", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockIsTauri = false;
  });

  it("renders dialog title when open", () => {
    render(<CacheMigrationDialog {...defaultProps} />);
    expect(screen.getByText("cache.migration")).toBeInTheDocument();
  });

  it("does not render when closed", () => {
    render(<CacheMigrationDialog {...defaultProps} open={false} />);
    expect(screen.queryByText("cache.migration")).not.toBeInTheDocument();
  });

  it("renders dialog description", () => {
    render(<CacheMigrationDialog {...defaultProps} />);
    expect(screen.getByText("cache.migrationDesc")).toBeInTheDocument();
  });

  it("renders destination path input", () => {
    render(<CacheMigrationDialog {...defaultProps} />);
    expect(screen.getByPlaceholderText("cache.enterNewPath")).toBeInTheDocument();
  });

  it("renders migration mode radio group with both options", () => {
    render(<CacheMigrationDialog {...defaultProps} />);
    expect(screen.getByText("cache.migrationModeMove")).toBeInTheDocument();
    expect(screen.getByText("cache.migrationModeMoveAndLink")).toBeInTheDocument();
  });

  it("renders mode descriptions", () => {
    render(<CacheMigrationDialog {...defaultProps} />);
    expect(screen.getByText("cache.migrationModeMoveDesc")).toBeInTheDocument();
    expect(screen.getByText("cache.migrationModeMoveAndLinkDesc")).toBeInTheDocument();
  });

  it("disables validate button when input is empty", () => {
    render(<CacheMigrationDialog {...defaultProps} />);
    const validateBtn = screen.getByText("cache.migrationValidate");
    expect(validateBtn.closest("button")).toBeDisabled();
  });

  it("enables validate button when destination is entered", async () => {
    const user = userEvent.setup();
    render(<CacheMigrationDialog {...defaultProps} />);
    const input = screen.getByPlaceholderText("cache.enterNewPath");
    await user.type(input, "D:\\NewCache");
    const validateBtn = screen.getByText("cache.migrationValidate");
    expect(validateBtn.closest("button")).toBeEnabled();
  });

  it("disables migrate button when validation is not done", () => {
    render(<CacheMigrationDialog {...defaultProps} />);
    const migrateBtn = screen.getByText("cache.migrationStart");
    expect(migrateBtn.closest("button")).toBeDisabled();
  });

  it("renders cancel and migrate buttons in footer", () => {
    render(<CacheMigrationDialog {...defaultProps} />);
    expect(screen.getByText("common.cancel")).toBeInTheDocument();
    expect(screen.getByText("cache.migrationStart")).toBeInTheDocument();
  });

  it("shows destination label", () => {
    render(<CacheMigrationDialog {...defaultProps} />);
    expect(screen.getByText("cache.migrationDestination")).toBeInTheDocument();
  });

  it("shows migration mode label", () => {
    render(<CacheMigrationDialog {...defaultProps} />);
    expect(screen.getByText("cache.migrationMode")).toBeInTheDocument();
  });

  it("validates destination and shows validation result", async () => {
    mockIsTauri = true;
    mockCacheMigrationValidate.mockResolvedValue(validValidation);
    const user = userEvent.setup();
    render(<CacheMigrationDialog {...defaultProps} />);
    const input = screen.getByPlaceholderText("cache.enterNewPath");
    await user.type(input, "D:\\NewCache");
    const validateBtn = screen.getByText("cache.migrationValidate").closest("button")!;
    await user.click(validateBtn);
    await waitFor(() => {
      expect(screen.getByText("cache.readyToMigrate")).toBeInTheDocument();
    });
    expect(screen.getByText("1.5 GB")).toBeInTheDocument();
    expect(screen.getByText("42")).toBeInTheDocument();
  });

  it("shows validation errors when present", async () => {
    mockIsTauri = true;
    mockCacheMigrationValidate.mockResolvedValue({
      ...validValidation,
      isValid: false,
      errors: ["Not enough space"],
    });
    const user = userEvent.setup();
    render(<CacheMigrationDialog {...defaultProps} />);
    await user.type(screen.getByPlaceholderText("cache.enterNewPath"), "D:\\Bad");
    await user.click(screen.getByText("cache.migrationValidate").closest("button")!);
    await waitFor(() => {
      expect(screen.getByText("Not enough space")).toBeInTheDocument();
    });
  });

  it("shows validation warnings when present", async () => {
    mockIsTauri = true;
    mockCacheMigrationValidate.mockResolvedValue({
      ...validValidation,
      warnings: ["Slow drive detected"],
    });
    const user = userEvent.setup();
    render(<CacheMigrationDialog {...defaultProps} />);
    await user.type(screen.getByPlaceholderText("cache.enterNewPath"), "D:\\New");
    await user.click(screen.getByText("cache.migrationValidate").closest("button")!);
    await waitFor(() => {
      expect(screen.getByText("Slow drive detected")).toBeInTheDocument();
    });
  });

  it("migrates and shows success result", async () => {
    mockIsTauri = true;
    mockCacheMigrationValidate.mockResolvedValue(validValidation);
    mockCacheMigrate.mockResolvedValue({
      success: true,
      bytesMigratedHuman: "1.5 GB",
      filesCount: 42,
      symlinkCreated: true,
      error: null,
    });
    const user = userEvent.setup();
    render(<CacheMigrationDialog {...defaultProps} />);
    await user.type(screen.getByPlaceholderText("cache.enterNewPath"), "D:\\New");
    await user.click(screen.getByText("cache.migrationValidate").closest("button")!);
    await waitFor(() => {
      expect(screen.getByText("cache.readyToMigrate")).toBeInTheDocument();
    });
    await user.click(screen.getByText("cache.migrationStart").closest("button")!);
    await waitFor(() => {
      expect(screen.getByText("cache.migrationSymlinkCreated")).toBeInTheDocument();
    });
    expect(defaultProps.onMigrationComplete).toHaveBeenCalled();
  });

  it("shows failed migration result", async () => {
    mockIsTauri = true;
    mockCacheMigrationValidate.mockResolvedValue(validValidation);
    mockCacheMigrate.mockResolvedValue({
      success: false,
      bytesMigratedHuman: "0 B",
      filesCount: 0,
      symlinkCreated: false,
      error: "Permission denied",
    });
    const user = userEvent.setup();
    render(<CacheMigrationDialog {...defaultProps} />);
    await user.type(screen.getByPlaceholderText("cache.enterNewPath"), "D:\\New");
    await user.click(screen.getByText("cache.migrationValidate").closest("button")!);
    await waitFor(() => {
      expect(screen.getByText("cache.readyToMigrate")).toBeInTheDocument();
    });
    await user.click(screen.getByText("cache.migrationStart").closest("button")!);
    await waitFor(() => {
      expect(screen.getByText("Permission denied")).toBeInTheDocument();
    });
  });

  it("resets state on close", async () => {
    const user = userEvent.setup();
    const onOpenChange = jest.fn();
    render(<CacheMigrationDialog {...defaultProps} onOpenChange={onOpenChange} />);
    await user.click(screen.getByText("common.cancel"));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("shows done button after successful migration", async () => {
    mockIsTauri = true;
    mockCacheMigrationValidate.mockResolvedValue(validValidation);
    mockCacheMigrate.mockResolvedValue({
      success: true,
      bytesMigratedHuman: "1.0 GB",
      filesCount: 10,
      symlinkCreated: false,
      error: null,
    });
    const user = userEvent.setup();
    render(<CacheMigrationDialog {...defaultProps} />);
    await user.type(screen.getByPlaceholderText("cache.enterNewPath"), "D:\\New");
    await user.click(screen.getByText("cache.migrationValidate").closest("button")!);
    await waitFor(() => {
      expect(screen.getByText("cache.readyToMigrate")).toBeInTheDocument();
    });
    await user.click(screen.getByText("cache.migrationStart").closest("button")!);
    await waitFor(() => {
      expect(screen.getByText("common.done")).toBeInTheDocument();
    });
  });
});
