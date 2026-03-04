import { render, screen, fireEvent } from '@testing-library/react';
import HealthPage from './page';

jest.mock('@/components/providers/locale-provider', () => ({
  useLocale: () => ({ t: (key: string) => key }),
}));

let mockSystemHealth: Record<string, unknown> | null = null;
let mockLoading = false;
let mockError: string | null = null;
let mockProgress: Record<string, unknown> | null = null;
const mockCheckAll = jest.fn();
const mockCheckEnvironment = jest.fn();
const mockClearResults = jest.fn();
const mockIsTauri = jest.fn(() => true);

jest.mock('@/hooks/use-health-check', () => ({
  useHealthCheck: () => ({
    systemHealth: mockSystemHealth,
    environmentHealth: {},
    loading: mockLoading,
    error: mockError,
    progress: mockProgress,
    checkAll: mockCheckAll,
    checkEnvironment: mockCheckEnvironment,
    getStatusColor: jest.fn(() => ''),
    getStatusIcon: jest.fn(() => '?'),
    clearResults: mockClearResults,
  }),
}));

jest.mock('@/lib/tauri', () => ({
  isTauri: () => mockIsTauri(),
}));

jest.mock('@/lib/clipboard', () => ({
  writeClipboard: jest.fn(),
}));

jest.mock('next/link', () => {
  const MockLink = ({ children, ...props }: { children: React.ReactNode; href: string }) => (
    <a {...props}>{children}</a>
  );
  MockLink.displayName = 'MockLink';
  return MockLink;
});

describe('HealthPage', () => {
  beforeEach(() => {
    mockSystemHealth = null;
    mockLoading = false;
    mockError = null;
    mockProgress = null;
    mockIsTauri.mockReturnValue(true);
    jest.clearAllMocks();
  });

  it('renders page title', () => {
    render(<HealthPage />);
    expect(screen.getByText('environments.healthCheck.title')).toBeInTheDocument();
  });

  it('renders run check button', () => {
    render(<HealthPage />);
    expect(screen.getByText('environments.healthCheck.runCheck')).toBeInTheDocument();
  });

  it('shows no results state when systemHealth is null', () => {
    render(<HealthPage />);
    expect(screen.getByText('environments.healthCheck.noResults')).toBeInTheDocument();
    expect(screen.getByText('environments.healthCheck.clickToCheck')).toBeInTheDocument();
  });

  it('calls checkAll when run check button is clicked', () => {
    render(<HealthPage />);
    fireEvent.click(screen.getByText('environments.healthCheck.runCheck'));
    expect(mockCheckAll).toHaveBeenCalledWith({ force: true });
  });

  it('shows error alert when error exists', () => {
    mockError = 'Connection failed';
    render(<HealthPage />);
    expect(screen.getByText('Connection failed')).toBeInTheDocument();
  });

  it('renders tabs when systemHealth is provided', () => {
    mockSystemHealth = {
      overall_status: 'healthy',
      checked_at: new Date().toISOString(),
      system_issues: [],
      environments: [
        { env_type: 'node', provider_id: 'fnm', status: 'healthy', issues: [], suggestions: [] },
      ],
      package_managers: [],
      skipped_providers: [],
    };
    render(<HealthPage />);
    expect(screen.getByText('environments.healthCheck.tabOverview')).toBeInTheDocument();
    expect(screen.getByText('environments.healthCheck.tabEnvironments')).toBeInTheDocument();
    expect(screen.getByText('environments.healthCheck.tabPackageManagers')).toBeInTheDocument();
  });

  it('shows overall status banner', () => {
    mockSystemHealth = {
      overall_status: 'warning',
      checked_at: new Date().toISOString(),
      system_issues: [],
      environments: [{ env_type: 'node', provider_id: 'fnm', status: 'warning', issues: [], suggestions: [] }],
      package_managers: [],
      skipped_providers: [],
    };
    render(<HealthPage />);
    expect(screen.getByText('environments.healthCheck.status.warning')).toBeInTheDocument();
  });

  it('shows stats grid counts', () => {
    mockSystemHealth = {
      overall_status: 'warning',
      checked_at: new Date().toISOString(),
      system_issues: [],
      environments: [
        { env_type: 'node', status: 'healthy', issues: [], suggestions: [] },
        { env_type: 'python', status: 'warning', issues: [], suggestions: [] },
        { env_type: 'rust', status: 'error', issues: [], suggestions: [] },
      ],
      package_managers: [],
      skipped_providers: [],
    };
    render(<HealthPage />);
    expect(screen.getByText('1')).toBeInTheDocument(); // healthy
  });

  it('shows desktop-only fallback in web mode', () => {
    mockIsTauri.mockReturnValue(false);
    render(<HealthPage />);
    expect(screen.getByText('environments.desktopOnly')).toBeInTheDocument();
  });

  it('shows progress bar during loading', () => {
    mockLoading = true;
    mockProgress = { currentProvider: 'fnm', completed: 2, total: 5, phase: 'checking' };
    render(<HealthPage />);
    expect(screen.getByText(/2\/5/)).toBeInTheDocument();
  });

  it('shows export and clear buttons when results exist', () => {
    mockSystemHealth = {
      overall_status: 'healthy',
      checked_at: new Date().toISOString(),
      system_issues: [],
      environments: [],
      package_managers: [],
      skipped_providers: [],
    };
    render(<HealthPage />);
    expect(screen.getByText('environments.healthCheck.exportDiagnostics')).toBeInTheDocument();
    expect(screen.getByText('environments.healthCheck.clearResults')).toBeInTheDocument();
  });

  it('calls clearResults when clear button is clicked', () => {
    mockSystemHealth = {
      overall_status: 'healthy',
      checked_at: new Date().toISOString(),
      system_issues: [],
      environments: [],
      package_managers: [],
      skipped_providers: [],
    };
    render(<HealthPage />);
    fireEvent.click(screen.getByText('environments.healthCheck.clearResults'));
    expect(mockClearResults).toHaveBeenCalled();
  });
});
