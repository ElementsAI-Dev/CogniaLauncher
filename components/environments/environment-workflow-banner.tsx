"use client";

import Link from "next/link";
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Info,
  Loader2,
  RefreshCw,
  X,
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  useEnvironmentStore,
  getLogicalEnvType,
  type EnvironmentWorkflowAction,
  type EnvironmentWorkflowOrigin,
} from "@/lib/stores/environment";

interface EnvironmentWorkflowBannerProps {
  envType: string;
  projectPath?: string | null;
  providerLabel?: string | null;
  onRefresh?: () => Promise<void> | void;
  t: (key: string, params?: Record<string, string | number>) => string;
}

function getOriginLabel(
  origin: EnvironmentWorkflowOrigin,
  t: EnvironmentWorkflowBannerProps["t"],
): string {
  switch (origin) {
    case "dashboard":
      return t("environments.workflow.origin.dashboard");
    case "overview":
      return t("environments.workflow.origin.overview");
    case "detail":
      return t("environments.workflow.origin.detail");
    case "onboarding":
      return t("environments.workflow.origin.onboarding");
    case "direct":
    default:
      return t("environments.workflow.origin.direct");
  }
}

function getActionMessage(
  action: EnvironmentWorkflowAction,
  t: EnvironmentWorkflowBannerProps["t"],
): string {
  const params: Record<string, string | number> = {
    version: action.version ?? t("common.none"),
    path: action.projectPath ?? t("environments.workflow.currentDirectory"),
  };

  switch (action.action) {
    case "install":
      return t(`environments.workflow.action.install.${action.status}`, params);
    case "uninstall":
      return t(`environments.workflow.action.uninstall.${action.status}`, params);
    case "setGlobal":
      return t(`environments.workflow.action.setGlobal.${action.status}`, params);
    case "setLocal":
      return t(`environments.workflow.action.setLocal.${action.status}`, params);
    case "refresh":
      return t(`environments.workflow.action.refresh.${action.status}`, params);
    case "applyProfile":
      return t(`environments.workflow.action.applyProfile.${action.status}`, params);
    case "createShim":
      return t(`environments.workflow.action.createShim.${action.status}`, params);
    case "removeShim":
      return t(`environments.workflow.action.removeShim.${action.status}`, params);
    case "regenerateShims":
      return t(`environments.workflow.action.regenerateShims.${action.status}`, params);
    case "setupPath":
      return t(`environments.workflow.action.setupPath.${action.status}`, params);
    case "removePath":
      return t(`environments.workflow.action.removePath.${action.status}`, params);
    case "saveSettings":
    default:
      return t(`environments.workflow.action.saveSettings.${action.status}`, params);
  }
}

function getStatusHint(
  action: EnvironmentWorkflowAction,
  t: EnvironmentWorkflowBannerProps["t"],
): string {
  if (action.status === "error") {
    return t("environments.workflow.hint.error");
  }

  if (action.status === "blocked") {
    return t("environments.workflow.hint.blocked");
  }

  if (action.status === "success") {
    return t("environments.workflow.hint.success");
  }

  return t("environments.workflow.hint.running");
}

function WorkflowIcon({ action }: { action: EnvironmentWorkflowAction | null }) {
  if (!action) {
    return <Info className="h-4 w-4" />;
  }

  switch (action.status) {
    case "running":
      return <Loader2 className="h-4 w-4 animate-spin" />;
    case "success":
      return <CheckCircle2 className="h-4 w-4" />;
    case "error":
    case "blocked":
      return <AlertCircle className="h-4 w-4" />;
    default:
      return <Info className="h-4 w-4" />;
  }
}

export function EnvironmentWorkflowBanner({
  envType,
  projectPath,
  providerLabel,
  onRefresh,
  t,
}: EnvironmentWorkflowBannerProps) {
  const workflowContext = useEnvironmentStore((state) => state.workflowContext);
  const workflowAction = useEnvironmentStore((state) => state.workflowAction);
  const clearWorkflowAction = useEnvironmentStore((state) => state.clearWorkflowAction);
  const clearWorkflowContext = useEnvironmentStore((state) => state.clearWorkflowContext);

  const matchingContext = workflowContext?.envType === envType ? workflowContext : null;
  const matchingAction = workflowAction?.envType === envType ? workflowAction : null;

  if (!matchingContext && !matchingAction) {
    return null;
  }

  const currentProjectPath = projectPath || matchingContext?.projectPath || null;
  const currentProviderLabel = providerLabel || matchingContext?.providerId || null;
  const returnHref = matchingContext?.returnHref || null;
  const logicalEnvType = getLogicalEnvType(envType);
  const envTypeKey = `environments.languages.${logicalEnvType}`;
  const translatedEnvType = t(envTypeKey);
  const envTypeLabel = translatedEnvType === envTypeKey ? envType : translatedEnvType;
  const title = matchingAction
    ? getActionMessage(matchingAction, t)
    : t("environments.workflow.contextTitle", { envType: envTypeLabel });

  return (
    <Alert
      variant={matchingAction?.status === "error" ? "destructive" : "default"}
      className="mt-3"
    >
      <WorkflowIcon action={matchingAction} />
      <AlertTitle>{title}</AlertTitle>
      <AlertDescription>
        {matchingContext && (
          <p>
            {t("environments.workflow.openedFrom", {
              origin: getOriginLabel(matchingContext.origin, t),
            })}
          </p>
        )}
        <p>
          {currentProjectPath
            ? t("environments.workflow.projectPath", { path: currentProjectPath })
            : t("environments.workflow.projectPathCurrent")}
        </p>
        {currentProviderLabel && (
          <p>{t("environments.workflow.provider", { provider: currentProviderLabel })}</p>
        )}
        {matchingAction && (
          <>
            <p>{getStatusHint(matchingAction, t)}</p>
            {matchingAction.error && (
              <p>{t("environments.workflow.errorDetail", { message: matchingAction.error })}</p>
            )}
          </>
        )}
        <div className="mt-2 flex flex-wrap gap-2">
          {returnHref && (
            <Button variant="outline" size="sm" asChild className="gap-2">
              <Link href={returnHref}>
                <ArrowLeft className="h-3.5 w-3.5" />
                {returnHref === "/"
                  ? t("environments.workflow.returnDashboard")
                  : t("environments.workflow.returnEnvironments")}
              </Link>
            </Button>
          )}
          {onRefresh && matchingAction?.status !== "running" && (
            <Button variant="outline" size="sm" onClick={onRefresh} className="gap-2">
              <RefreshCw className="h-3.5 w-3.5" />
              {t("environments.workflow.refresh")}
            </Button>
          )}
          {matchingAction && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => clearWorkflowAction()}
              className="gap-2"
            >
              <X className="h-3.5 w-3.5" />
              {t("environments.workflow.dismiss")}
            </Button>
          )}
          {!matchingAction && matchingContext && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => clearWorkflowContext()}
              className="gap-2"
            >
              <X className="h-3.5 w-3.5" />
              {t("environments.workflow.clearContext")}
            </Button>
          )}
        </div>
      </AlertDescription>
    </Alert>
  );
}
