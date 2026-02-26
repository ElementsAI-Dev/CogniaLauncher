import { render, screen } from '@testing-library/react';
import { GitEmptyState } from './git-empty-state';

jest.mock('@/components/providers/locale-provider', () => ({
  useLocale: () => ({ t: (key: string) => key }),
}));

describe('GitEmptyState', () => {
  it('renders empty state message', () => {
    render(<GitEmptyState />);
    expect(screen.getByText('git.emptyState')).toBeInTheDocument();
  });

  it('renders description', () => {
    render(<GitEmptyState />);
    expect(screen.getByText('git.emptyStateDesc')).toBeInTheDocument();
  });
});
