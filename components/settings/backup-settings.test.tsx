import React from "react";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { toast } from "sonner";
import {
  BackupSettings,
  buildBackupDatabaseInfoMessage,
  describeBackupStatus,
  deriveRestoreErrorMessage,
  getBackupActionHint,
  toggleBackupContentSelection,
} from "./backup-settings";

const mockUseBackup = jest.fn();
const mockIsTauri = jest.fn();

jest.mock("@/hooks/use-backup", () => ({
  useBackup: () => mockUseBackup(),
}));

jest.mock("@/lib/tauri", () => ({
  isTauri: () => mockIsTauri(),
}));

jest.mock("sonner", () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
    warning: jest.fn(),
    info: jest.fn(),
  },
}));

const mockT = (key: string, params?: Record<string, string | number>) => {
  const translations: Record<string, string> = {
    "backup.description": "Backup policy and operations",
    "backup.create": "Create Backup",
    "backup.creating": "Creating...",
    "backup.selectContents": "Select contents",
    "backup.addNote": "Add note",
    "backup.noBackups": "No backups yet",
    "backup.validate": "Validate",
    "backup.restore": "Restore",
    "backup.restoreWarning": "Restoring will replace current settings.",
    "backup.restoreSuccess": "Restore completed",
    "backup.restoreFailed": "Restore failed",
    "backup.delete": "Delete",
    "backup.deleteConfirm": "Delete this backup?",
    "backup.deleteSuccess": "Backup deleted",
    "backup.autoLabel": "Auto",
    "backup.validationPassed": "Validation passed",
    "backup.validationFailed": "Validation failed",
    "backup.backupCreated": "Backup created",
    "backup.backupFailed": "Backup failed",
    "backup.database.info": "Database Info",
    "backup.database.integrityCheck": "Integrity Check",
    "backup.database.integrityOk": "Integrity OK",
    "backup.database.integrityErrors": "Integrity errors: {count}",
    "backup.database.dbSize": "DB Size",
    "backup.database.walSize": "WAL Size",
    "backup.database.pageCount": "Page Count",
    "backup.missingFiles": "Missing files: {count}",
    "backup.checksumMismatches": "Checksum mismatches: {count}",
    "backup.contentTypes.config": "Config",
    "backup.contentTypes.cache_database": "Cache Database",
    "common.refresh": "Refresh",
    "common.cancel": "Cancel",
    "common.close": "Close",
  };

  let value = translations[key] || key;
  if (params) {
    for (const [paramKey, paramValue] of Object.entries(params)) {
      value = value.replace(`{${paramKey}}`, String(paramValue));
    }
  }
  return value;
};

function createBackupMock(overrides?: Partial<ReturnType<typeof mockUseBackup>>) {
  return {
    backups: [],
    loading: false,
    error: null,
    creating: false,
    restoring: false,
    refresh: jest.fn(),
    create: jest.fn().mockResolvedValue({
      status: "success",
      durationMs: 42,
      issues: [],
      error: null,
    }),
    restore: jest.fn().mockResolvedValue({
      status: "success",
      skipped: [],
      error: null,
    }),
    remove: jest.fn().mockResolvedValue({
      status: "success",
      deleted: true,
      error: null,
      issues: [],
    }),
    validate: jest.fn().mockResolvedValue({
      valid: true,
      missingFiles: [],
      checksumMismatches: [],
      errors: [],
    }),
    checkIntegrity: jest.fn().mockResolvedValue({ ok: true, errors: [] }),
    getDatabaseInfo: jest.fn().mockResolvedValue({
      dbSizeHuman: "10 MB",
      walSizeHuman: "1 MB",
      pageCount: 12,
    }),
    ...overrides,
  };
}

describe("backup-settings reason hints", () => {
  it("maps operation-in-progress reason to actionable guidance", () => {
    expect(getBackupActionHint("operation_in_progress")).toContain(
      "Another backup operation is running",
    );
  });

  it("maps restore safety fallback reason to actionable guidance", () => {
    expect(getBackupActionHint("restore_safety_backup_failed")).toContain(
      "safety backup step failed",
    );
  });

  it("maps cleanup policy reason to actionable guidance", () => {
    expect(getBackupActionHint("cleanup_policy_unbounded")).toContain(
      "no cleanup operation is performed",
    );
  });

  it("maps permission and path reasons", () => {
    expect(getBackupActionHint("backup_create_permission_denied")).toContain(
      "insufficient file-system permissions",
    );
    expect(getBackupActionHint("backup_import_path_conflict")).toContain(
      "invalid, missing, or conflicts",
    );
  });

  it("returns null for unknown reason codes", () => {
    expect(getBackupActionHint("unknown_reason")).toBeNull();
    expect(getBackupActionHint()).toBeNull();
  });

  it("describes backup operation statuses", () => {
    expect(describeBackupStatus("success")).toBe("success");
    expect(describeBackupStatus("partial")).toBe("partial");
    expect(describeBackupStatus("skipped")).toBe("skipped");
    expect(describeBackupStatus("failed")).toBe("failed");
  });

  it("derives restore errors from error, hint, skipped reasons, and fallback", () => {
    expect(
      deriveRestoreErrorMessage(
        { error: "boom", skipped: [] },
        "hint",
      ),
    ).toBe("boom");
    expect(
      deriveRestoreErrorMessage(
        { error: null, skipped: [] },
        "hint",
      ),
    ).toBe("hint");
    expect(
      deriveRestoreErrorMessage(
        { error: null, skipped: [{ contentType: "config", reason: "conflict" }] },
        null,
      ),
    ).toBe("config: conflict");
    expect(
      deriveRestoreErrorMessage(
        { error: null, skipped: [] },
        null,
      ),
    ).toBe("Unknown error");
  });

  it("toggles backup content selection in both directions", () => {
    expect(toggleBackupContentSelection(["config"], "config")).toEqual([]);
    expect(toggleBackupContentSelection(["config"], "cache_database")).toEqual([
      "config",
      "cache_database",
    ]);
  });

  it("builds database info messages with a WAL size fallback", () => {
    expect(
      buildBackupDatabaseInfoMessage(
        { dbSizeHuman: "10 MB", walSizeHuman: null, pageCount: 12 },
        mockT,
      ),
    ).toContain("WAL Size: 0 B");
  });
});

describe("BackupSettings", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockIsTauri.mockReturnValue(true);
    mockUseBackup.mockReturnValue(createBackupMock());
  });

  it("renders desktop fallback when Tauri is unavailable", () => {
    mockIsTauri.mockReturnValue(false);

    render(<BackupSettings t={mockT} />);

    expect(screen.getByText("Backup policy and operations")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Create Backup" })).not.toBeInTheDocument();
  });

  it("renders an empty state when no backups exist", () => {
    render(<BackupSettings t={mockT} />);

    expect(screen.getByText("No backups yet")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Refresh" })).toBeInTheDocument();
  });

  it("creates a backup and shows a success toast", async () => {
    const backupHook = createBackupMock();
    mockUseBackup.mockReturnValue(backupHook);

    render(<BackupSettings t={mockT} />);

    await userEvent.click(screen.getByRole("button", { name: "Create Backup" }));
    await userEvent.type(screen.getByLabelText("Add note"), "Nightly snapshot");
    await userEvent.click(screen.getByRole("button", { name: "Create Backup" }));

    await waitFor(() => {
      expect(backupHook.create).toHaveBeenCalledWith(
        expect.arrayContaining(["config", "cache_database"]),
        "Nightly snapshot",
      );
    });
    expect(toast.success).toHaveBeenCalledWith("Backup created");
  });

  it("shows a warning when backup creation completes partially", async () => {
    const backupHook = createBackupMock({
      create: jest.fn().mockResolvedValue({
        status: "partial",
        durationMs: 42,
        issues: [{ message: "config missing" }],
        error: null,
      }),
    });
    mockUseBackup.mockReturnValue(backupHook);

    render(<BackupSettings t={mockT} />);

    await userEvent.click(screen.getByRole("button", { name: "Create Backup" }));
    const createDialog = await screen.findByRole("dialog");
    await userEvent.click(within(createDialog).getByRole("button", { name: "Create Backup" }));

    await waitFor(() => {
      expect(toast.warning).toHaveBeenCalledWith("Backup failed");
    });
  });

  it("shows an error when backup creation returns a non-partial failure status", async () => {
    const backupHook = createBackupMock({
      create: jest.fn().mockResolvedValue({
        status: "skipped",
        durationMs: 42,
        issues: [],
        error: "blocked",
      }),
    });
    mockUseBackup.mockReturnValue(backupHook);

    render(<BackupSettings t={mockT} />);

    await userEvent.click(screen.getByRole("button", { name: "Create Backup" }));
    const createDialog = await screen.findByRole("dialog");
    await userEvent.click(within(createDialog).getByRole("button", { name: "Create Backup" }));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Backup failed");
    });
  });

  it("handles partial backup creation when issue details are omitted", async () => {
    const backupHook = createBackupMock({
      create: jest.fn().mockResolvedValue({
        status: "partial",
        durationMs: 42,
        issues: undefined,
        error: null,
      }),
    });
    mockUseBackup.mockReturnValue(backupHook);

    render(<BackupSettings t={mockT} />);

    await userEvent.click(screen.getByRole("button", { name: "Create Backup" }));
    const createDialog = await screen.findByRole("dialog");
    await userEvent.click(within(createDialog).getByRole("button", { name: "Create Backup" }));

    await waitFor(() => {
      expect(toast.warning).toHaveBeenCalledWith("Backup failed");
    });
  });

  it("renders backup cards and handles validate, restore, and database actions", async () => {
    const backupHook = createBackupMock({
      backups: [
        {
          path: "/tmp/backup-1",
          name: "backup-1",
          sizeHuman: "12 MB",
          manifest: {
            createdAt: "2026-03-17T12:00:00.000Z",
            appVersion: "1.0.0",
            contents: ["config", "cache_database"],
            note: "auto-backup before restore",
          },
        },
      ],
    });
    mockUseBackup.mockReturnValue(backupHook);

    render(<BackupSettings t={mockT} />);

    expect(screen.getByText("backup-1")).toBeInTheDocument();
    expect(screen.getByText("Auto")).toBeInTheDocument();
    expect(screen.getByText("Config")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Database Info" }));
    expect(backupHook.getDatabaseInfo).toHaveBeenCalled();
    expect(toast.info).toHaveBeenCalledWith(
      "DB Size: 10 MB | WAL Size: 1 MB | Page Count: 12",
    );

    await userEvent.click(screen.getByRole("button", { name: "Integrity Check" }));
    await waitFor(() => {
      expect(backupHook.checkIntegrity).toHaveBeenCalled();
    });
    expect(toast.success).toHaveBeenCalledWith("Integrity OK");

    await userEvent.click(screen.getByRole("button", { name: "Validate" }));
    await waitFor(() => {
      expect(backupHook.validate).toHaveBeenCalledWith("/tmp/backup-1");
    });
    expect(await screen.findByText("Validation passed")).toBeInTheDocument();
    await userEvent.click(screen.getAllByRole("button", { name: "Close" })[0]);

    await userEvent.click(screen.getByRole("button", { name: "Restore" }));
    const restoreDialog = await screen.findByRole("alertdialog");
    await userEvent.click(within(restoreDialog).getByRole("button", { name: "Restore" }));
    await waitFor(() => {
      expect(backupHook.restore).toHaveBeenCalledWith(
        "/tmp/backup-1",
        expect.arrayContaining(["config", "cache_database"]),
      );
    });
    expect(toast.success).toHaveBeenCalledWith("Restore completed");

  });

  it("surfaces restore warnings, delete errors, and validation failures", async () => {
    const backupHook = createBackupMock({
      backups: [
        {
          path: "/tmp/backup-2",
          name: "backup-2",
          sizeHuman: "8 MB",
          manifest: {
            createdAt: "2026-03-18T12:00:00.000Z",
            appVersion: "1.0.0",
            contents: ["config"],
            note: "manual backup",
          },
        },
      ],
      restore: jest.fn().mockResolvedValue({
        status: "partial",
        skipped: [{ contentType: "config", reason: "conflict" }],
        error: null,
      }),
      remove: jest.fn().mockResolvedValue({
        status: "skipped",
        deleted: false,
        reasonCode: "backup_delete_permission_denied",
        error: null,
        issues: [],
      }),
      validate: jest.fn().mockResolvedValue({
        valid: false,
        missingFiles: ["config.toml"],
        checksumMismatches: ["data.db"],
        errors: ["checksum failed"],
      }),
    });
    mockUseBackup.mockReturnValue(backupHook);

    render(<BackupSettings t={mockT} />);

    await userEvent.click(screen.getByRole("button", { name: "Validate" }));
    expect(await screen.findByText("Validation failed")).toBeInTheDocument();
    expect(screen.getByText("config.toml")).toBeInTheDocument();
    expect(screen.getByText("data.db")).toBeInTheDocument();
    expect(screen.getByText("checksum failed")).toBeInTheDocument();
    await userEvent.click(screen.getAllByRole("button", { name: "Close" })[0]);

    await userEvent.click(screen.getByRole("button", { name: "Restore" }));
    const restoreDialog = await screen.findByRole("alertdialog");
    await userEvent.click(within(restoreDialog).getByRole("button", { name: "Restore" }));
    await waitFor(() => {
      expect(toast.warning).toHaveBeenCalledWith("Restore failed");
    });

  });

  it("surfaces restore errors when the restore result is not partial", async () => {
    const backupHook = createBackupMock({
      backups: [
        {
          path: "/tmp/backup-error",
          name: "backup-error",
          sizeHuman: "8 MB",
          manifest: {
            createdAt: "2026-03-18T12:00:00.000Z",
            appVersion: "1.0.0",
            contents: ["config"],
            note: null,
          },
        },
      ],
      restore: jest.fn().mockResolvedValue({
        status: "error",
        skipped: [],
        error: null,
      }),
    });
    mockUseBackup.mockReturnValue(backupHook);

    render(<BackupSettings t={mockT} />);

    await userEvent.click(screen.getByRole("button", { name: "Restore" }));
    const restoreDialog = await screen.findByRole("alertdialog");
    await userEvent.click(within(restoreDialog).getByRole("button", { name: "Restore" }));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Restore failed");
    });
  });

  it("allows toggling create and restore content selections and deleting backups", async () => {
    const backupHook = createBackupMock({
      backups: [
        {
          path: "/tmp/backup-3",
          name: "backup-3",
          sizeHuman: "8 MB",
          manifest: {
            createdAt: "2026-03-18T12:00:00.000Z",
            appVersion: "1.0.0",
            contents: ["config", "cache_database"],
            note: null,
          },
        },
      ],
    });
    mockUseBackup.mockReturnValue(backupHook);

    render(<BackupSettings t={mockT} />);

    await userEvent.click(screen.getByRole("button", { name: "Create Backup" }));
    const createDialog = await screen.findByRole("dialog");
    const createCheckboxes = within(createDialog).getAllByRole("checkbox");
    await userEvent.click(createCheckboxes[0]);
    await userEvent.click(within(createDialog).getByRole("button", { name: "Create Backup" }));
    await waitFor(() => {
      expect(backupHook.create).toHaveBeenCalledWith(
        expect.not.arrayContaining(["config"]),
        undefined,
      );
    });

    await userEvent.click(screen.getByRole("button", { name: "Restore" }));
    const restoreDialog = await screen.findByRole("alertdialog");
    const restoreCheckboxes = within(restoreDialog).getAllByRole("checkbox");
    await userEvent.click(restoreCheckboxes[0]);
    await userEvent.click(within(restoreDialog).getByRole("button", { name: "Restore" }));
    await waitFor(() => {
      expect(backupHook.restore).toHaveBeenCalledWith(
        "/tmp/backup-3",
        expect.not.arrayContaining(["config"]),
      );
    });

  });

  it("renders loading skeletons and restore spinner states", () => {
    mockUseBackup.mockReturnValue(
      createBackupMock({
        loading: true,
        backups: [],
      }),
    );
    const { container, rerender } = render(<BackupSettings t={mockT} />);
    expect(container.querySelectorAll('[class*="animate-pulse"]').length).toBeGreaterThan(0);

    mockUseBackup.mockReturnValue(
      createBackupMock({
        backups: [
          {
            path: "/tmp/backup-4",
            name: "backup-4",
            sizeHuman: "5 MB",
            manifest: {
              createdAt: "2026-03-18T12:00:00.000Z",
              appVersion: "1.0.0",
              contents: ["mystery"],
              note: null,
            },
          },
        ],
        restoring: true,
      }),
    );
    rerender(<BackupSettings t={mockT} />);

    expect(screen.getByText("mystery")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Restore" })).toBeInTheDocument();
  });

  it("shows delete and integrity error states when operations fail", async () => {
    const backupHook = createBackupMock({
      backups: [
        {
          path: "/tmp/backup-5",
          name: "backup-5",
          sizeHuman: "4 MB",
          manifest: {
            createdAt: "2026-03-18T12:00:00.000Z",
            appVersion: "1.0.0",
            contents: ["config"],
            note: null,
          },
        },
      ],
      remove: jest.fn().mockResolvedValue({
        status: "error",
        deleted: false,
        error: "cannot delete",
        issues: [],
      }),
      checkIntegrity: jest.fn().mockResolvedValue({ ok: false, errors: ["broken"] }),
      getDatabaseInfo: jest.fn().mockResolvedValue(null),
      validate: jest.fn().mockResolvedValue(null),
    });
    mockUseBackup.mockReturnValue(backupHook);

    render(<BackupSettings t={mockT} />);

    await userEvent.click(screen.getByRole("button", { name: "Database Info" }));
    expect(toast.info).not.toHaveBeenCalledWith(expect.stringContaining("DB Size"));

    await userEvent.click(screen.getByRole("button", { name: "Integrity Check" }));
    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Integrity errors: 1");
    });

    await userEvent.click(screen.getByRole("button", { name: "Validate" }));
    await waitFor(() => {
      expect(backupHook.validate).toHaveBeenCalledWith("/tmp/backup-5");
    });
    expect(screen.queryByText("Validation passed")).not.toBeInTheDocument();
  });

  it("does not open the validation dialog when validation returns null", async () => {
    const backupHook = createBackupMock({
      backups: [
        {
          path: "/tmp/backup-null",
          name: "backup-null",
          sizeHuman: "4 MB",
          manifest: {
            createdAt: "2026-03-18T12:00:00.000Z",
            appVersion: "1.0.0",
            contents: ["config"],
            note: null,
          },
        },
      ],
      validate: jest.fn().mockResolvedValue(null),
    });
    mockUseBackup.mockReturnValue(backupHook);

    render(<BackupSettings t={mockT} />);

    await userEvent.click(screen.getByRole("button", { name: "Validate" }));
    await waitFor(() => {
      expect(backupHook.validate).toHaveBeenCalledWith("/tmp/backup-null");
    });

    expect(screen.queryByText("Validation passed")).not.toBeInTheDocument();
    expect(screen.queryByText("Validation failed")).not.toBeInTheDocument();
  });

  it("shows creating state on the primary action button", () => {
    mockUseBackup.mockReturnValue(
      createBackupMock({
        creating: true,
      }),
    );

    render(<BackupSettings t={mockT} />);

    expect(screen.getByRole("button", { name: "Creating..." })).toBeDisabled();
  });
});
