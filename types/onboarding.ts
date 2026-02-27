import type { LucideIcon } from 'lucide-react';
import type { Locale } from '@/types/i18n';
import type { OnboardingStepId } from '@/lib/stores/onboarding';

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
  /** Only show this hint when on this route (pathname startsWith match) */
  route?: string;
  /** Only show after onboarding wizard has been completed or skipped */
  showAfterOnboarding: boolean;
  /** Delay in ms before the hint appears after conditions are met */
  delay?: number;
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

export interface OnboardingWizardProps {
  open: boolean;
  currentStep: number;
  totalSteps: number;
  progress: number;
  isFirstStep: boolean;
  isLastStep: boolean;
  tourCompleted: boolean;
  onNext: () => void;
  onPrev: () => void;
  onGoTo: (step: number) => void;
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
  t: (key: string, params?: Record<string, string | number>) => string;
}

export interface DetectedEnv {
  name: string;
  version: string;
  available: boolean;
}

export interface MirrorsStepProps {
  t: (key: string) => string;
}

export type MirrorPreset = 'default' | 'china' | 'custom';

export interface MirrorPresetOption {
  value: MirrorPreset;
  labelKey: string;
  descKey: string;
}

export interface ShellInitStepProps {
  t: (key: string) => string;
}

export type ShellType = 'powershell' | 'bash' | 'zsh' | 'fish';

export interface ShellOption {
  value: ShellType;
  label: string;
  configFile: string;
  command: string;
}

export interface CompleteStepProps {
  t: (key: string) => string;
  onStartTour: () => void;
  tourCompleted: boolean;
}
