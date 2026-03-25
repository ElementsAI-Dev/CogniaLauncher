import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { WslBackupCard } from "./wsl-backup-card";

jest.mock("sonner", () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
  },
}));

type BackupEntry = {
  fileName: string;
  filePath: string;
  sizeBytes: number;
  createdAt: string;
  distroName: string;
};

const t = (key: string, params?: Record<string, string | number>) => {
  const dict: Record<string, string> = {
    "wsl.backupMgmt.title": "Backups",
    "wsl.backupMgmt.backupDir": "Backup Directory",
    "wsl.backupMgmt.create": "Create Backup",
    "wsl.backupMgmt.created": "Backup created",
    "wsl.backupMgmt.restore": "Restore Backup",
    "wsl.backupMgmt.restored": "Backup restored",
    "wsl.backupMgmt.delete": "Delete Backup",
    "wsl.backupMgmt.deleted": "Backup deleted",
    "wsl.backupMgmt.deleteConfirm": "Delete this backup?",
    "wsl.backupMgmt.noBackups": "No backups",
    "wsl.backupMgmt.noBackupsDesc": "Create a backup first",
    "wsl.backupMgmt.totalSize": "Total Size",
    "wsl.backupMgmt.distroName": "Distro Name",
    "wsl.backupMgmt.installLocation": "Install Location",
    "wsl.workspaceContext.following": "Following active workspace: {name}",
    "wsl.workspaceContext.override": "Override target: {name}",
    "wsl.workspaceContext.active": "Active workspace: {name}",
    "wsl.workspaceContext.return": "Use Active Workspace",
    "wsl.workflow.failed": "Failed: {action}",
    "common.cancel": "Cancel",
    "common.refresh": "Refresh",
  };

  if (key === "wsl.workflow.failed" && params?.action) {
    return `Failed: ${params.action}`;
  }

  return dict[key] ?? key;
};

const sampleBackup: BackupEntry = {
  fileName: "ubuntu-backup.tar",
  filePath: "C:\\WSL-Backups\\ubuntu-backup.tar",
  sizeBytes: 1024,
  createdAt: "2026-03-19T10:00:00.000Z",
  distroName: "Ubuntu",
};

describe("WslBackupCard", () => {
  const backupDistro = jest.fn<Promise<BackupEntry>, [string, string]>();
  const listBackups = jest.fn<Promise<BackupEntry[]>, [string]>();
  const restoreBackup = jest.fn<Promise<void>, [string, string, string]>();
  const deleteBackup = jest.fn<Promise<void>, [string]>();
  const onRestoreSuccess = jest.fn<Promise<void>, []>();
  const onMutationSuccess = jest.fn<Promise<void>, []>();

  beforeEach(() => {
    jest.clearAllMocks();
    backupDistro.mockResolvedValue(sampleBackup);
    listBackups.mockResolvedValue([]);
    restoreBackup.mockResolvedValue();
    deleteBackup.mockResolvedValue();
    onRestoreSuccess.mockResolvedValue();
    onMutationSuccess.mockResolvedValue();
  });

  function renderCard(options?: { distroNames?: string[]; activeWorkspaceDistroName?: string | null }) {
    return render(
      <WslBackupCard
        distroNames={options?.distroNames ?? ["Ubuntu"]}
        activeWorkspaceDistroName={options?.activeWorkspaceDistroName}
        backupDistro={backupDistro}
        listBackups={listBackups}
        restoreBackup={restoreBackup}
        deleteBackup={deleteBackup}
        onRestoreSuccess={onRestoreSuccess}
        onMutationSuccess={onMutationSuccess}
        t={t}
      />,
    );
  }

  it("renders empty state when no backups exist", async () => {
    renderCard();

    expect(await screen.findByText("No backups")).toBeInTheDocument();
    expect(listBackups).toHaveBeenCalledWith("%USERPROFILE%\\WSL-Backups");
  });

  it("creates a backup and records lifecycle success", async () => {
    const user = userEvent.setup();
    renderCard();

    await user.click(await screen.findByRole("button", { name: "Create Backup" }));

    await waitFor(() => {
      expect(backupDistro).toHaveBeenCalledWith(
        "Ubuntu",
        "%USERPROFILE%\\WSL-Backups",
      );
    });
    expect(onMutationSuccess).toHaveBeenCalled();
    expect(
      await screen.findByTestId("wsl-backup-lifecycle-feedback"),
    ).toBeInTheDocument();
    expect(screen.getByText("ubuntu-backup.tar")).toBeInTheDocument();
  });

  it("restores a backup from the restore dialog", async () => {
    const user = userEvent.setup();
    listBackups.mockResolvedValue([sampleBackup]);
    renderCard();

    expect(await screen.findByText("ubuntu-backup.tar")).toBeInTheDocument();

    const restoreIcon = document.querySelector(".lucide-rotate-cw");
    const restoreButton = restoreIcon?.closest("button") as HTMLButtonElement | null;
    expect(restoreButton).toBeTruthy();
    await user.click(restoreButton!);

    const restoreButtons = await screen.findAllByRole("button", {
      name: "Restore Backup",
    });
    await user.click(restoreButtons[restoreButtons.length - 1]);

    await waitFor(() => {
      expect(restoreBackup).toHaveBeenCalledWith(
        "C:\\WSL-Backups\\ubuntu-backup.tar",
        "Ubuntu-restored",
        "C:\\WSL\\Ubuntu-restored",
      );
    });
    expect(onRestoreSuccess).toHaveBeenCalled();
    expect(onMutationSuccess).toHaveBeenCalled();
  });

  it("deletes a backup from confirm dialog", async () => {
    const user = userEvent.setup();
    listBackups.mockResolvedValue([sampleBackup]);
    renderCard();

    expect(await screen.findByText("ubuntu-backup.tar")).toBeInTheDocument();

    const deleteIcons = Array.from(document.querySelectorAll(".lucide-trash-2"));
    const deleteButton = deleteIcons[0]?.closest("button") as HTMLButtonElement | null;
    expect(deleteButton).toBeTruthy();
    await user.click(deleteButton!);

    await user.click(await screen.findByRole("button", { name: "Delete Backup" }));

    await waitFor(() => {
      expect(deleteBackup).toHaveBeenCalledWith(
        "C:\\WSL-Backups\\ubuntu-backup.tar",
      );
    });
    expect(onMutationSuccess).toHaveBeenCalled();
  });

  it("uses the active workspace distro as the default backup target", async () => {
    const user = userEvent.setup();
    renderCard({
      distroNames: ["Ubuntu", "Debian"],
      activeWorkspaceDistroName: "Debian",
    });

    await user.click(await screen.findByRole("button", { name: "Create Backup" }));

    await waitFor(() => {
      expect(backupDistro).toHaveBeenCalledWith(
        "Debian",
        "%USERPROFILE%\\WSL-Backups",
      );
    });
  });

  it("preserves an explicit backup target override until the user returns to the active workspace", async () => {
    const user = userEvent.setup();
    const { rerender } = renderCard({
      distroNames: ["Ubuntu", "Debian"],
      activeWorkspaceDistroName: "Debian",
    });

    const distroSelect = await screen.findByDisplayValue("Debian");
    await user.selectOptions(distroSelect, "Ubuntu");

    rerender(
      <WslBackupCard
        distroNames={["Ubuntu", "Debian"]}
        activeWorkspaceDistroName="Debian"
        backupDistro={backupDistro}
        listBackups={listBackups}
        restoreBackup={restoreBackup}
        deleteBackup={deleteBackup}
        onRestoreSuccess={onRestoreSuccess}
        onMutationSuccess={onMutationSuccess}
        t={t}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Create Backup" }));

    await waitFor(() => {
      expect(backupDistro).toHaveBeenCalledWith(
        "Ubuntu",
        "%USERPROFILE%\\WSL-Backups",
      );
    });
  });
});
