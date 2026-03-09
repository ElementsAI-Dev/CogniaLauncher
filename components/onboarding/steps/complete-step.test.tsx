import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CompleteStep } from './complete-step';

const mockT = (key: string, params?: Record<string, string | number>) => {
  const translations: Record<string, string> = {
    'onboarding.completeTitle': 'All Done!',
    'onboarding.completeDesc': "You're all set",
    'onboarding.completeDetailedDesc': 'Detailed onboarding is complete',
    'onboarding.completeHint': 'Click Finish to get started',
    'onboarding.completeDetailedHint': 'Finish now or continue into the tour',
    'onboarding.summaryTitle': 'Setup Summary',
    'onboarding.summaryMode': 'Mode',
    'onboarding.summaryLanguage': 'Language',
    'onboarding.summaryTheme': 'Theme',
    'onboarding.summaryMirrors': 'Mirror preset',
    'onboarding.summaryDetected': 'Detected environments',
    'onboarding.summaryDetectedCount': `${params?.count ?? 0} detected`,
    'onboarding.summaryShell': 'Shell setup',
    'onboarding.summaryShellConfigured': 'Configured',
    'onboarding.summaryShellNotConfigured': 'Not configured',
    'onboarding.summaryPrimaryEnvironment': `Suggested next: manage ${params?.envType ?? 'unknown'}`,
    'onboarding.summaryNotSet': 'Not set',
    'onboarding.completeActionManageEnvironment': 'Manage detected environment',
    'onboarding.completeActionTour': 'Start guided tour',
    'onboarding.completeActionSettings': 'Review settings',
    'onboarding.themeDark': 'Dark',
    'settings.onboardingModeQuick': 'Quick mode',
    'settings.onboardingModeDetailed': 'Detailed mode',
    'onboarding.mirrorPresetDesc_default': 'Use official package registries directly',
  };

  return translations[key] || key;
};

describe('CompleteStep', () => {
  const defaultProps = {
    t: mockT,
    onStartTour: jest.fn(),
    onRunAction: jest.fn(),
    tourCompleted: false,
    summary: {
      mode: 'quick' as const,
      locale: 'en',
      theme: 'dark',
      mirrorPreset: 'default',
      detectedCount: 2,
      primaryEnvironment: 'node',
      manageableEnvironments: ['node', 'python'],
      shellType: 'powershell',
      shellConfigured: true,
    },
    actions: [
      { id: 'manage-env', kind: 'environment' as const, labelKey: 'onboarding.completeActionManageEnvironment', envType: 'node' },
      { id: 'tour', kind: 'tour' as const, labelKey: 'onboarding.completeActionTour' },
      { id: 'settings', kind: 'route' as const, labelKey: 'onboarding.completeActionSettings', route: '/settings' },
    ],
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders summary and action labels', () => {
    render(<CompleteStep {...defaultProps} />);

    expect(screen.getByText('All Done!')).toBeInTheDocument();
    expect(screen.getByText('Setup Summary')).toBeInTheDocument();
    expect(screen.getByText('Quick mode')).toBeInTheDocument();
    expect(screen.getByText('Dark')).toBeInTheDocument();
    expect(screen.getByText('2 detected')).toBeInTheDocument();
    expect(screen.getByText('Manage detected environment')).toBeInTheDocument();
    expect(screen.getByText('Start guided tour')).toBeInTheDocument();
    expect(screen.getByText('Review settings')).toBeInTheDocument();
  });

  it('routes tour actions through onStartTour', async () => {
    render(<CompleteStep {...defaultProps} />);

    await userEvent.click(screen.getByText('Start guided tour'));

    expect(defaultProps.onStartTour).toHaveBeenCalledTimes(1);
    expect(defaultProps.onRunAction).not.toHaveBeenCalled();
  });

  it('routes non-tour actions through onRunAction', async () => {
    render(<CompleteStep {...defaultProps} />);

    await userEvent.click(screen.getByText('Manage detected environment'));

    expect(defaultProps.onRunAction).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'manage-env', kind: 'environment' }),
    );
  });

  it('renders confetti particles', () => {
    const { container } = render(<CompleteStep {...defaultProps} />);
    const particles = container.querySelectorAll('.onboarding-confetti-particle');
    expect(particles.length).toBe(8);
  });

  it('renders detailed mode copy when detailed mode is active', () => {
    render(
      <CompleteStep
        {...defaultProps}
        mode="detailed"
      />,
    );

    expect(screen.getByText('Detailed onboarding is complete')).toBeInTheDocument();
    expect(screen.getByText('Finish now or continue into the tour')).toBeInTheDocument();
  });
});
