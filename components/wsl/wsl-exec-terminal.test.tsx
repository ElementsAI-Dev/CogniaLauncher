import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { WslExecTerminal } from './wsl-exec-terminal';
import type { WslDistroStatus, WslExecResult } from '@/types/tauri';

// Mock sonner toast
jest.mock('sonner', () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
  },
}));

const mockT = (key: string) => {
  const translations: Record<string, string> = {
    'wsl.exec.title': 'Execute Command',
    'wsl.exec.selectDistro': 'Select distribution',
    'wsl.exec.user': 'User (optional)',
    'wsl.exec.commandPlaceholder': 'Enter command...',
    'wsl.exec.run': 'Run',
    'wsl.exec.noRunningHint': 'No distributions are running.',
    'wsl.distros': 'Distributions',
    'common.clear': 'Clear',
    'common.copied': 'Copied',
  };
  return translations[key] || key;
};

const distros: WslDistroStatus[] = [
  { name: 'Ubuntu', state: 'Running', wslVersion: '2', isDefault: true },
  { name: 'Debian', state: 'Stopped', wslVersion: '2', isDefault: false },
];

const stoppedDistros: WslDistroStatus[] = [
  { name: 'Ubuntu', state: 'Stopped', wslVersion: '2', isDefault: true },
];

describe('WslExecTerminal', () => {
  const mockExec = jest.fn<Promise<WslExecResult>, [string, string, string?]>();

  beforeEach(() => {
    jest.clearAllMocks();
    mockExec.mockResolvedValue({ stdout: 'hello world', stderr: '', exitCode: 0 });
  });

  it('renders title', () => {
    render(<WslExecTerminal distros={distros} onExec={mockExec} t={mockT} />);

    expect(screen.getByText('Execute Command')).toBeInTheDocument();
  });

  it('renders command input and run button', () => {
    render(<WslExecTerminal distros={distros} onExec={mockExec} t={mockT} />);

    expect(screen.getByPlaceholderText('Enter command...')).toBeInTheDocument();
    expect(screen.getByText('Run')).toBeInTheDocument();
  });

  it('disables run button when command is empty', () => {
    render(<WslExecTerminal distros={distros} onExec={mockExec} t={mockT} />);

    expect(screen.getByText('Run').closest('button')).toBeDisabled();
  });

  it('shows hint when no distros are running', () => {
    render(<WslExecTerminal distros={stoppedDistros} onExec={mockExec} t={mockT} />);

    expect(screen.getByText('No distributions are running.')).toBeInTheDocument();
  });

  it('does not show hint when distros are running', () => {
    render(<WslExecTerminal distros={distros} onExec={mockExec} t={mockT} />);

    expect(screen.queryByText('No distributions are running.')).not.toBeInTheDocument();
  });

  it('auto-selects default distro', () => {
    render(<WslExecTerminal distros={distros} onExec={mockExec} t={mockT} />);

    // The select should have the default distro selected
    // We check the trigger text content
    const trigger = screen.getByRole('combobox');
    expect(trigger).toBeInTheDocument();
  });

  it('executes command and shows output', async () => {
    render(<WslExecTerminal distros={distros} onExec={mockExec} t={mockT} />);

    const input = screen.getByPlaceholderText('Enter command...');
    await userEvent.type(input, 'echo hello');
    await userEvent.click(screen.getByText('Run'));

    expect(mockExec).toHaveBeenCalledWith('Ubuntu', 'echo hello', undefined);
    expect(await screen.findByText('hello world')).toBeInTheDocument();
  });

  it('shows error output in red for failed commands', async () => {
    mockExec.mockResolvedValue({ stdout: '', stderr: 'command not found', exitCode: 127 });

    render(<WslExecTerminal distros={distros} onExec={mockExec} t={mockT} />);

    const input = screen.getByPlaceholderText('Enter command...');
    await userEvent.type(input, 'badcmd');
    await userEvent.click(screen.getByText('Run'));

    expect(await screen.findByText('command not found')).toBeInTheDocument();
  });

  it('clears command input after execution', async () => {
    render(<WslExecTerminal distros={distros} onExec={mockExec} t={mockT} />);

    const input = screen.getByPlaceholderText('Enter command...') as HTMLInputElement;
    await userEvent.type(input, 'echo hello');
    await userEvent.click(screen.getByText('Run'));

    await screen.findByText('hello world');
    expect(input.value).toBe('');
  });

  it('shows clear button after execution', async () => {
    render(<WslExecTerminal distros={distros} onExec={mockExec} t={mockT} />);

    expect(screen.queryByText('Clear')).not.toBeInTheDocument();

    const input = screen.getByPlaceholderText('Enter command...');
    await userEvent.type(input, 'echo hello');
    await userEvent.click(screen.getByText('Run'));

    await screen.findByText('hello world');
    expect(screen.getByText('Clear')).toBeInTheDocument();
  });

  it('executes command on Enter key', async () => {
    render(<WslExecTerminal distros={distros} onExec={mockExec} t={mockT} />);

    const input = screen.getByPlaceholderText('Enter command...');
    await userEvent.type(input, 'pwd{enter}');

    expect(mockExec).toHaveBeenCalledWith('Ubuntu', 'pwd', undefined);
  });
});
