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
    'envvar.actions.refresh': 'Refresh',
    'envvar.importExport.import': 'Import',
    'envvar.importExport.export': 'Export',
    'envvar.actions.add': 'Add',
  };
  return translations[key] || key;
};

describe('EnvVarToolbar', () => {
  const defaultProps = {
    searchQuery: '',
    onSearchChange: jest.fn(),
    scopeFilter: 'all' as const,
    onScopeFilterChange: jest.fn(),
    onRefresh: jest.fn(),
    onAdd: jest.fn(),
    onImport: jest.fn(),
    onExport: jest.fn(),
    isLoading: false,
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

  it('calls onRefresh when refresh button clicked', async () => {
    const onRefresh = jest.fn();
    render(<EnvVarToolbar {...defaultProps} onRefresh={onRefresh} />);
    await userEvent.click(screen.getByRole('button', { name: /refresh/i }));
    expect(onRefresh).toHaveBeenCalledTimes(1);
  });

  it('calls onAdd when add button clicked', async () => {
    const onAdd = jest.fn();
    render(<EnvVarToolbar {...defaultProps} onAdd={onAdd} />);
    await userEvent.click(screen.getByRole('button', { name: /add/i }));
    expect(onAdd).toHaveBeenCalledTimes(1);
  });

  it('calls onImport when import button clicked', async () => {
    const onImport = jest.fn();
    render(<EnvVarToolbar {...defaultProps} onImport={onImport} />);
    await userEvent.click(screen.getByRole('button', { name: /import/i }));
    expect(onImport).toHaveBeenCalledTimes(1);
  });

  it('calls onExport when export button clicked', async () => {
    const onExport = jest.fn();
    render(<EnvVarToolbar {...defaultProps} onExport={onExport} />);
    await userEvent.click(screen.getByRole('button', { name: /export/i }));
    expect(onExport).toHaveBeenCalledTimes(1);
  });

  it('disables refresh button when isLoading', () => {
    render(<EnvVarToolbar {...defaultProps} isLoading={true} />);
    expect(screen.getByRole('button', { name: /refresh/i })).toBeDisabled();
  });

  it('renders scope filter with current value', () => {
    render(<EnvVarToolbar {...defaultProps} scopeFilter="process" />);
    expect(screen.getByText('Process')).toBeInTheDocument();
  });
});
