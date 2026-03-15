"use client";

import { RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useLocale } from "@/components/providers/locale-provider";
import type {
  AttentionCenterSettings,
  ProviderHealthMatrixSettings,
  RecentActivityFeedSettings,
  WidgetConfig,
  WidgetSettings,
  WorkspaceTrendsSettings,
} from "@/lib/stores/dashboard";

interface WidgetSettingsToolbarProps {
  widget: WidgetConfig;
  onUpdateSettings: (id: string, settings: WidgetSettings) => void;
  onResetSettings: (id: string) => void;
}

function ToolbarPillButton({
  label,
  onClick,
  testId,
  tooltip,
}: {
  label: string;
  onClick: () => void;
  testId: string;
  tooltip: string;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-5 px-1.5 text-[10px] leading-none"
          onClick={onClick}
          data-testid={testId}
        >
          {label}
        </Button>
      </TooltipTrigger>
      <TooltipContent side="top" className="text-xs">
        {tooltip}
      </TooltipContent>
    </Tooltip>
  );
}

export function WidgetSettingsToolbar({
  widget,
  onUpdateSettings,
  onResetSettings,
}: WidgetSettingsToolbarProps) {
  const { t } = useLocale();

  const renderReset = () => (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-5 w-5"
          onClick={() => onResetSettings(widget.id)}
          data-testid={`widget-settings-reset-${widget.id}`}
          aria-label={t("dashboard.widgets.resetSettings")}
        >
          <RotateCcw className="h-3 w-3" />
        </Button>
      </TooltipTrigger>
      <TooltipContent side="top" className="text-xs">
        {t("dashboard.widgets.resetSettings")}
      </TooltipContent>
    </Tooltip>
  );

  switch (widget.type) {
    case "attention-center": {
      const settings = (widget.settings as AttentionCenterSettings | undefined) ?? { maxItems: 3 };
      const nextMaxItems = settings.maxItems === 3 ? 5 : 3;

      return (
        <>
          <ToolbarPillButton
            label={t("dashboard.widgets.settingsTopCount", { count: settings.maxItems })}
            tooltip={t("dashboard.widgets.toggleAttentionLimit")}
            testId={`widget-settings-limit-${widget.id}`}
            onClick={() => onUpdateSettings(widget.id, { maxItems: nextMaxItems })}
          />
          {renderReset()}
        </>
      );
    }
    case "workspace-trends": {
      const settings = (widget.settings as WorkspaceTrendsSettings | undefined) ?? {
        range: "7d",
        metric: "installations",
      };
      const nextRange = settings.range === "7d" ? "30d" : "7d";
      const nextMetric =
        settings.metric === "installations"
          ? "downloads"
          : settings.metric === "downloads"
            ? "updates"
            : "installations";

      return (
        <>
          <ToolbarPillButton
            label={settings.range}
            tooltip={t("dashboard.widgets.toggleTrendRange")}
            testId={`widget-settings-range-${widget.id}`}
            onClick={() => onUpdateSettings(widget.id, { ...settings, range: nextRange })}
          />
          <ToolbarPillButton
            label={t(`dashboard.widgets.settingsMetric_${settings.metric}`)}
            tooltip={t("dashboard.widgets.toggleTrendMetric")}
            testId={`widget-settings-metric-${widget.id}`}
            onClick={() => onUpdateSettings(widget.id, { ...settings, metric: nextMetric })}
          />
          {renderReset()}
        </>
      );
    }
    case "provider-health-matrix": {
      const settings = (widget.settings as ProviderHealthMatrixSettings | undefined) ?? {
        groupBy: "provider",
        showHealthy: true,
      };
      const nextGroupBy = settings.groupBy === "provider" ? "environment" : "provider";

      return (
        <>
          <ToolbarPillButton
            label={t(`dashboard.widgets.settingsGroupBy_${settings.groupBy}`)}
            tooltip={t("dashboard.widgets.toggleHealthGrouping")}
            testId={`widget-settings-group-${widget.id}`}
            onClick={() => onUpdateSettings(widget.id, { ...settings, groupBy: nextGroupBy })}
          />
          <ToolbarPillButton
            label={settings.showHealthy
              ? t("dashboard.widgets.settingsHideHealthy")
              : t("dashboard.widgets.settingsShowHealthy")}
            tooltip={t("dashboard.widgets.toggleHealthyVisibility")}
            testId={`widget-settings-healthy-${widget.id}`}
            onClick={() => onUpdateSettings(widget.id, { ...settings, showHealthy: !settings.showHealthy })}
          />
          {renderReset()}
        </>
      );
    }
    case "recent-activity-feed": {
      const settings = (widget.settings as RecentActivityFeedSettings | undefined) ?? { limit: 5 };
      const nextLimit = settings.limit === 5 ? 10 : 5;

      return (
        <>
          <ToolbarPillButton
            label={t("dashboard.widgets.settingsItemLimit", { count: settings.limit })}
            tooltip={t("dashboard.widgets.toggleActivityLimit")}
            testId={`widget-settings-limit-${widget.id}`}
            onClick={() => onUpdateSettings(widget.id, { limit: nextLimit })}
          />
          {renderReset()}
        </>
      );
    }
    default:
      return null;
  }
}
