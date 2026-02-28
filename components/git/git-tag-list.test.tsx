import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { GitTagList } from './git-tag-list';

jest.mock('@/components/providers/locale-provider', () => ({
  useLocale: () => ({ t: (key: string) => key }),
}));

jest.mock('sonner', () => ({
  toast: { success: jest.fn(), error: jest.fn() },
}));

describe('GitTagList', () => {
  const tags = [
    { name: 'v1.0.0', shortHash: 'abc1234', date: '2025-01-15 10:30:00 +0800' },
    { name: 'v0.9.0', shortHash: 'def5678', date: '2025-01-01 09:00:00 +0800' },
    { name: 'v0.8.0', shortHash: 'ghi9012', date: null },
  ];

  it('renders tag title', () => {
    render(<GitTagList tags={tags} />);
    expect(screen.getByText('git.repo.tag')).toBeInTheDocument();
  });

  it('renders tag count badge', () => {
    render(<GitTagList tags={tags} />);
    expect(screen.getByText('3')).toBeInTheDocument();
  });

  it('renders tag names', () => {
    render(<GitTagList tags={tags} />);
    expect(screen.getByText('v1.0.0')).toBeInTheDocument();
    expect(screen.getByText('v0.9.0')).toBeInTheDocument();
    expect(screen.getByText('v0.8.0')).toBeInTheDocument();
  });

  it('renders short hashes', () => {
    render(<GitTagList tags={tags} />);
    expect(screen.getByText('abc1234')).toBeInTheDocument();
    expect(screen.getByText('def5678')).toBeInTheDocument();
  });

  it('renders dates when available', () => {
    render(<GitTagList tags={tags} />);
    expect(screen.getByText('2025-01-15')).toBeInTheDocument();
    expect(screen.getByText('2025-01-01')).toBeInTheDocument();
  });

  it('shows empty state when no tags', () => {
    render(<GitTagList tags={[]} />);
    expect(screen.getByText('git.repo.noTags')).toBeInTheDocument();
  });

  it('renders create tag form when onCreateTag provided', () => {
    const onCreateTag = jest.fn().mockResolvedValue('created');
    render(<GitTagList tags={tags} onCreateTag={onCreateTag} />);
    expect(screen.getByPlaceholderText('git.tagAction.namePlaceholder')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('git.tagAction.messagePlaceholder')).toBeInTheDocument();
    expect(screen.getByText('git.tagAction.create')).toBeInTheDocument();
  });

  it('does not render create form when onCreateTag not provided', () => {
    render(<GitTagList tags={tags} />);
    expect(screen.queryByPlaceholderText('git.tagAction.namePlaceholder')).not.toBeInTheDocument();
  });

  it('disables create button when name is empty', () => {
    const onCreateTag = jest.fn().mockResolvedValue('created');
    render(<GitTagList tags={tags} onCreateTag={onCreateTag} />);
    expect(screen.getByText('git.tagAction.create').closest('button')).toBeDisabled();
  });

  it('calls onCreateTag with name and message', async () => {
    const onCreateTag = jest.fn().mockResolvedValue('created');
    render(<GitTagList tags={tags} onCreateTag={onCreateTag} />);
    fireEvent.change(screen.getByPlaceholderText('git.tagAction.namePlaceholder'), { target: { value: 'v2.0.0' } });
    fireEvent.change(screen.getByPlaceholderText('git.tagAction.messagePlaceholder'), { target: { value: 'Release' } });
    fireEvent.click(screen.getByText('git.tagAction.create'));
    await waitFor(() => {
      expect(onCreateTag).toHaveBeenCalledWith('v2.0.0', undefined, 'Release');
    });
  });

  it('clears inputs after successful create', async () => {
    const onCreateTag = jest.fn().mockResolvedValue('created');
    render(<GitTagList tags={tags} onCreateTag={onCreateTag} />);
    const nameInput = screen.getByPlaceholderText('git.tagAction.namePlaceholder');
    const msgInput = screen.getByPlaceholderText('git.tagAction.messagePlaceholder');
    fireEvent.change(nameInput, { target: { value: 'v2.0.0' } });
    fireEvent.change(msgInput, { target: { value: 'Release' } });
    fireEvent.click(screen.getByText('git.tagAction.create'));
    await waitFor(() => {
      expect(nameInput).toHaveValue('');
      expect(msgInput).toHaveValue('');
    });
  });

  it('renders push tags button when onPushTags provided and tags exist', () => {
    const onPushTags = jest.fn().mockResolvedValue('pushed');
    render(<GitTagList tags={tags} onPushTags={onPushTags} />);
    expect(screen.getByText('git.branchAction.pushTags')).toBeInTheDocument();
  });

  it('does not render push tags button when no tags', () => {
    const onPushTags = jest.fn().mockResolvedValue('pushed');
    render(<GitTagList tags={[]} onPushTags={onPushTags} />);
    expect(screen.queryByText('git.branchAction.pushTags')).not.toBeInTheDocument();
  });

  it('calls onPushTags when push button clicked', async () => {
    const onPushTags = jest.fn().mockResolvedValue('pushed');
    render(<GitTagList tags={tags} onPushTags={onPushTags} />);
    fireEvent.click(screen.getByText('git.branchAction.pushTags'));
    await waitFor(() => {
      expect(onPushTags).toHaveBeenCalled();
    });
  });
});
