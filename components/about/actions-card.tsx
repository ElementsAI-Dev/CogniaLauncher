"use client";

import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { openExternal } from "@/lib/tauri";
import {
  Settings,
  RefreshCw,
  Github,
  BookOpen,
  Bug,
  MessageSquarePlus,
  FileText,
} from "lucide-react";

interface ActionsCardProps {
  loading: boolean;
  onCheckUpdate: () => void;
  onOpenChangelog: () => void;
  t: (key: string) => string;
}

export function ActionsCard({
  loading,
  onCheckUpdate,
  onOpenChangelog,
  t,
}: ActionsCardProps) {
  const handleOpen = (url: string) => () => {
    void openExternal(url);
  };

  return (
    <Card
      role="region"
      aria-labelledby="actions-heading"
    >
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Settings className="h-5 w-5 text-foreground" aria-hidden="true" />
          <span id="actions-heading">{t("about.actions")}</span>
        </CardTitle>
        <CardDescription>{t("about.actionsDesc")}</CardDescription>
      </CardHeader>

      <CardContent>
        <div className="flex flex-wrap gap-3">
          {/* Check for Updates */}
          <Button
            variant="default"
            onClick={onCheckUpdate}
            disabled={loading}
          >
            <RefreshCw
              className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`}
              aria-hidden="true"
            />
            {t("about.checkForUpdates")}
          </Button>

          {/* Changelog */}
          <Button variant="outline" onClick={onOpenChangelog}>
            <FileText className="h-4 w-4 mr-2" aria-hidden="true" />
            {t("about.changelog")}
          </Button>

          {/* GitHub */}
          <Button
            variant="outline"
            onClick={handleOpen(
              "https://github.com/ElementAstro/CogniaLauncher",
            )}
            aria-label={`GitHub - ${t("about.openInNewTab")}`}
          >
            <Github className="h-4 w-4 mr-2" aria-hidden="true" />
            GitHub
          </Button>

          {/* Documentation */}
          <Button
            variant="outline"
            onClick={handleOpen("https://cognia.dev/docs")}
            aria-label={`${t("about.documentation")} - ${t("about.openInNewTab")}`}
          >
            <BookOpen className="h-4 w-4 mr-2" aria-hidden="true" />
            {t("about.documentation")}
          </Button>

          {/* Report Bug */}
          <Button
            variant="outline"
            onClick={handleOpen(
              "https://github.com/ElementAstro/CogniaLauncher/issues/new?template=bug_report.md",
            )}
            aria-label={`${t("about.reportBug")} - ${t("about.openInNewTab")}`}
          >
            <Bug className="h-4 w-4 mr-2" aria-hidden="true" />
            {t("about.reportBug")}
          </Button>

          {/* Feature Request */}
          <Button
            variant="outline"
            onClick={handleOpen(
              "https://github.com/ElementAstro/CogniaLauncher/discussions/new?category=ideas",
            )}
            aria-label={`${t("about.featureRequest")} - ${t("about.openInNewTab")}`}
          >
            <MessageSquarePlus className="h-4 w-4 mr-2" aria-hidden="true" />
            {t("about.featureRequest")}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
