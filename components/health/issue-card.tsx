"use client";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Copy } from "lucide-react";
import { getAlertVariant, getSeverityIcon } from "@/lib/provider-utils";
import type { HealthIssue, Severity } from "@/types/tauri";

function renderSeverityIcon(severity: Severity) {
  const Icon = getSeverityIcon(severity);
  return <Icon className="h-4 w-4" />;
}

export interface IssueCardProps {
  issue: HealthIssue;
  onCopy?: (text: string) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
}

export function IssueCard({ issue, onCopy, t }: IssueCardProps) {
  return (
    <Alert variant={getAlertVariant(issue.severity)} className="text-sm">
      {renderSeverityIcon(issue.severity)}
      <AlertTitle className="text-sm font-medium">{issue.message}</AlertTitle>
      <AlertDescription>
        {issue.details && (
          <p className="text-xs mt-1 opacity-80">{issue.details}</p>
        )}
        {issue.fix_command && (
          <div className="mt-2 flex items-center gap-2">
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
          </div>
        )}
        {issue.fix_description && (
          <p className="text-xs mt-1 text-muted-foreground">
            {issue.fix_description}
          </p>
        )}
      </AlertDescription>
    </Alert>
  );
}
