import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { GitStashList } from './git-stash-list';

jest.mock('@/components/providers/locale-provider', () => ({
  useLocale: () => ({ t: (key: string) => key }),
}));

jest.mock('sonner', () => ({
  toast: { success: jest.fn(), error: jest.fn() },
}));

describe('GitStashList', () => {
  const stashes = [
    { id: 'stash@{0}', message: 'WIP on main: add feature', date: '2025-01-15T10:30:00+08:00' },
    { id: 'stash@{1}', message: 'temp save', date: '2025-01-14T09:00:00+08:00' },
  ];

  it('renders stash title', () => {
    render(<GitStashList stashes={stashes} />);
    expect(screen.getByText('git.repo.stash')).toBeInTheDocument();
  });

  it('renders stash count badge', () => {
    render(<GitStashList stashes={stashes} />);
    expect(screen.getByText('2')).toBeInTheDocument();
  });

  it('renders stash entries', () => {
    render(<GitStashList stashes={stashes} />);
    expect(screen.getByText('stash@{0}')).toBeInTheDocument();
    expect(screen.getByText('WIP on main: add feature')).toBeInTheDocument();
    expect(screen.getByText('stash@{1}')).toBeInTheDocument();
    expect(screen.getByText('temp save')).toBeInTheDocument();
  });

  it('renders dates', () => {
    render(<GitStashList stashes={stashes} />);
    expect(screen.getByText('2025-01-15')).toBeInTheDocument();
    expect(screen.getByText('2025-01-14')).toBeInTheDocument();
  });

  it('shows empty state when no stashes', () => {
    render(<GitStashList stashes={[]} />);
    expect(screen.getByText('git.repo.noStashes')).toBeInTheDocument();
  });

  it('shows zero count badge when empty', () => {
    render(<GitStashList stashes={[]} />);
    expect(screen.getByText('0')).toBeInTheDocument();
  });

  it('renders save stash form when onSave provided', () => {
    const onSave = jest.fn().mockResolvedValue('saved');
    render(<GitStashList stashes={stashes} onSave={onSave} />);
    expect(screen.getByPlaceholderText('git.stashAction.savePlaceholder')).toBeInTheDocument();
    expect(screen.getByText('git.stashAction.save')).toBeInTheDocument();
    expect(screen.getByText('git.stashAction.includeUntracked')).toBeInTheDocument();
  });

  it('does not render save form when onSave not provided', () => {
    render(<GitStashList stashes={stashes} />);
    expect(screen.queryByPlaceholderText('git.stashAction.savePlaceholder')).not.toBeInTheDocument();
  });

  it('calls onSave with message', async () => {
    const onSave = jest.fn().mockResolvedValue('saved');
    render(<GitStashList stashes={stashes} onSave={onSave} />);
    fireEvent.change(screen.getByPlaceholderText('git.stashAction.savePlaceholder'), { target: { value: 'my stash' } });
    fireEvent.click(screen.getByText('git.stashAction.save'));
    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith('my stash', false);
    });
  });

  it('calls onSave with includeUntracked when checked', async () => {
    const onSave = jest.fn().mockResolvedValue('saved');
    render(<GitStashList stashes={stashes} onSave={onSave} />);
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByText('git.stashAction.save'));
    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith(undefined, true);
    });
  });

  it('clears message input after successful save', async () => {
    const onSave = jest.fn().mockResolvedValue('saved');
    render(<GitStashList stashes={stashes} onSave={onSave} />);
    const input = screen.getByPlaceholderText('git.stashAction.savePlaceholder');
    fireEvent.change(input, { target: { value: 'test' } });
    fireEvent.click(screen.getByText('git.stashAction.save'));
    await waitFor(() => {
      expect(input).toHaveValue('');
    });
  });
});
