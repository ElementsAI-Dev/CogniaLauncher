import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LogDrawer } from '../log-drawer';
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
        'logs.title': 'Logs',
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
        'common.close': 'Close',
      };
      return translations[key] || key;
    },
  }),
}));

describe('LogDrawer', () => {
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

  it('does not render content when closed', () => {
    render(<LogDrawer />);
    expect(screen.queryByText('Logs')).not.toBeInTheDocument();
  });

  it('renders content when drawer is open', () => {
    useLogStore.setState({ ...useLogStore.getState(), drawerOpen: true });
    render(<LogDrawer />);
    expect(screen.getByText('Logs')).toBeInTheDocument();
  });

  it('renders log panel when open', () => {
    useLogStore.setState({ ...useLogStore.getState(), drawerOpen: true });
    render(<LogDrawer />);
    expect(screen.getByText('No logs yet')).toBeInTheDocument();
  });

  it('closes drawer when close button is clicked', async () => {
    const user = userEvent.setup();
    useLogStore.setState({ ...useLogStore.getState(), drawerOpen: true });
    
    render(<LogDrawer />);
    
    // Find and click the close button (X button in sheet)
    const closeButton = screen.getByRole('button', { name: /close/i });
    await user.click(closeButton);

    expect(useLogStore.getState().drawerOpen).toBe(false);
  });

  it('displays logs when present', () => {
    useLogStore.getState().addLogs([
      { timestamp: Date.now(), level: 'info', message: 'Drawer log message' },
    ]);
    useLogStore.setState({ ...useLogStore.getState(), drawerOpen: true });

    render(<LogDrawer />);
    
    expect(screen.getByText('Drawer log message')).toBeInTheDocument();
  });

  describe('drawer state management', () => {
    it('opens via store action', () => {
      render(<LogDrawer />);
      
      expect(screen.queryByText('Logs')).not.toBeInTheDocument();

      useLogStore.getState().openDrawer();
      
      // Re-render or trigger update
      render(<LogDrawer />);
      expect(useLogStore.getState().drawerOpen).toBe(true);
    });

    it('closes via store action', () => {
      useLogStore.setState({ ...useLogStore.getState(), drawerOpen: true });
      
      useLogStore.getState().closeDrawer();
      
      expect(useLogStore.getState().drawerOpen).toBe(false);
    });

    it('toggles via store action', () => {
      expect(useLogStore.getState().drawerOpen).toBe(false);
      
      useLogStore.getState().toggleDrawer();
      expect(useLogStore.getState().drawerOpen).toBe(true);

      useLogStore.getState().toggleDrawer();
      expect(useLogStore.getState().drawerOpen).toBe(false);
    });
  });
});
