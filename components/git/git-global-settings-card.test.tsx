import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { GitGlobalSettingsCard } from './git-global-settings-card';
import type { GitConfigBatchReadResult, GitConfigReadFailure } from '@/types/git';

const mockToastSuccess = jest.fn();
const mockToastError = jest.fn();

jest.mock('@/components/providers/locale-provider', () => ({
  useLocale: () => ({ t: (key: string, params?: Record<string, string>) => {
    if (!params) return key;
    return Object.entries(params).reduce((acc, [k, v]) => acc.replace(`{${k}}`, v), key);
  } }),
}));

jest.mock('sonner', () => ({
  toast: {
    success: (...args: unknown[]) => mockToastSuccess(...args),
    error: (...args: unknown[]) => mockToastError(...args),
  },
}));

function buildBatchResult(
  keys: string[],
  overrides: Record<string, string | null> = {},
  failures: GitConfigReadFailure[] = [],
): GitConfigBatchReadResult {
  const values: Record<string, string | null> = {};
  for (const key of keys) {
    values[key] = Object.prototype.hasOwnProperty.call(overrides, key) ? overrides[key] : null;
  }
  return { values, failures };
}

describe('GitGlobalSettingsCard', () => {
  const mockGetConfigSnapshot = jest.fn();
  const mockGetConfigValuesBatch = jest.fn();
  const mockGetConfigFilePath = jest.fn().mockResolvedValue('/home/user/.gitconfig');
  const mockOpenConfigLocation = jest.fn().mockResolvedValue(undefined);
  const mockSetConfig = jest.fn().mockResolvedValue(undefined);
  const mockSetConfigIfUnset = jest.fn().mockResolvedValue(false);
  const mockApplyConfigPlan = jest.fn().mockResolvedValue({
    total: 4,
    succeeded: 4,
    failed: 0,
    skipped: 0,
    results: [],
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockGetConfigSnapshot.mockResolvedValue({
      values: {
        'user.name': 'John Doe',
        'user.email': 'john@example.com',
        'core.autocrlf': 'true',
        'commit.gpgsign': 'true',
      },
      failures: [],
    });
    mockGetConfigValuesBatch.mockImplementation((keys: string[]) => Promise.resolve(buildBatchResult(keys)));
  });

  function renderCard() {
    return render(
      <GitGlobalSettingsCard
        onGetConfigSnapshot={mockGetConfigSnapshot}
        onGetConfigValuesBatch={mockGetConfigValuesBatch}
        onGetConfigFilePath={mockGetConfigFilePath}
        onOpenConfigLocation={mockOpenConfigLocation}
        onSetConfig={mockSetConfig}
        onSetConfigIfUnset={mockSetConfigIfUnset}
        onApplyConfigPlan={mockApplyConfigPlan}
      />,
    );
  }

  it('loads settings from snapshot on mount', async () => {
    await act(async () => {
      renderCard();
    });

    await waitFor(() => {
      expect(mockGetConfigSnapshot).toHaveBeenCalledTimes(1);
      expect(mockGetConfigValuesBatch).not.toHaveBeenCalled();
      expect(screen.getByDisplayValue('John Doe')).toBeInTheDocument();
    });
  });

  it('refresh button triggers a new settings load', async () => {
    await act(async () => {
      renderCard();
    });

    await waitFor(() => {
      expect(mockGetConfigSnapshot).toHaveBeenCalledTimes(1);
    });

    fireEvent.click(screen.getByRole('button', { name: 'git.refresh' }));

    await waitFor(() => {
      expect(mockGetConfigSnapshot).toHaveBeenCalledTimes(2);
    });
  });

  it('keeps interaction available while fallback reads are still pending', async () => {
    let pendingResolve: ((value: GitConfigBatchReadResult) => void) | null = null;
    let pendingKeys: string[] = [];
    mockGetConfigSnapshot.mockResolvedValueOnce({
      values: {
        'user.name': 'John Doe',
        'user.email': 'john@example.com',
      },
      failures: [{
        key: null,
        category: 'timeout',
        message: 'snapshot timed out',
        recoverable: true,
        nextSteps: ['Retry'],
      }],
    });
    mockGetConfigValuesBatch.mockImplementation((keys: string[]) => {
      pendingKeys = keys;
      return new Promise((resolve) => {
        pendingResolve = resolve;
      });
    });

    await act(async () => {
      renderCard();
    });

    await waitFor(() => {
      expect(screen.getByDisplayValue('John Doe')).toBeInTheDocument();
      expect(screen.getByText('Load state: partial')).toBeInTheDocument();
    });

    await act(async () => {
      pendingResolve?.(buildBatchResult(pendingKeys));
    });

    await waitFor(() => {
      expect(screen.getByText('Load state: partial')).toBeInTheDocument();
    });
  });

  it('renders partial failure diagnostics and keeps editable fields visible', async () => {
    mockGetConfigSnapshot.mockResolvedValueOnce({
      values: {
        'user.name': 'John Doe',
        'user.email': 'john@example.com',
      },
      failures: [{
        key: 'core.editor',
        category: 'timeout',
        message: 'settings detection timed out',
        recoverable: true,
        nextSteps: ['Retry'],
      }],
    });

    await act(async () => {
      renderCard();
    });

    await waitFor(() => {
      expect(screen.getByText('Load state: partial')).toBeInTheDocument();
      expect(screen.getByText('[timeout] core.editor: settings detection timed out')).toBeInTheDocument();
      expect(screen.getByDisplayValue('John Doe')).toBeInTheDocument();
    });
  });

  it('retries failed keys and clears failure diagnostics when retry succeeds', async () => {
    mockGetConfigSnapshot
      .mockResolvedValueOnce({
        values: {
          'user.name': 'John Doe',
          'user.email': 'john@example.com',
        },
        failures: [{
          key: 'core.editor',
          category: 'timeout',
          message: 'settings detection timed out',
          recoverable: true,
          nextSteps: ['Retry'],
        }],
      })
      .mockResolvedValueOnce({
        values: {
          'user.name': 'John Doe',
          'user.email': 'john@example.com',
        },
        failures: [],
      });

    mockGetConfigValuesBatch
      .mockImplementationOnce((keys: string[]) => Promise.resolve(buildBatchResult(
        keys,
        {},
        [{
          key: 'core.editor',
          category: 'timeout',
          message: 'settings detection timed out',
          recoverable: true,
          nextSteps: ['Retry'],
        }],
      )))
      .mockImplementationOnce((keys: string[]) => Promise.resolve(buildBatchResult(
        keys,
        { 'core.editor': 'code --wait' },
      )));

    await act(async () => {
      renderCard();
    });

    await waitFor(() => {
      expect(screen.getByText('[timeout] core.editor: settings detection timed out')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /Retry failed keys/i }));

    await waitFor(() => {
      expect(screen.queryByText('[timeout] core.editor: settings detection timed out')).not.toBeInTheDocument();
      expect(screen.getByText('Load state: ready')).toBeInTheDocument();
    });
  });

  it('exposes explicit recovery action to open config location', async () => {
    await act(async () => {
      renderCard();
    });

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Open config location' })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Open config location' }));
    await waitFor(() => {
      expect(mockOpenConfigLocation).toHaveBeenCalledTimes(1);
    });
  });

  it('renders template selector and preview actions', async () => {
    await act(async () => {
      renderCard();
    });

    await waitFor(() => {
      expect(screen.getByText('git.settings.templateTitle')).toBeInTheDocument();
      expect(screen.getByText('git.settings.templateApply')).toBeInTheDocument();
      expect(
        screen.getAllByText((content) => content.includes('git.settings.templateAction.add')).length,
      ).toBeGreaterThan(0);
    });
  });

  it('applies selected template keys via onApplyConfigPlan', async () => {
    await act(async () => {
      renderCard();
    });

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'git.settings.templateApply' })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'git.settings.templateApply' }));

    await waitFor(() => {
      expect(mockApplyConfigPlan).toHaveBeenCalledTimes(1);
      const firstArg = mockApplyConfigPlan.mock.calls[0][0] as Array<{ key: string; selected: boolean }>;
      expect(firstArg.some((item) => item.selected)).toBe(true);
      expect(mockToastSuccess).toHaveBeenCalledWith('git.settings.templateApplied');
      expect(screen.getByText('git.settings.templateSummary')).toBeInTheDocument();
    });
  });

  it('shows validation error and blocks save for invalid email', async () => {
    await act(async () => {
      renderCard();
    });

    await waitFor(() => {
      expect(screen.getByDisplayValue('john@example.com')).toBeInTheDocument();
    });

    const emailInput = screen.getByDisplayValue('john@example.com');
    fireEvent.change(emailInput, { target: { value: 'invalid-email' } });
    fireEvent.blur(emailInput);

    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith('git.settings.validation.invalidEmail');
    });
    expect(mockSetConfig).not.toHaveBeenCalledWith('user.email', 'invalid-email');
  });

  it('renders failed-key diagnostics when template apply is partially failed', async () => {
    mockApplyConfigPlan.mockResolvedValueOnce({
      total: 2,
      succeeded: 1,
      failed: 1,
      skipped: 0,
      results: [
        { key: 'pull.rebase', mode: 'set', success: true, applied: true, message: 'Applied' },
        { key: 'pull.ff', mode: 'set', success: false, applied: false, message: 'Permission denied' },
      ],
    });

    await act(async () => {
      renderCard();
    });

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'git.settings.templateApply' })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'git.settings.templateApply' }));

    await waitFor(() => {
      expect(screen.getByText('pull.ff: Permission denied')).toBeInTheDocument();
    });
  });
});
