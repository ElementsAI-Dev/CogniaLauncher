import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EnvVarToolbar } from './envvar-toolbar';

const mockT = (key: string) => {
  const translations: Record<string, string> = {
    'envvar.table.search': 'Search environment variables...',
    'common.all': 'All',
    'envvar.scopes.process': 'Process',
    'envvar.scopes.user': 'User',
    'envvar.scopes.system': 'System',
  };
  return translations[key] || key;
};

describe('EnvVarToolbar', () => {
  const defaultProps = {
    searchQuery: '',
    onSearchChange: jest.fn(),
    scopeFilter: 'all' as const,
    onScopeFilterChange: jest.fn(),
    t: mockT,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders search input with placeholder', () => {
    render(<EnvVarToolbar {...defaultProps} />);
    expect(screen.getByPlaceholderText('Search environment variables...')).toBeInTheDocument();
  });

  it('renders search input with current value', () => {
    render(<EnvVarToolbar {...defaultProps} searchQuery="PATH" />);
    expect(screen.getByDisplayValue('PATH')).toBeInTheDocument();
  });

  it('calls onSearchChange when typing', async () => {
    const onSearchChange = jest.fn();
    render(<EnvVarToolbar {...defaultProps} onSearchChange={onSearchChange} />);
    await userEvent.type(screen.getByPlaceholderText('Search environment variables...'), 'abc');
    expect(onSearchChange).toHaveBeenCalledTimes(3);
  });

  it('renders scope filter with current value', () => {
    render(<EnvVarToolbar {...defaultProps} scopeFilter="process" />);
    expect(screen.getByText('Process')).toBeInTheDocument();
  });
});
