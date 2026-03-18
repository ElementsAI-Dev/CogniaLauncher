import { exportDesktopDiagnosticBundle } from './diagnostic-export';
import { toast } from 'sonner';

const mockDiagnosticGetDefaultExportPath = jest.fn();
const mockDiagnosticExportBundle = jest.fn();
const mockRevealItemInDir = jest.fn();
const mockSave = jest.fn();
const mockIsTauri = jest.fn(() => true);

jest.mock('@/lib/tauri', () => ({
  isTauri: () => mockIsTauri(),
  diagnosticGetDefaultExportPath: (...args: unknown[]) =>
    mockDiagnosticGetDefaultExportPath(...args),
  diagnosticExportBundle: (...args: unknown[]) =>
    mockDiagnosticExportBundle(...args),
}));

jest.mock('@tauri-apps/plugin-dialog', () => ({
  save: (...args: unknown[]) => mockSave(...args),
}));

jest.mock('@tauri-apps/plugin-opener', () => ({
  revealItemInDir: (...args: unknown[]) => mockRevealItemInDir(...args),
}));

jest.mock('sonner', () => ({
  toast: {
    info: jest.fn(),
    success: jest.fn(),
    error: jest.fn(),
  },
}));

describe('exportDesktopDiagnosticBundle', () => {
  const t = (key: string) => key;

  beforeEach(() => {
    jest.clearAllMocks();
    mockIsTauri.mockReturnValue(true);
    mockDiagnosticGetDefaultExportPath.mockResolvedValue('D:/Exports');
    mockSave.mockResolvedValue('D:/Exports/cognia-diagnostic.zip');
    mockDiagnosticExportBundle.mockResolvedValue({
      path: 'D:/Exports/cognia-diagnostic.zip',
      size: 1024,
      fileCount: 4,
    });
  });

  it('exports a desktop diagnostic bundle through the shared flow', async () => {
    const result = await exportDesktopDiagnosticBundle({
      t,
      failureToastKey: 'about.diagnosticsFailed',
      errorContext: {
        message: 'Logs workspace diagnostic export',
        extra: { logsContext: { workspaceSection: 'files' } },
      },
    });

    expect(mockDiagnosticGetDefaultExportPath).toHaveBeenCalled();
    expect(mockSave).toHaveBeenCalled();
    expect(mockDiagnosticExportBundle).toHaveBeenCalledWith(
      expect.objectContaining({
        outputPath: 'D:/Exports/cognia-diagnostic.zip',
        includeConfig: true,
        errorContext: expect.objectContaining({
          message: 'Logs workspace diagnostic export',
        }),
      }),
    );
    expect(toast.info).toHaveBeenCalledWith('diagnostic.generating');
    expect(toast.success).toHaveBeenCalledWith(
      'diagnostic.exportSuccess',
      expect.objectContaining({
        action: expect.objectContaining({
          label: 'diagnostic.openFolder',
        }),
      }),
    );
    expect(result).toEqual({
      ok: true,
      data: {
        path: 'D:/Exports/cognia-diagnostic.zip',
        size: 1024,
        fileCount: 4,
      },
    });
  });

  it('returns a cancelled result when the user dismisses the save dialog', async () => {
    mockSave.mockResolvedValue(null);

    const result = await exportDesktopDiagnosticBundle({
      t,
      failureToastKey: 'about.diagnosticsFailed',
    });

    expect(mockDiagnosticExportBundle).not.toHaveBeenCalled();
    expect(result).toEqual({ ok: false, cancelled: true });
  });

  it('falls back to backend default path when the save dialog fails', async () => {
    mockSave.mockRejectedValue(new Error('dialog unavailable'));

    const result = await exportDesktopDiagnosticBundle({
      t,
      failureToastKey: 'about.diagnosticsFailed',
    });

    expect(mockDiagnosticExportBundle).toHaveBeenCalledWith(
      expect.objectContaining({
        outputPath: undefined,
      }),
    );
    expect(result).toEqual({
      ok: true,
      data: expect.objectContaining({
        path: 'D:/Exports/cognia-diagnostic.zip',
      }),
    });
  });

  it('returns a structured error when backend export fails', async () => {
    mockDiagnosticExportBundle.mockRejectedValue(new Error('zip failed'));

    const result = await exportDesktopDiagnosticBundle({
      t,
      failureToastKey: 'logs.diagnosticBundleError',
    });

    expect(toast.error).toHaveBeenCalledWith('logs.diagnosticBundleError');
    expect(result).toEqual({
      ok: false,
      error: 'zip failed',
    });
  });
});
