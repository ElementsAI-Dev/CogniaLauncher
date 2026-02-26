import { render, screen } from '@testing-library/react';
import { GitTagList } from './git-tag-list';

jest.mock('@/components/providers/locale-provider', () => ({
  useLocale: () => ({ t: (key: string) => key }),
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
});
