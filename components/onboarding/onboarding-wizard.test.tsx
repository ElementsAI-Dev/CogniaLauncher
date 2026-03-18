import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { OnboardingWizard } from './onboarding-wizard';

global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
} as unknown as typeof ResizeObserver;

jest.mock('@/components/providers/locale-provider', () => ({
  useLocale: () => ({
    locale: 'en',
    setLocale: jest.fn(),
    t: (key: string, params?: Record<string, string | number>) => {
      const translations: Record<string, string> = {
        'onboarding.wizardTitle': 'Setup Wizard',
        'onboarding.wizardDesc': 'Get started with CogniaLauncher',
        'onboarding.stepOf': `Step ${params?.current || 1} of ${params?.total || 1}`,
        'onboarding.skip': 'Skip',
        'onboarding.back': 'Back',
        'onboarding.next': 'Next',
        'onboarding.finish': 'Finish',
        'onboarding.stepModeSelection': 'Choose Mode',
        'onboarding.stepWelcome': 'Welcome',
        'onboarding.stepLanguage': 'Language',
        'onboarding.stepTheme': 'Theme',
        'onboarding.stepEnvironmentDetection': 'Environments',
        'onboarding.stepMirrors': 'Mirrors',
        'onboarding.stepShellInit': 'Shell',
        'onboarding.stepComplete': 'Done',
      };

      return translations[key] || key;
    },
  }),
}));

jest.mock('next-themes', () => ({
  useTheme: () => ({ theme: 'system', setTheme: jest.fn() }),
}));

jest.mock('@/lib/constants/mirrors', () => ({
  MIRROR_PRESETS: {
    default: { labelKey: 'default', npm: 'npm-url', pypi: 'pypi-url', crates: 'crates-url', go: 'go-url' },
  },
}));

jest.mock('@/lib/tauri', () => ({
  isTauri: () => false,
}));

jest.mock('./steps/mode-selection-step', () => ({
  ModeSelectionStep: ({
    selectedMode,
    onSelectMode,
  }: {
    selectedMode: 'quick' | 'detailed' | null;
    onSelectMode: (mode: 'quick' | 'detailed') => void;
  }) => (
    <div>
      <div>Mode Selection Step</div>
      <div>{selectedMode ?? 'no-mode'}</div>
      <button type="button" onClick={() => onSelectMode('quick')}>
        Pick Quick
      </button>
      <button type="button" onClick={() => onSelectMode('detailed')}>
        Pick Detailed
      </button>
    </div>
  ),
}));

jest.mock('./steps/welcome-step', () => ({
  WelcomeStep: () => <div>Welcome Step</div>,
}));

jest.mock('./steps/language-step', () => ({
  LanguageStep: () => <div>Language Step</div>,
}));

jest.mock('./steps/theme-step', () => ({
  ThemeStep: () => <div>Theme Step</div>,
}));

jest.mock('./steps/environment-detection-step', () => ({
  EnvironmentDetectionStep: ({ mode }: { mode: 'quick' | 'detailed' }) => (
    <div>Environment Step {mode}</div>
  ),
}));

jest.mock('./steps/mirrors-step', () => ({
  MirrorsStep: ({ mode }: { mode: 'quick' | 'detailed' }) => <div>Mirrors Step {mode}</div>,
}));

jest.mock('./steps/shell-init-step', () => ({
  ShellInitStep: ({ mode }: { mode: 'quick' | 'detailed' }) => <div>Shell Step {mode}</div>,
}));

jest.mock('./steps/complete-step', () => ({
  CompleteStep: ({
    mode,
    actions,
  }: {
    mode: 'quick' | 'detailed';
    actions: Array<{ id: string }>;
  }) => <div>Complete Step {mode} ({actions.length})</div>,
}));

const quickStepIds = [
  'mode-selection',
  'language',
  'theme',
  'environment-detection',
  'mirrors',
  'shell-init',
  'complete',
] as const;

const detailedStepIds = [
  'mode-selection',
  'welcome',
  'language',
  'theme',
  'environment-detection',
  'mirrors',
  'shell-init',
  'complete',
] as const;

const defaultProps = {
  open: true,
  currentStep: 0,
  stepIds: ['mode-selection'] as const,
  mode: null,
  totalSteps: 1,
  progress: 0,
  isFirstStep: true,
  isLastStep: false,
  tourCompleted: false,
  sessionSummary: {
    mode: null,
    locale: null,
    theme: null,
    mirrorPreset: 'default',
    detectedCount: 0,
    primaryEnvironment: null,
    manageableEnvironments: [],
    shellType: null,
    shellConfigured: null,
  },
  nextActions: [],
  onNext: jest.fn(),
  onPrev: jest.fn(),
  onGoTo: jest.fn(),
  onSelectMode: jest.fn(),
  onUpdateSummary: jest.fn(),
  onComplete: jest.fn(),
  onSkip: jest.fn(),
  onStartTour: jest.fn(),
  onClose: jest.fn(),
};

describe('OnboardingWizard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders mode selection first and disables next without a chosen mode', () => {
    render(<OnboardingWizard {...defaultProps} />);

    expect(screen.getByText('Mode Selection Step')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled();
    expect(screen.getByText('Step 1 of 1')).toBeInTheDocument();
    expect(screen.getByText('0%')).toBeInTheDocument();
  });

  it('passes mode selection changes upward', async () => {
    render(<OnboardingWizard {...defaultProps} />);

    await userEvent.click(screen.getByRole('button', { name: 'Pick Detailed' }));

    expect(defaultProps.onSelectMode).toHaveBeenCalledWith('detailed');
  });

  it('renders quick-mode middle steps with back and skip controls', () => {
    render(
      <OnboardingWizard
        {...defaultProps}
        currentStep={2}
        stepIds={quickStepIds}
        mode="quick"
        totalSteps={quickStepIds.length}
        progress={33}
        isFirstStep={false}
        isLastStep={false}
      />,
    );

    expect(screen.getByText('Theme Step')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Back' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Skip' })).toBeInTheDocument();
    expect(screen.getByText('Step 3 of 7')).toBeInTheDocument();
  });

  it('renders detailed-mode welcome step when selected', () => {
    render(
      <OnboardingWizard
        {...defaultProps}
        currentStep={1}
        stepIds={detailedStepIds}
        mode="detailed"
        totalSteps={detailedStepIds.length}
        progress={14}
        isFirstStep={false}
        isLastStep={false}
      />,
    );

    expect(screen.getByText('Welcome Step')).toBeInTheDocument();
    expect(screen.getByText('Step 2 of 8')).toBeInTheDocument();
  });

  it('renders finish button on the last step', () => {
    render(
      <OnboardingWizard
        {...defaultProps}
        currentStep={quickStepIds.length - 1}
        stepIds={quickStepIds}
        mode="quick"
        totalSteps={quickStepIds.length}
        progress={100}
        isFirstStep={false}
        isLastStep
      />,
    );

    expect(screen.getByText('Complete Step quick (0)')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Finish' })).toBeInTheDocument();
  });

  it('calls navigation handlers from footer buttons', async () => {
    render(
      <OnboardingWizard
        {...defaultProps}
        currentStep={2}
        stepIds={quickStepIds}
        mode="quick"
        totalSteps={quickStepIds.length}
        progress={33}
        isFirstStep={false}
        isLastStep={false}
      />,
    );

    await userEvent.click(screen.getByRole('button', { name: 'Back' }));
    await userEvent.click(screen.getByRole('button', { name: 'Next' }));
    await userEvent.click(screen.getByRole('button', { name: 'Skip' }));

    expect(defaultProps.onPrev).toHaveBeenCalledTimes(1);
    expect(defaultProps.onNext).toHaveBeenCalledTimes(1);
    expect(defaultProps.onSkip).toHaveBeenCalledTimes(1);
  });

  it('calls finish on the final step', async () => {
    render(
      <OnboardingWizard
        {...defaultProps}
        currentStep={quickStepIds.length - 1}
        stepIds={quickStepIds}
        mode="quick"
        totalSteps={quickStepIds.length}
        progress={100}
        isFirstStep={false}
        isLastStep
      />,
    );

    await userEvent.click(screen.getByRole('button', { name: 'Finish' }));

    expect(defaultProps.onComplete).toHaveBeenCalledTimes(1);
  });

  it('uses step indicator buttons from the active step list', async () => {
    render(
      <OnboardingWizard
        {...defaultProps}
        currentStep={2}
        stepIds={quickStepIds}
        mode="quick"
        totalSteps={quickStepIds.length}
        progress={33}
        isFirstStep={false}
        isLastStep={false}
      />,
    );

    const languageStepButton = screen.getByLabelText('Language');
    await userEvent.click(languageStepButton);

    expect(defaultProps.onGoTo).toHaveBeenCalledWith(1);
  });

  it('handles keyboard navigation for next, back, and finish', async () => {
    const { rerender } = render(
      <OnboardingWizard
        {...defaultProps}
        currentStep={2}
        stepIds={quickStepIds}
        mode="quick"
        totalSteps={quickStepIds.length}
        progress={33}
        isFirstStep={false}
        isLastStep={false}
      />,
    );

    await userEvent.keyboard('{ArrowLeft}');
    await userEvent.keyboard('{Enter}');

    expect(defaultProps.onPrev).toHaveBeenCalledTimes(1);
    expect(defaultProps.onNext).toHaveBeenCalledTimes(1);

    rerender(
      <OnboardingWizard
        {...defaultProps}
        currentStep={quickStepIds.length - 1}
        stepIds={quickStepIds}
        mode="quick"
        totalSteps={quickStepIds.length}
        progress={100}
        isFirstStep={false}
        isLastStep
      />,
    );

    await userEvent.keyboard('{Enter}');

    expect(defaultProps.onComplete).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when the dialog is dismissed', async () => {
    render(<OnboardingWizard {...defaultProps} />);

    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText('Mode Selection Step')).toBeInTheDocument();

    await userEvent.keyboard('{Escape}');

    expect(defaultProps.onClose).toHaveBeenCalled();
  });

  it('keeps step content in a dedicated scroll region and uses responsive footer actions', () => {
    render(
      <OnboardingWizard
        {...defaultProps}
        currentStep={2}
        stepIds={quickStepIds}
        mode="quick"
        totalSteps={quickStepIds.length}
        progress={33}
        isFirstStep={false}
        isLastStep={false}
      />,
    );

    expect(screen.getByTestId('onboarding-wizard-body')).toHaveClass('flex-1', 'min-h-0');
    expect(screen.getByTestId('onboarding-wizard-footer').className).toContain('flex-col-reverse');
    expect(screen.getByTestId('onboarding-wizard-footer').className).toContain('sm:flex-row');
    expect(screen.getByTestId('onboarding-wizard-actions')).toHaveClass('w-full', 'sm:w-auto');
  });
});
