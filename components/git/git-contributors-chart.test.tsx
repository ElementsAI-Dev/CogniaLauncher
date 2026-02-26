import { render, screen } from '@testing-library/react';
import { GitContributorsChart } from './git-contributors-chart';

jest.mock('@/components/providers/locale-provider', () => ({
  useLocale: () => ({ t: (key: string) => key }),
}));

describe('GitContributorsChart', () => {
  const contributors = [
    { name: 'John Doe', email: 'john@example.com', commitCount: 150 },
    { name: 'Jane Smith', email: 'jane@example.com', commitCount: 42 },
    { name: 'Bot', email: 'bot@example.com', commitCount: 5 },
  ];

  it('renders contributors title', () => {
    render(<GitContributorsChart contributors={contributors} />);
    expect(screen.getByText('git.history.contributors')).toBeInTheDocument();
  });

  it('renders contributor count badge', () => {
    render(<GitContributorsChart contributors={contributors} />);
    expect(screen.getByText('3')).toBeInTheDocument();
  });

  it('renders contributor names', () => {
    render(<GitContributorsChart contributors={contributors} />);
    expect(screen.getByText('John Doe')).toBeInTheDocument();
    expect(screen.getByText('Jane Smith')).toBeInTheDocument();
    expect(screen.getByText('Bot')).toBeInTheDocument();
  });

  it('renders commit counts with percentages', () => {
    render(<GitContributorsChart contributors={contributors} />);
    expect(screen.getByText(/150 git\.history\.commits/)).toBeInTheDocument();
    expect(screen.getByText(/42 git\.history\.commits/)).toBeInTheDocument();
  });

  it('shows empty state when no contributors', () => {
    render(<GitContributorsChart contributors={[]} />);
    expect(screen.getByText('git.history.noContributors')).toBeInTheDocument();
  });

  it('renders progress bars', () => {
    const { container } = render(<GitContributorsChart contributors={contributors} />);
    const bars = container.querySelectorAll('.bg-primary');
    expect(bars.length).toBe(3);
  });
});
