import { toast } from 'sonner';
import {
  diagnosticExportBundle,
  diagnosticGetDefaultExportPath,
  isTauri,
} from '@/lib/tauri';
import type {
  DiagnosticErrorContext,
  DiagnosticExportResult,
} from '@/types/tauri';

export type DesktopDiagnosticExportResult =
  | { ok: true; data: DiagnosticExportResult }
  | { ok: false; cancelled: true }
  | { ok: false; error: string };

interface ExportDesktopDiagnosticBundleOptions {
  t: (key: string) => string;
  failureToastKey: string;
  includeConfig?: boolean;
  errorContext?: DiagnosticErrorContext;
}

function toErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }
  if (typeof error === 'string' && error.trim()) {
    return error;
  }
  return 'Failed to export diagnostics';
}

export async function exportDesktopDiagnosticBundle({
  t,
  failureToastKey,
  includeConfig = true,
  errorContext,
}: ExportDesktopDiagnosticBundleOptions): Promise<DesktopDiagnosticExportResult> {
  if (!isTauri()) {
    return { ok: false, error: 'Desktop diagnostics are unavailable in this runtime' };
  }

  let outputPath: string | undefined;
  try {
    const { save } = await import('@tauri-apps/plugin-dialog');
    const defaultPath = await diagnosticGetDefaultExportPath();
    const ts = new Date()
      .toISOString()
      .replace(/[:.]/g, '-')
      .slice(0, 19);
    const selected = await save({
      title: t('diagnostic.selectExportPath'),
      defaultPath: `${defaultPath}/cognia-diagnostic-${ts}.zip`,
      filters: [{ name: 'ZIP', extensions: ['zip'] }],
    });
    if (!selected) {
      return { ok: false, cancelled: true };
    }
    outputPath = selected;
  } catch {
    // Fall back to backend-chosen default path when the native save dialog is unavailable.
  }

  try {
    toast.info(t('diagnostic.generating'));
    const result = await diagnosticExportBundle({
      outputPath,
      includeConfig,
      errorContext,
    });
    const sizeMb = (result.size / (1024 * 1024)).toFixed(1);
    toast.success(t('diagnostic.exportSuccess'), {
      description: `${result.path} (${sizeMb} MB, ${result.fileCount} files)`,
      duration: 8000,
      action: {
        label: t('diagnostic.openFolder'),
        onClick: async () => {
          try {
            const { revealItemInDir } = await import('@tauri-apps/plugin-opener');
            await revealItemInDir(result.path);
          } catch {
            // Ignore folder-reveal failures after a successful export.
          }
        },
      },
    });
    return { ok: true, data: result };
  } catch (error) {
    console.error('Failed to export diagnostics:', error);
    toast.error(t(failureToastKey));
    return { ok: false, error: toErrorMessage(error) };
  }
}
