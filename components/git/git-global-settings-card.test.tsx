import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { GitGlobalSettingsCard } from './git-global-settings-card';

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

describe('GitGlobalSettingsCard', () => {
  const mockGetConfigValue = jest.fn().mockResolvedValue(null);
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
    mockGetConfigValue.mockImplementation((key: string) => {
      const values: Record<string, string | null> = {
        'user.name': 'John Doe',
        'user.email': 'john@example.com',
        'core.autocrlf': 'true',
        'commit.gpgsign': 'true',
      };
      return Promise.resolve(values[key] ?? null);
    });
  });

  it('loads settings on mount', async () => {
    await act(async () => {
      render(
        <GitGlobalSettingsCard
          onGetConfigValue={mockGetConfigValue}
          onSetConfig={mockSetConfig}
        />,
      );
    });

    await waitFor(() => {
      expect(mockGetConfigValue).toHaveBeenCalledWith('user.name');
      expect(mockGetConfigValue).toHaveBeenCalledWith('user.email');
      expect(mockGetConfigValue).toHaveBeenCalledWith('core.autocrlf');
    });
  });

  it('renders template selector and preview actions', async () => {
    await act(async () => {
      render(
        <GitGlobalSettingsCard
          onGetConfigValue={mockGetConfigValue}
          onSetConfig={mockSetConfig}
        />,
      );
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
      render(
        <GitGlobalSettingsCard
          onGetConfigValue={mockGetConfigValue}
          onSetConfig={mockSetConfig}
          onSetConfigIfUnset={mockSetConfigIfUnset}
          onApplyConfigPlan={mockApplyConfigPlan}
        />,
      );
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
      render(
        <GitGlobalSettingsCard
          onGetConfigValue={mockGetConfigValue}
          onSetConfig={mockSetConfig}
        />,
      );
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
      render(
        <GitGlobalSettingsCard
          onGetConfigValue={mockGetConfigValue}
          onSetConfig={mockSetConfig}
          onApplyConfigPlan={mockApplyConfigPlan}
        />,
      );
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
