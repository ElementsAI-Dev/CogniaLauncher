import type { LucideIcon } from 'lucide-react';
import type { Locale } from '@/types/i18n';
import type {
  OnboardingMode,
  OnboardingStepId,
  OnboardingSessionSummary,
} from '@/lib/stores/onboarding';

// ============================================================================
// Bubble Hint Types
// ============================================================================

export interface BubbleHintDef {
  /** Unique hint ID for dismissal tracking */
  id: string;
  /** CSS selector to find the target element */
  target: string;
  /** i18n key for hint title */
  titleKey: string;
  /** i18n key for hint description */
  descKey: string;
  /** Preferred popover placement relative to the target */
  side: 'top' | 'bottom' | 'left' | 'right';
  /** Only show this hint when on this route */
  route?: string;
  /** Route matching strategy (defaults to exact) */
  routeMatch?: 'exact' | 'prefix';
  /** Only show after onboarding wizard has been completed or skipped */
  showAfterOnboarding: boolean;
  /** Delay in ms before the hint appears after conditions are met */
  delay?: number;
  /** Auto-dismiss timeout in ms after hint is visible (defaults to 6000) */
  autoDismissMs?: number;
}

export interface BubbleHintProps {
  hint: BubbleHintDef;
  onDismiss: (hintId: string) => void;
}

export interface BubbleHintLayerProps {
  /** Maximum number of hints to show simultaneously */
  maxConcurrent?: number;
}

// ============================================================================
// Tour Types
// ============================================================================

export interface TourStepDef {
  /** Unique step ID */
  id: string;
  /** CSS selector or data-tour attribute value to highlight */
  target: string;
  /** i18n key for step title */
  titleKey: string;
  /** i18n key for step description */
  descKey: string;
  /** Preferred popover placement */
  side: 'top' | 'bottom' | 'left' | 'right';
  /** Optional route to navigate to before showing this step */
  route?: string;
}

export interface TourOverlayProps {
  active: boolean;
  currentStep: number;
  onNext: () => void;
  onPrev: () => void;
  onComplete: () => void;
  onStop: () => void;
}

export interface TargetRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

// ============================================================================
// Onboarding Wizard Types
// ============================================================================

export type OnboardingNextActionKind = 'tour' | 'route' | 'environment';

export interface OnboardingNextAction {
  id: string;
  kind: OnboardingNextActionKind;
  labelKey: string;
  descriptionKey?: string;
  route?: string;
  envType?: string;
}

export interface OnboardingWizardProps {
  open: boolean;
  currentStep: number;
  stepIds: readonly OnboardingStepId[];
  mode: OnboardingMode | null;
  totalSteps: number;
  progress: number;
  isFirstStep: boolean;
  isLastStep: boolean;
  tourCompleted: boolean;
  sessionSummary: OnboardingSessionSummary;
  nextActions: OnboardingNextAction[];
  onNext: () => void;
  onPrev: () => void;
  onGoTo: (step: number) => void;
  onSelectMode: (mode: OnboardingMode) => void;
  onUpdateSummary: (summary: Partial<OnboardingSessionSummary>) => void;
  onComplete: () => void;
  onSkip: () => void;
  onStartTour: () => void;
  onClose: () => void;
}

export type StepIconMap = Record<OnboardingStepId, LucideIcon>;

// ============================================================================
// Step Component Types
// ============================================================================

export interface WelcomeStepProps {
  t: (key: string, params?: Record<string, string | number>) => string;
}

export interface ModeSelectionStepProps {
  selectedMode: OnboardingMode | null;
  onSelectMode: (mode: OnboardingMode) => void;
  t: (key: string) => string;
}

export interface LanguageStepProps {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: string) => string;
}

export interface LanguageOption {
  value: Locale;
  label: string;
  nativeLabel: string;
  flag: string;
}

export interface ThemeStepProps {
  theme: string | undefined;
  setTheme: (theme: string) => void;
  t: (key: string) => string;
}

export interface ThemeOption {
  value: string;
  icon: LucideIcon;
  preview: string;
}

export interface EnvironmentDetectionStepProps {
  mode?: OnboardingMode;
  t: (key: string, params?: Record<string, string | number>) => string;
  onDetectionSummaryChange?: (summary: Pick<OnboardingSessionSummary, 'detectedCount' | 'primaryEnvironment' | 'manageableEnvironments'>) => void;
}

export interface DetectedEnv {
  detectionKey?: string;
  name: string;
  envType?: string;
  providerId?: string;
  providerName?: string;
  version: string;
  compilerLabel?: string;
  available: boolean;
  source?: string;
  sourcePath?: string | null;
  scope?: 'system' | 'managed';
}

export interface MirrorsStepProps {
  mode?: OnboardingMode;
  t: (key: string) => string;
  onApplyPreset: (presetKey: string) => void;
}

export interface ShellInitStepProps {
  mode?: OnboardingMode;
  t: (key: string) => string;
  onSummaryChange?: (summary: Pick<OnboardingSessionSummary, 'shellType' | 'shellConfigured'>) => void;
}

export type ShellType = 'powershell' | 'bash' | 'zsh' | 'fish';

export interface ShellOption {
  value: ShellType;
  label: string;
  configFile: string;
  command: string;
}

export interface CompleteStepProps {
  mode?: OnboardingMode;
  t: (key: string, params?: Record<string, string | number>) => string;
  onStartTour: () => void;
  onRunAction: (action: OnboardingNextAction) => void;
  tourCompleted: boolean;
  summary: OnboardingSessionSummary;
  actions: OnboardingNextAction[];
}
