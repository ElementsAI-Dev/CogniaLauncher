"use client";

import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { openExternal } from "@/lib/tauri";
import { ABOUT_BRANDED_EXTERNAL_LINKS } from "@/lib/constants/about";
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
  const githubLink = ABOUT_BRANDED_EXTERNAL_LINKS.find((link) => link.id === "github");
  const handleOpen = (url: string) => () => {
    void openExternal(url);
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
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {/* Check for Updates */}
          <Button
            variant="default"
            onClick={onCheckUpdate}
            disabled={loading}
            className="justify-start"
          >
            <RefreshCw
              className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`}
              aria-hidden="true"
            />
            {t("about.checkForUpdates")}
          </Button>

          {/* Changelog */}
          <Button variant="outline" onClick={onOpenChangelog} className="justify-start">
            <FileText className="h-4 w-4 mr-2" aria-hidden="true" />
            {t("about.changelog")}
          </Button>

          {/* Export Diagnostics — works in both desktop (ZIP) and web (JSON) */}
          <Button
            variant="outline"
            onClick={onExportDiagnostics}
            title={!isDesktop ? t("diagnostic.webLimited") : undefined}
            className="justify-start"
          >
            <ClipboardList className="h-4 w-4 mr-2" aria-hidden="true" />
            {t("about.exportDiagnostics")}
          </Button>

          {/* GitHub */}
          {githubLink ? (
            <Button
              variant="outline"
              onClick={handleOpen(githubLink.url)}
              aria-label={`${githubLink.label} - ${t("about.openInNewTab")}`}
              className="justify-start"
            >
              <AboutBrandIcon
                asset={githubLink.icon}
                size={16}
                className="mr-2 h-4 w-4"
              />
              {githubLink.label}
            </Button>
          ) : null}

          {/* Documentation */}
          <Button
            variant="outline"
            onClick={handleOpen("https://cognia.dev/docs")}
            aria-label={`${t("about.documentation")} - ${t("about.openInNewTab")}`}
            className="justify-start"
          >
            <BookOpen className="h-4 w-4 mr-2" aria-hidden="true" />
            {t("about.documentation")}
          </Button>

          {/* Report Bug */}
          <Button
            variant="outline"
            onClick={() => openDialog({ category: "bug" })}
            aria-label={t("about.reportBug")}
            className="justify-start"
          >
            <Bug className="h-4 w-4 mr-2" aria-hidden="true" />
            {t("about.reportBug")}
          </Button>

          {/* Feature Request */}
          <Button
            variant="outline"
            onClick={() => openDialog({ category: "feature" })}
            aria-label={t("about.featureRequest")}
            className="justify-start"
          >
            <MessageSquarePlus className="h-4 w-4 mr-2" aria-hidden="true" />
            {t("about.featureRequest")}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
