"use client";

import { useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Copy, Play, Search } from "lucide-react";
import { getAlertVariant, getSeverityIcon } from "@/lib/provider-utils";
import type { HealthIssue, HealthRemediationResult, Severity } from "@/types/tauri";

function renderSeverityIcon(severity: Severity) {
  const Icon = getSeverityIcon(severity);
  return <Icon className="h-4 w-4" />;
}

export interface IssueCardProps {
  issue: HealthIssue;
  onCopy?: (text: string) => void;
  onPreviewRemediation?: (issue: Pick<HealthIssue, "remediation_id">) => Promise<HealthRemediationResult | null>;
  onApplyRemediation?: (issue: Pick<HealthIssue, "remediation_id">) => Promise<HealthRemediationResult | null>;
  activeRemediationId?: string | null;
  t: (key: string, params?: Record<string, string | number>) => string;
}

export function IssueCard({
  issue,
  onCopy,
  onPreviewRemediation,
  onApplyRemediation,
  activeRemediationId,
  t,
}: IssueCardProps) {
  const [remediationResult, setRemediationResult] = useState<HealthRemediationResult | null>(null);
  const isRunning = activeRemediationId != null && activeRemediationId === issue.remediation_id;

  return (
    <Alert variant={getAlertVariant(issue.severity)} className="text-sm">
      {renderSeverityIcon(issue.severity)}
      <AlertTitle className="text-sm font-medium">{issue.message}</AlertTitle>
      <AlertDescription>
        {issue.details && (
          <p className="text-xs mt-1 opacity-80">{issue.details}</p>
        )}
        {issue.fix_command && (
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <code className="text-xs bg-black/10 dark:bg-white/10 px-2 py-1 rounded">
              {issue.fix_command}
            </code>
            {onCopy && (
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0"
                onClick={() => onCopy(issue.fix_command!)}
                title={t("copyCommand")}
              >
                <Copy className="h-3 w-3" />
              </Button>
            )}
            {issue.remediation_id && onPreviewRemediation && (
              <Button
                variant="outline"
                size="sm"
                className="h-6 gap-1 px-2"
                disabled={isRunning}
                onClick={async () => {
                  const result = await onPreviewRemediation({ remediation_id: issue.remediation_id ?? null });
                  setRemediationResult(result);
                }}
              >
                <Search className="h-3 w-3" />
                {t("previewFix")}
              </Button>
            )}
            {issue.remediation_id && onApplyRemediation && (
              <Button
                variant="outline"
                size="sm"
                className="h-6 gap-1 px-2"
                disabled={isRunning}
                onClick={async () => {
                  const result = await onApplyRemediation({ remediation_id: issue.remediation_id ?? null });
                  setRemediationResult(result);
                }}
              >
                <Play className="h-3 w-3" />
                {t("applyFix")}
              </Button>
            )}
          </div>
        )}
        {issue.fix_description && (
          <p className="text-xs mt-1 text-muted-foreground">
            {issue.fix_description}
          </p>
        )}
        {remediationResult && (
          <div className="mt-2 rounded border bg-muted/40 px-2 py-1 text-xs">
            <p className="font-medium">{remediationResult.message}</p>
            {remediationResult.command && (
              <code className="mt-1 block whitespace-pre-wrap">
                {remediationResult.command}
              </code>
            )}
          </div>
        )}
      </AlertDescription>
    </Alert>
  );
}
