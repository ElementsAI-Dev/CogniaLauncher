import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AddEnvironmentDialog } from './add-environment-dialog';
import { useEnvironmentStore } from '@/lib/stores/environment';
import { useEnvironments } from '@/hooks/use-environments';

jest.mock('@/lib/stores/environment', () => ({
  useEnvironmentStore: jest.fn(),
}));

jest.mock('@/hooks/use-environments', () => ({
  useEnvironments: jest.fn(),
}));

jest.mock('@/components/providers/locale-provider', () => ({
  useLocale: () => ({
    t: (key: string) => {
      const translations: Record<string, string> = {
        'environments.addDialog.title': 'Add Environment',
        'environments.addDialog.description': 'Select a language and version manager',
        'environments.addDialog.selectLanguage': 'Select Language',
        'environments.addDialog.versionManager': 'Version Manager',
        'environments.addDialog.versionManagerDesc': 'Choose a version manager',
        'environments.addDialog.selectVersion': 'Select Version',
        'environments.addDialog.selectVersionDesc': 'Choose the version to install',
        'environments.addDialog.latestLts': 'Latest LTS',
        'environments.addDialog.latestStable': 'Latest Stable',
        'environments.addDialog.specific': 'Specific',
        'environments.addDialog.options': 'Advanced Options',
        'environments.addDialog.autoSwitch': 'Auto Switch',
        'environments.addDialog.autoSwitchDesc': 'Automatically switch versions',
        'environments.addDialog.setAsDefault': 'Set as Default',
        'environments.addDialog.setAsDefaultDesc': 'Set as default version',
        'environments.addDialog.cancel': 'Cancel',
        'environments.addDialog.addEnvironment': 'Add Environment',
        'environments.versionPlaceholder': 'e.g., 18.0.0',
      };
      return translations[key] || key;
    },
  }),
}));

const mockUseEnvironmentStore = useEnvironmentStore as unknown as jest.Mock;
const mockUseEnvironments = useEnvironments as unknown as jest.Mock;

describe('AddEnvironmentDialog', () => {
  const mockCloseAddDialog = jest.fn();
  const mockFetchProviders = jest.fn();
  const mockOnAdd = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    mockUseEnvironmentStore.mockReturnValue({
      addDialogOpen: true,
      closeAddDialog: mockCloseAddDialog,
      availableProviders: [],
    });
    mockUseEnvironments.mockReturnValue({
      fetchProviders: mockFetchProviders,
    });
  });

  it('renders dialog when open', () => {
    render(<AddEnvironmentDialog onAdd={mockOnAdd} />);
    // Dialog title and button both have 'Add Environment' text
    expect(screen.getAllByText('Add Environment').length).toBeGreaterThan(0);
    expect(screen.getByText('Select Language')).toBeInTheDocument();
  });

  it('does not render when dialog is closed', () => {
    mockUseEnvironmentStore.mockReturnValue({
      addDialogOpen: false,
      closeAddDialog: mockCloseAddDialog,
      availableProviders: [],
    });
    render(<AddEnvironmentDialog onAdd={mockOnAdd} />);
    expect(screen.queryByText('Select Language')).not.toBeInTheDocument();
  });

  it('renders all language options', () => {
    render(<AddEnvironmentDialog onAdd={mockOnAdd} />);
    expect(screen.getByText('Node.js')).toBeInTheDocument();
    expect(screen.getByText('Python')).toBeInTheDocument();
    expect(screen.getByText('Go')).toBeInTheDocument();
    expect(screen.getByText('Rust')).toBeInTheDocument();
    expect(screen.getByText('Ruby')).toBeInTheDocument();
    expect(screen.getByText('Java')).toBeInTheDocument();
    expect(screen.getByText('PHP')).toBeInTheDocument();
    expect(screen.getByText('.NET')).toBeInTheDocument();
  });

  it('selects language when clicked', async () => {
    render(<AddEnvironmentDialog onAdd={mockOnAdd} />);
    const nodeOption = screen.getByText('Node.js');
    fireEvent.click(nodeOption);
    
    await waitFor(() => {
      expect(screen.getByText('Version Manager')).toBeInTheDocument();
    });
  });

  it('shows version options after selecting language and provider', async () => {
    render(<AddEnvironmentDialog onAdd={mockOnAdd} />);
    const nodeOption = screen.getByText('Node.js');
    fireEvent.click(nodeOption);
    
    await waitFor(() => {
      expect(screen.getByText('Select Version')).toBeInTheDocument();
    });
  });

  it('shows version type buttons', async () => {
    render(<AddEnvironmentDialog onAdd={mockOnAdd} />);
    const nodeOption = screen.getByText('Node.js');
    fireEvent.click(nodeOption);
    
    await waitFor(() => {
      expect(screen.getByText('Latest LTS')).toBeInTheDocument();
      expect(screen.getByText('Latest Stable')).toBeInTheDocument();
      expect(screen.getByText('Specific')).toBeInTheDocument();
    });
  });

  it('shows specific version input when specific is selected', async () => {
    render(<AddEnvironmentDialog onAdd={mockOnAdd} />);
    const user = userEvent.setup();
    
    const nodeOption = screen.getByText('Node.js');
    await user.click(nodeOption);
    
    const specificButton = screen.getByText('Specific');
    await user.click(specificButton);
    
    expect(screen.getByPlaceholderText('e.g., 18.0.0')).toBeInTheDocument();
  });

  it('calls onAdd with correct parameters when submitted', async () => {
    mockOnAdd.mockResolvedValue(undefined);
    render(<AddEnvironmentDialog onAdd={mockOnAdd} />);
    const user = userEvent.setup();
    
    // Select Node.js
    const nodeOption = screen.getByText('Node.js');
    await user.click(nodeOption);
    
    // Submit with LTS version (default) - use getByRole to find button specifically
    const addButton = screen.getByRole('button', { name: /add environment/i });
    await user.click(addButton);
    
    await waitFor(() => {
      expect(mockOnAdd).toHaveBeenCalledWith('node', 'fnm', 'lts', {
        autoSwitch: true,
        setAsDefault: true,
      });
    });
  });

  it('closes dialog on cancel', async () => {
    render(<AddEnvironmentDialog onAdd={mockOnAdd} />);
    const user = userEvent.setup();
    
    const cancelButton = screen.getByText('Cancel');
    await user.click(cancelButton);
    
    expect(mockCloseAddDialog).toHaveBeenCalled();
  });

  it('disables add button when no language is selected', () => {
    render(<AddEnvironmentDialog onAdd={mockOnAdd} />);
    // Find the submit button specifically (not the dialog title)
    const addButtons = screen.getAllByText('Add Environment');
    // The button should be the last one or find by role
    const submitButton = addButtons.find(el => el.tagName === 'BUTTON') || addButtons[addButtons.length - 1];
    expect(submitButton).toBeDisabled();
  });

  it('fetches providers when dialog opens with empty providers', () => {
    render(<AddEnvironmentDialog onAdd={mockOnAdd} />);
    expect(mockFetchProviders).toHaveBeenCalled();
  });

  it('does not fetch providers when already available', () => {
    mockUseEnvironmentStore.mockReturnValue({
      addDialogOpen: true,
      closeAddDialog: mockCloseAddDialog,
      availableProviders: [{ id: 'fnm', display_name: 'fnm', description: 'Fast Node Manager', env_type: 'node' }],
    });
    render(<AddEnvironmentDialog onAdd={mockOnAdd} />);
    expect(mockFetchProviders).not.toHaveBeenCalled();
  });

  it('supports keyboard navigation for language selection', async () => {
    render(<AddEnvironmentDialog onAdd={mockOnAdd} />);
    const nodeOption = screen.getByText('Node.js').closest('button');
    
    nodeOption?.focus();
    fireEvent.keyDown(nodeOption!, { key: 'Enter' });
    
    await waitFor(() => {
      expect(screen.getByText('Version Manager')).toBeInTheDocument();
    });
  });

  it('shows advanced options after language selection', async () => {
    render(<AddEnvironmentDialog onAdd={mockOnAdd} />);
    const user = userEvent.setup();
    
    const nodeOption = screen.getByText('Node.js');
    await user.click(nodeOption);
    
    await waitFor(() => {
      expect(screen.getByText('Advanced Options')).toBeInTheDocument();
      expect(screen.getByText('Auto Switch')).toBeInTheDocument();
      expect(screen.getByText('Set as Default')).toBeInTheDocument();
    });
  });
});
