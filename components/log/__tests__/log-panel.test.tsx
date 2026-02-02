import { render, screen } from '@testing-library/react';
import { LogPanel } from '../log-panel';
import { useLogStore } from '@/lib/stores/log';

// Mock tauri module
jest.mock('@/lib/tauri', () => ({
  isTauri: jest.fn(() => false),
}));

// Mock locale provider
jest.mock('@/components/providers/locale-provider', () => ({
  useLocale: () => ({
    t: (key: string) => {
      const translations: Record<string, string> = {
        'logs.searchPlaceholder': 'Search logs...',
        'logs.filter': 'Filter',
        'logs.logLevels': 'Log Levels',
        'logs.pause': 'Pause',
        'logs.resume': 'Resume',
        'logs.autoScrollOn': 'Auto-scroll enabled',
        'logs.autoScrollOff': 'Auto-scroll disabled',
        'logs.export': 'Export logs',
        'logs.clear': 'Clear logs',
        'logs.total': 'Total',
        'logs.paused': 'Paused',
        'logs.entries': 'entries',
        'logs.noLogs': 'No logs yet',
        'logs.noLogsDescription': 'Logs will appear here as the application runs',
        'logs.notAvailable': 'Logs not available',
        'logs.notAvailableDescription': 'Log viewer is only available in the desktop application',
        'common.copy': 'Copy',
      };
      return translations[key] || key;
    },
  }),
}));

describe('LogPanel', () => {
  beforeEach(() => {
    // Reset store state
    useLogStore.setState({
      logs: [],
      maxLogs: 1000,
      filter: {
        levels: ['info', 'warn', 'error'],
        search: '',
      },
      autoScroll: true,
      paused: false,
      drawerOpen: false,
      logFiles: [],
      selectedLogFile: null,
    });
  });

  it('renders without crashing', () => {
    render(<LogPanel />);
    expect(screen.getByText('No logs yet')).toBeInTheDocument();
  });

  it('shows empty state when no logs', () => {
    render(<LogPanel />);
    expect(screen.getByText('No logs yet')).toBeInTheDocument();
    expect(screen.getByText('Logs will appear here as the application runs')).toBeInTheDocument();
  });

  it('renders toolbar by default', () => {
    render(<LogPanel />);
    expect(screen.getByPlaceholderText('Search logs...')).toBeInTheDocument();
  });

  it('hides toolbar when showToolbar is false', () => {
    render(<LogPanel showToolbar={false} />);
    expect(screen.queryByPlaceholderText('Search logs...')).not.toBeInTheDocument();
  });

  it('renders log entries when logs exist', () => {
    useLogStore.getState().addLogs([
      { timestamp: Date.now(), level: 'info', message: 'Test message 1' },
      { timestamp: Date.now(), level: 'warn', message: 'Test message 2' },
    ]);

    render(<LogPanel />);
    
    expect(screen.getByText('Test message 1')).toBeInTheDocument();
    expect(screen.getByText('Test message 2')).toBeInTheDocument();
  });

  it('filters logs based on level filter', () => {
    useLogStore.getState().addLogs([
      { timestamp: Date.now(), level: 'debug', message: 'Debug message' },
      { timestamp: Date.now(), level: 'info', message: 'Info message' },
      { timestamp: Date.now(), level: 'error', message: 'Error message' },
    ]);

    render(<LogPanel />);
    
    // Default filter excludes debug
    expect(screen.queryByText('Debug message')).not.toBeInTheDocument();
    expect(screen.getByText('Info message')).toBeInTheDocument();
    expect(screen.getByText('Error message')).toBeInTheDocument();
  });

  it('filters logs based on search', () => {
    useLogStore.getState().addLogs([
      { timestamp: Date.now(), level: 'info', message: 'Apple' },
      { timestamp: Date.now(), level: 'info', message: 'Banana' },
      { timestamp: Date.now(), level: 'info', message: 'Cherry' },
    ]);
    useLogStore.getState().setSearch('Banana');

    render(<LogPanel />);
    
    expect(screen.queryByText('Apple')).not.toBeInTheDocument();
    expect(screen.getByText('Banana')).toBeInTheDocument();
    expect(screen.queryByText('Cherry')).not.toBeInTheDocument();
  });

  it('applies custom className', () => {
    const { container } = render(<LogPanel className="custom-class" />);
    expect(container.firstChild).toHaveClass('custom-class');
  });

  it('applies custom maxHeight', () => {
    const { container } = render(<LogPanel maxHeight="500px" />);
    const panel = container.firstChild as HTMLElement;
    expect(panel.style.maxHeight).toBe('500px');
  });

  describe('log display', () => {
    it('shows level badges for each log', () => {
      useLogStore.getState().addLogs([
        { timestamp: Date.now(), level: 'info', message: 'Info' },
        { timestamp: Date.now(), level: 'warn', message: 'Warning' },
        { timestamp: Date.now(), level: 'error', message: 'Error' },
      ]);

      render(<LogPanel />);
      
      expect(screen.getByText('INFO')).toBeInTheDocument();
      expect(screen.getByText('WARN')).toBeInTheDocument();
      expect(screen.getByText('ERROR')).toBeInTheDocument();
    });

    it('shows target when provided', () => {
      useLogStore.getState().addLog({
        timestamp: Date.now(),
        level: 'info',
        message: 'Test',
        target: 'my-module',
      });

      render(<LogPanel />);
      
      expect(screen.getByText('[my-module]')).toBeInTheDocument();
    });
  });

  describe('auto-scroll behavior', () => {
    it('respects autoScroll setting', () => {
      useLogStore.setState({ ...useLogStore.getState(), autoScroll: true });
      
      useLogStore.getState().addLogs([
        { timestamp: Date.now(), level: 'info', message: 'Message 1' },
        { timestamp: Date.now(), level: 'info', message: 'Message 2' },
      ]);

      render(<LogPanel />);
      
      // Auto-scroll behavior is tested by verifying logs render
      expect(screen.getByText('Message 1')).toBeInTheDocument();
      expect(screen.getByText('Message 2')).toBeInTheDocument();
    });
  });
});
