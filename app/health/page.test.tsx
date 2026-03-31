import { render, screen, fireEvent } from '@testing-library/react';
import HealthPage from './page';
import { writeClipboard } from '@/lib/clipboard';

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
const mockPreviewRemediation = jest.fn();
const mockApplyRemediation = jest.fn();
const mockIsTauri = jest.fn(() => true);
const mockSummary = {
  environmentCount: 0,
  healthyCount: 0,
  warningCount: 0,
  errorCount: 0,
  unavailableCount: 0,
  unavailableScopeCount: 0,
  timeoutScopeCount: 0,
  unsupportedScopeCount: 0,
  packageManagerCount: 0,
  unavailablePackageManagerCount: 0,
  issueCount: 0,
  verifiedIssueCount: 0,
  advisoryIssueCount: 0,
  actionableIssueCount: 0,
};

jest.mock('@/hooks/health/use-health-check', () => ({
  useHealthCheck: () => ({
    systemHealth: mockSystemHealth,
    environmentHealth: {},
    loading: mockLoading,
    error: mockError,
    progress: mockProgress,
    summary: mockSummary,
    activeRemediationId: null,
    previewRemediation: mockPreviewRemediation,
    applyRemediation: mockApplyRemediation,
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
    mockSummary.environmentCount = 0;
    mockSummary.healthyCount = 0;
    mockSummary.warningCount = 0;
    mockSummary.errorCount = 0;
    mockSummary.unavailableCount = 0;
    mockSummary.unavailableScopeCount = 0;
    mockSummary.timeoutScopeCount = 0;
    mockSummary.unsupportedScopeCount = 0;
    mockSummary.packageManagerCount = 0;
    mockSummary.unavailablePackageManagerCount = 0;
    mockSummary.issueCount = 0;
    mockSummary.verifiedIssueCount = 0;
    mockSummary.advisoryIssueCount = 0;
    mockSummary.actionableIssueCount = 0;
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
      envvar_issues: [],
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
      envvar_issues: [],
      system_issues: [],
      environments: [{ env_type: 'node', provider_id: 'fnm', status: 'warning', issues: [], suggestions: [] }],
      package_managers: [],
      skipped_providers: [],
    };
    render(<HealthPage />);
    expect(screen.getAllByText('environments.healthCheck.status.warning').length).toBeGreaterThan(0);
  });

  it('shows stats grid counts', () => {
    mockSystemHealth = {
      overall_status: 'warning',
      checked_at: new Date().toISOString(),
      envvar_issues: [],
      system_issues: [],
      environments: [
        { env_type: 'node', status: 'healthy', issues: [], suggestions: [] },
        { env_type: 'python', status: 'warning', issues: [], suggestions: [] },
        { env_type: 'rust', status: 'error', issues: [], suggestions: [] },
      ],
      package_managers: [],
      skipped_providers: [],
    };
    mockSummary.environmentCount = 3;
    mockSummary.healthyCount = 1;
    mockSummary.warningCount = 1;
    mockSummary.errorCount = 1;
    mockSummary.unavailableCount = 0;
    render(<HealthPage />);
    expect(screen.getAllByText('1').length).toBeGreaterThan(0); // healthy card count appears
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
      envvar_issues: [],
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
      envvar_issues: [],
      system_issues: [],
      environments: [],
      package_managers: [],
      skipped_providers: [],
    };
    render(<HealthPage />);
    fireEvent.click(screen.getByText('environments.healthCheck.clearResults'));
    expect(mockClearResults).toHaveBeenCalled();
  });

  it('exports diagnostics with scope and evidence metadata', () => {
    mockSystemHealth = {
      overall_status: 'warning',
      checked_at: new Date().toISOString(),
      envvar_issues: [
        {
          severity: 'warning',
          message: 'User PATH contains invalid entries',
          fix_command: null,
          signal_source: 'system_probe',
          confidence: 'verified',
          check_id: 'envvar_path_validity:user',
        },
      ],
      system_issues: [
        {
          severity: 'warning',
          message: 'System issue',
          fix_command: null,
          signal_source: 'path_heuristic',
          confidence: 'inferred',
          check_id: 'path_duplicate_entries',
        },
      ],
      environments: [
        {
          env_type: 'node',
          provider_id: 'fnm',
          status: 'warning',
          scope_state: 'available',
          scope_reason: null,
          issues: [
            {
              severity: 'warning',
              message: 'Node warning',
              fix_command: 'fix-node',
              signal_source: 'runtime_probe',
              confidence: 'verified',
              check_id: 'environment_missing_active_version:fnm',
            },
          ],
          suggestions: [],
        },
      ],
      package_managers: [
        {
          provider_id: 'npm',
          display_name: 'npm',
          status: 'healthy',
          scope_state: 'timeout',
          scope_reason: 'health_check_timeout',
          version: '10.0.0',
          issues: [],
        },
      ],
      skipped_providers: [],
    };
    mockSummary.issueCount = 2;
    mockSummary.verifiedIssueCount = 1;
    mockSummary.advisoryIssueCount = 1;

    render(<HealthPage />);
    fireEvent.click(screen.getByText('environments.healthCheck.exportDiagnostics'));

    const clipboardSpy = writeClipboard as jest.Mock;
    expect(clipboardSpy).toHaveBeenCalledTimes(1);
    const exported = clipboardSpy.mock.calls[0]?.[0] as string;
    expect(exported).toContain('EnvVar Issues (1):');
    expect(exported).toContain('scope=timeout');
    expect(exported).toContain('source=runtime_probe');
    expect(exported).toContain('confidence=verified');
    expect(exported).toContain('check=environment_missing_active_version:fnm');
  });

  it('renders envvar diagnostics in a dedicated section', () => {
    mockSystemHealth = {
      overall_status: 'warning',
      checked_at: new Date().toISOString(),
      envvar_issues: [
        {
          severity: 'warning',
          category: 'path_conflict',
          message: 'User PATH contains invalid entries',
          details: 'Missing directories: C:\\ghost',
          fix_command: null,
          fix_description: null,
          remediation_id: null,
          check_id: 'envvar_path_validity:user',
        },
      ],
      system_issues: [
        {
          severity: 'warning',
          category: 'other',
          message: 'Disk space low',
          details: null,
          fix_command: null,
          fix_description: null,
          remediation_id: null,
        },
      ],
      environments: [],
      package_managers: [],
      skipped_providers: [],
    };

    render(<HealthPage />);

    expect(screen.getByText('environments.healthCheck.envvarIssues')).toBeInTheDocument();
    expect(screen.getByText('User PATH contains invalid entries')).toBeInTheDocument();
    expect(screen.getByText('environments.healthCheck.systemIssues')).toBeInTheDocument();
    expect(screen.getByText('Disk space low')).toBeInTheDocument();
  });
});
