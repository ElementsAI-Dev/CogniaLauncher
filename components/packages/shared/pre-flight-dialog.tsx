"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useLocale } from "@/components/providers/locale-provider";
import type { PackagePreflightSummary } from "@/lib/tauri";

interface PreFlightDialogProps {
  open: boolean;
  packages: string[];
  summary: PackagePreflightSummary | null;
  onConfirm: () => void;
  onOpenChange: (open: boolean) => void;
}

function countResults(summary: PackagePreflightSummary, status: "pass" | "warning" | "failure") {
  return summary.results.filter((result) => result.status === status).length;
}

export function PreFlightDialog({
  open,
  packages,
  summary,
  onConfirm,
  onOpenChange,
}: PreFlightDialogProps) {
  const { t } = useLocale();

  if (!summary) {
    return null;
  }

  const passCount = countResults(summary, "pass");
  const warningCount = countResults(summary, "warning");
  const failureCount = countResults(summary, "failure");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85dvh] max-w-2xl overflow-hidden">
        <DialogHeader>
          <DialogTitle>{t("packages.preflight.title")}</DialogTitle>
          <DialogDescription>
            {t("packages.preflight.description")}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap gap-2">
          <Badge variant="secondary">
            {t("packages.preflight.passCount", { count: passCount })}
          </Badge>
          <Badge variant="secondary">
            {t("packages.preflight.warningCount", { count: warningCount })}
          </Badge>
          <Badge variant={summary.has_failures ? "destructive" : "secondary"}>
            {t("packages.preflight.failureCount", { count: failureCount })}
          </Badge>
        </div>

        <div className="space-y-2 text-sm">
          <div className="font-medium">{t("packages.preflight.packages")}</div>
          <div className="flex flex-wrap gap-2">
            {packages.map((pkg) => (
              <code
                key={pkg}
                className="rounded bg-muted px-2 py-1 text-xs text-muted-foreground"
              >
                {pkg}
              </code>
            ))}
          </div>
        </div>

        {summary.has_failures ? (
          <div className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
            {t("packages.preflight.blockingMessage")}
          </div>
        ) : null}

        <ScrollArea className="max-h-[45dvh] pr-4">
          <div className="space-y-3">
            {summary.results.map((result) => (
              <div
                key={`${result.validator_id}:${result.package ?? "all"}`}
                className="rounded-lg border p-3"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <div className="font-medium">{result.validator_name}</div>
                  <Badge
                    variant={
                      result.status === "failure"
                        ? "destructive"
                        : result.status === "warning"
                          ? "secondary"
                          : "outline"
                    }
                  >
                    {result.status}
                  </Badge>
                  {result.package ? (
                    <code className="rounded bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                      {result.package}
                    </code>
                  ) : null}
                </div>
                <div className="mt-2 text-sm">{result.summary}</div>
                {result.details.length > 0 ? (
                  <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                    {result.details.map((detail) => (
                      <li key={detail}>{detail}</li>
                    ))}
                  </ul>
                ) : null}
                {result.remediation ? (
                  <div className="mt-2 text-sm text-muted-foreground">
                    {result.remediation}
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        </ScrollArea>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t("packages.preflight.cancel")}
          </Button>
          <Button onClick={onConfirm} disabled={!summary.can_proceed}>
            {t("packages.preflight.confirm")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
