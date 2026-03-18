import type {
  OnboardingMode,
  OnboardingSessionState,
  OnboardingSessionSummary,
} from '@/lib/stores/onboarding';
import type { OnboardingNextAction } from '@/types/onboarding';

export interface OnboardingSurfaceSnapshot {
  mode: OnboardingMode | null;
  completed: boolean;
  skipped: boolean;
  sessionState: OnboardingSessionState;
  canResume: boolean;
  tourCompleted: boolean;
  sessionSummary: OnboardingSessionSummary;
}

export interface OnboardingSurfaceState {
  hasBeenThrough: boolean;
  showResumeAction: boolean;
  showRerunAction: boolean;
  showStartTourAction: boolean;
  showResumableStatus: boolean;
  statusKey: string | null;
}

export function buildOnboardingNextActions(
  summary: OnboardingSessionSummary,
  tourCompleted: boolean,
): OnboardingNextAction[] {
  const actions: OnboardingNextAction[] = [];

  if (summary.primaryEnvironment) {
    actions.push({
      id: 'manage-primary-environment',
      kind: 'environment',
      labelKey: 'onboarding.completeActionManageEnvironment',
      descriptionKey: 'onboarding.completeActionManageEnvironmentDesc',
      envType: summary.primaryEnvironment,
    });
  }

  if (!tourCompleted) {
    actions.push({
      id: 'start-guided-tour',
      kind: 'tour',
      labelKey: 'onboarding.completeActionTour',
      descriptionKey: 'onboarding.completeActionTourDesc',
    });
  }

  actions.push({
    id: 'review-settings',
    kind: 'route',
    labelKey: 'onboarding.completeActionSettings',
    descriptionKey: 'onboarding.completeActionSettingsDesc',
    route: '/settings',
  });

  return actions;
}

export function getOnboardingSurfaceState(
  snapshot: OnboardingSurfaceSnapshot,
): OnboardingSurfaceState {
  const hasBeenThrough =
    snapshot.completed || snapshot.skipped || snapshot.sessionState === 'paused';

  return {
    hasBeenThrough,
    showResumeAction:
      snapshot.sessionState === 'paused'
      && snapshot.canResume
      && !snapshot.completed
      && !snapshot.skipped,
    showRerunAction: true,
    showStartTourAction:
      !snapshot.tourCompleted
      && (snapshot.completed || snapshot.skipped),
    showResumableStatus:
      snapshot.canResume
      && !snapshot.completed
      && !snapshot.skipped,
    statusKey: snapshot.completed
      ? 'settings.onboardingStatusCompleted'
      : snapshot.skipped
        ? 'settings.onboardingStatusSkipped'
        : snapshot.sessionState === 'paused'
          ? 'settings.onboardingStatusPaused'
          : null,
  };
}
