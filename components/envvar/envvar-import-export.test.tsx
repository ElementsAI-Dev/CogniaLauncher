import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EnvVarImportExport } from './envvar-import-export';
import { toast } from 'sonner';
import type { EnvVarImportResult } from '@/types/tauri';

jest.mock('sonner', () => ({
  toast: {
    success: jest.fn(),
    warning: jest.fn(),
    error: jest.fn(),
  },
}));

const mockedToast = jest.mocked(toast);

const mockClipboard = {
  writeText: jest.fn().mockResolvedValue(undefined),
};

Object.defineProperty(navigator, 'clipboard', {
  value: mockClipboard,
  writable: true,
});

const mockT = (key: string) => {
  const translations: Record<string, string> = {
    'envvar.importExport.import': 'Import',
    'envvar.importExport.export': 'Export',
    'envvar.importExport.importSuccess': 'Imported successfully',
    'envvar.importExport.importPartial': 'Partially imported',
    'envvar.importExport.pasteContent': 'Paste content',
    'envvar.importExport.formatDotenv': '.env',
    'envvar.importExport.formatShell': 'Shell',
    'envvar.importExport.formatFish': 'Fish',
    'envvar.importExport.formatPowerShell': 'PowerShell',
    'envvar.importExport.formatNushell': 'Nushell',
    'envvar.description': 'Manage environment variables',
    'envvar.table.scope': 'Scope',
    'envvar.table.copied': 'Copied',
    'envvar.scopes.process': 'Process',
    'envvar.scopes.user': 'User',
    'envvar.scopes.system': 'System',
    'common.loading': 'Loading',
  };
  return translations[key] || key;
};

describe('EnvVarImportExport', () => {
  const defaultProps = {
    open: true,
    onOpenChange: jest.fn(),
    onImport: jest.fn().mockResolvedValue({ imported: 3, skipped: 0, errors: [] } as EnvVarImportResult),
    onExport: jest.fn().mockResolvedValue('KEY=VALUE\nFOO=BAR'),
    t: mockT,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders import and export tabs', () => {
    render(<EnvVarImportExport {...defaultProps} />);
    expect(screen.getAllByText('Import').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Export').length).toBeGreaterThanOrEqual(1);
  });

  it('renders dialog title', () => {
    render(<EnvVarImportExport {...defaultProps} />);
    expect(screen.getByText(/Import.*\/.*Export/)).toBeInTheDocument();
  });

  it('import button disabled when content is empty', () => {
    render(<EnvVarImportExport {...defaultProps} />);
    // The Import button in footer should be disabled when textarea is empty
    const importButtons = screen.getAllByRole('button').filter(
      (btn) => btn.textContent === 'Import' && !btn.closest('[role="tablist"]'),
    );
    if (importButtons.length > 0) {
      expect(importButtons[0]).toBeDisabled();
    }
  });

  it('calls onImport with content and scope', async () => {
    const onImport = jest.fn().mockResolvedValue({ imported: 2, skipped: 0, errors: [] });
    const onOpenChange = jest.fn();
    render(<EnvVarImportExport {...defaultProps} onImport={onImport} onOpenChange={onOpenChange} />);

    const textarea = screen.getByRole('textbox');
    await userEvent.type(textarea, 'MY_VAR=hello');

    // Click the non-tab Import button
    const importButtons = screen.getAllByRole('button').filter(
      (btn) => btn.textContent === 'Import' && !btn.closest('[role="tablist"]'),
    );
    await userEvent.click(importButtons[0]);

    await waitFor(() => {
      expect(onImport).toHaveBeenCalledWith('MY_VAR=hello', 'process');
    });
  });

  it('shows success toast on full import', async () => {
    const onImport = jest.fn().mockResolvedValue({ imported: 3, skipped: 0, errors: [] });
    render(<EnvVarImportExport {...defaultProps} onImport={onImport} />);

    const textarea = screen.getByRole('textbox');
    await userEvent.type(textarea, 'A=1');

    const importButtons = screen.getAllByRole('button').filter(
      (btn) => btn.textContent === 'Import' && !btn.closest('[role="tablist"]'),
    );
    await userEvent.click(importButtons[0]);

    await waitFor(() => {
      expect(mockedToast.success).toHaveBeenCalled();
    });
  });

  it('shows warning toast on partial import', async () => {
    const onImport = jest.fn().mockResolvedValue({
      imported: 1,
      skipped: 2,
      errors: ['Invalid line'],
    });
    render(<EnvVarImportExport {...defaultProps} onImport={onImport} />);

    const textarea = screen.getByRole('textbox');
    await userEvent.type(textarea, 'A=1');

    const importButtons = screen.getAllByRole('button').filter(
      (btn) => btn.textContent === 'Import' && !btn.closest('[role="tablist"]'),
    );
    await userEvent.click(importButtons[0]);

    await waitFor(() => {
      expect(mockedToast.warning).toHaveBeenCalled();
    });
  });

  it('switches to export tab and calls onExport', async () => {
    const onExport = jest.fn().mockResolvedValue('EXPORTED=true');
    render(<EnvVarImportExport {...defaultProps} onExport={onExport} />);

    // Click Export tab
    const exportTab = screen.getAllByRole('tab').find((tab) => tab.textContent?.includes('Export'));
    if (exportTab) await userEvent.click(exportTab);

    // Click the Export action button
    const exportButtons = screen.getAllByRole('button').filter(
      (btn) => btn.textContent?.includes('Export') && !btn.closest('[role="tablist"]'),
    );
    if (exportButtons.length > 0) {
      await userEvent.click(exportButtons[0]);
    }

    await waitFor(() => {
      expect(onExport).toHaveBeenCalledWith('process', 'dotenv');
    });
  });

  it('shows export content after export', async () => {
    const onExport = jest.fn().mockResolvedValue('KEY=VALUE\nFOO=BAR');
    render(<EnvVarImportExport {...defaultProps} onExport={onExport} />);

    // Switch to export tab
    const exportTab = screen.getAllByRole('tab').find((tab) => tab.textContent?.includes('Export'));
    if (exportTab) await userEvent.click(exportTab);

    const exportButtons = screen.getAllByRole('button').filter(
      (btn) => btn.textContent?.includes('Export') && !btn.closest('[role="tablist"]'),
    );
    if (exportButtons.length > 0) {
      await userEvent.click(exportButtons[0]);
    }

    await waitFor(() => {
      // Readonly textarea shows export content
      const textareas = document.querySelectorAll('textarea');
      const exportTextarea = Array.from(textareas).find((ta) => ta.readOnly);
      expect(exportTextarea).toBeTruthy();
      expect(exportTextarea?.value).toBe('KEY=VALUE\nFOO=BAR');
    });
  });

  it('copies export content to clipboard', async () => {
    const onExport = jest.fn().mockResolvedValue('EXPORTED=true');
    render(<EnvVarImportExport {...defaultProps} onExport={onExport} />);

    // Switch to export tab
    const exportTab = screen.getAllByRole('tab').find((tab) => tab.textContent?.includes('Export'));
    if (exportTab) await userEvent.click(exportTab);

    // Trigger export
    const exportButtons = screen.getAllByRole('button').filter(
      (btn) => btn.textContent?.includes('Export') && !btn.closest('[role="tablist"]'),
    );
    if (exportButtons.length > 0) await userEvent.click(exportButtons[0]);

    // Wait for content to appear, then click Copy
    await waitFor(() => {
      const textareas = document.querySelectorAll('textarea');
      expect(Array.from(textareas).find((ta) => ta.readOnly)).toBeTruthy();
    });

    const copyBtn = screen.getAllByRole('button').find(
      (btn) => btn.textContent?.includes('Copy'),
    );
    expect(copyBtn).toBeTruthy();
    await userEvent.click(copyBtn!);
    expect(mockClipboard.writeText).toHaveBeenCalledWith('EXPORTED=true');
  });

  it('downloads export content as file', async () => {
    const onExport = jest.fn().mockResolvedValue('EXPORTED=true');
    const createObjectURL = jest.fn().mockReturnValue('blob:test');
    const revokeObjectURL = jest.fn();
    Object.defineProperty(URL, 'createObjectURL', { value: createObjectURL, writable: true });
    Object.defineProperty(URL, 'revokeObjectURL', { value: revokeObjectURL, writable: true });

    render(<EnvVarImportExport {...defaultProps} onExport={onExport} />);

    const exportTab = screen.getAllByRole('tab').find((tab) => tab.textContent?.includes('Export'));
    if (exportTab) await userEvent.click(exportTab);

    const exportButtons = screen.getAllByRole('button').filter(
      (btn) => btn.textContent?.includes('Export') && !btn.closest('[role="tablist"]'),
    );
    if (exportButtons.length > 0) await userEvent.click(exportButtons[0]);

    await waitFor(() => {
      const textareas = document.querySelectorAll('textarea');
      expect(Array.from(textareas).find((ta) => ta.readOnly)).toBeTruthy();
    });

    const downloadBtn = screen.getAllByRole('button').find(
      (btn) => btn.textContent?.includes('Download'),
    );
    expect(downloadBtn).toBeTruthy();
    await userEvent.click(downloadBtn!);
    expect(createObjectURL).toHaveBeenCalled();
    expect(revokeObjectURL).toHaveBeenCalled();
  });

  it('reads uploaded file content into textarea', async () => {
    render(<EnvVarImportExport {...defaultProps} />);

    const fileContent = 'UPLOADED_KEY=uploaded_value';
    const file = new File([fileContent], 'test.env', { type: 'text/plain' });

    // Find the hidden file input
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    expect(fileInput).toBeTruthy();

    await userEvent.upload(fileInput, file);

    // The textarea should now contain the uploaded file content
    await waitFor(() => {
      const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;
      expect(textarea.value).toBe(fileContent);
    });
  });

  it('does not import when content is only whitespace', async () => {
    const onImport = jest.fn();
    render(<EnvVarImportExport {...defaultProps} onImport={onImport} />);

    const textarea = screen.getByRole('textbox');
    await userEvent.type(textarea, '   ');

    const importButtons = screen.getAllByRole('button').filter(
      (btn) => btn.textContent === 'Import' && !btn.closest('[role="tablist"]'),
    );
    // Button should be disabled for whitespace-only
    if (importButtons.length > 0) {
      expect(importButtons[0]).toBeDisabled();
    }
  });
});
