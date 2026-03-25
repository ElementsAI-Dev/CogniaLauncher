"use client";

import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { openExternal } from "@/lib/tauri";
import {
  ABOUT_SUPPORT_RESOURCES,
  type AboutSupportResource,
  type AboutSupportResourceIcon,
} from "@/lib/constants/about";
import {
  Settings,
  RefreshCw,
  BookOpen,
  Bug,
  MessageSquarePlus,
  FileText,
  ClipboardList,
} from "lucide-react";
import { useFeedbackStore } from "@/lib/stores/feedback";
import { AboutBrandIcon } from "./about-brand-icon";

interface ActionsCardProps {
  loading: boolean;
  isDesktop: boolean;
  onCheckUpdate: () => void;
  onOpenChangelog: () => void;
  onExportDiagnostics: () => void;
  t: (key: string) => string;
}

export function ActionsCard({
  loading,
  isDesktop,
  onCheckUpdate,
  onOpenChangelog,
  onExportDiagnostics,
  t,
}: ActionsCardProps) {
  const { openDialog } = useFeedbackStore();

  const iconMap: Record<AboutSupportResourceIcon, typeof RefreshCw> = {
    refresh: RefreshCw,
    "file-text": FileText,
    "clipboard-list": ClipboardList,
    "book-open": BookOpen,
    bug: Bug,
    "message-square-plus": MessageSquarePlus,
  };

  const resolveLabel = (resource: AboutSupportResource) =>
    resource.displayLabel ?? t(resource.labelKey);

  const resolveDescription = (resource: AboutSupportResource) =>
    !isDesktop && resource.webDescriptionKey
      ? t(resource.webDescriptionKey)
      : t(resource.descriptionKey);

  const handleResourceAction = (resource: AboutSupportResource) => {
    switch (resource.action) {
      case "check_updates":
        onCheckUpdate();
        return;
      case "open_changelog":
        onOpenChangelog();
        return;
      case "export_diagnostics":
        onExportDiagnostics();
        return;
      case "report_bug":
        openDialog({ category: "bug" });
        return;
      case "feature_request":
        openDialog({ category: "feature" });
        return;
      case "open_external":
        if (resource.url) {
          void openExternal(resource.url);
        }
        return;
      default:
        return;
    }
  };

  return (
    <Card
      role="region"
      aria-labelledby="actions-heading"
    >
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Settings className="h-5 w-5 text-foreground" aria-hidden="true" />
          <span id="actions-heading">{t("about.actions")}</span>
        </CardTitle>
        <CardDescription>{t("about.actionsDesc")}</CardDescription>
      </CardHeader>

      <CardContent className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {ABOUT_SUPPORT_RESOURCES.map((resource) => {
            const label = resolveLabel(resource);
            const description = resolveDescription(resource);
            const LucideIcon = resource.icon ? iconMap[resource.icon] : null;

            return (
              <Button
                key={resource.id}
                variant={resource.id === "check_updates" ? "default" : "outline"}
                onClick={() => handleResourceAction(resource)}
                disabled={resource.id === "check_updates" ? loading : undefined}
                title={
                  resource.id === "export_diagnostics" && !isDesktop
                    ? t("diagnostic.webLimited")
                    : undefined
                }
                aria-label={
                  resource.external
                    ? `${label} - ${t("about.openInNewTab")}`
                    : label
                }
                className="h-auto justify-start px-3 py-3 text-left whitespace-normal"
              >
                <div className="flex w-full items-start gap-3">
                  <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-border bg-background/80">
                    {resource.brandIcon ? (
                      <AboutBrandIcon
                        asset={resource.brandIcon}
                        size={16}
                        className="h-4 w-4"
                      />
                    ) : LucideIcon ? (
                      <LucideIcon
                        className={`h-4 w-4 ${
                          resource.id === "check_updates" && loading
                            ? "animate-spin"
                            : ""
                        }`}
                        aria-hidden="true"
                      />
                    ) : null}
                  </div>
                  <div className="flex min-w-0 flex-col gap-1">
                    <span className="text-sm font-medium leading-none">{label}</span>
                    <span className="text-xs leading-5 text-muted-foreground">
                      {description}
                    </span>
                  </div>
                </div>
              </Button>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
