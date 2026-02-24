"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Sparkles,
  Calendar,
  Tag,
  ExternalLink,
  FileText,
} from "lucide-react";
import { MarkdownRenderer } from "@/components/docs/markdown-renderer";
import { getTypeColor, getTypeLabel } from "@/lib/constants/changelog-utils";
import type { ChangelogEntry } from "@/lib/constants/about";

interface WhatsNewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entries: ChangelogEntry[];
  loading?: boolean;
  onDismiss: () => void;
  onShowFullChangelog: () => void;
  t: (key: string) => string;
}

export function WhatsNewDialog({
  open,
  onOpenChange,
  entries,
  loading = false,
  onDismiss,
  onShowFullChangelog,
  t,
}: WhatsNewDialogProps) {
  if (!open || (entries.length === 0 && !loading)) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-amber-500" aria-hidden="true" />
            {t("about.changelogWhatsNew")}
          </DialogTitle>
          <DialogDescription>
            {t("about.changelogWhatsNewDesc")}
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[45vh] pr-4">
          {loading && entries.length === 0 ? (
            <div className="space-y-4">
              {[1, 2].map((i) => (
                <div key={i} className="space-y-2">
                  <Skeleton className="h-5 w-24" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-3/4" />
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-5">
              {entries.map((entry, idx) => (
                <article key={entry.version} className="space-y-2">
                  {idx > 0 && <Separator className="mb-3" />}
                  <header className="flex items-center gap-2 flex-wrap">
                    <div className="flex items-center gap-1.5">
                      <Tag className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
                      <span className="font-semibold text-foreground">
                        v{entry.version}
                      </span>
                    </div>
                    {entry.prerelease && (
                      <Badge
                        variant="outline"
                        className="text-[10px] px-1.5 py-0 h-5 border-amber-300 text-amber-600 dark:text-amber-400"
                      >
                        {t("about.changelogPrerelease")}
                      </Badge>
                    )}
                    <div className="flex items-center gap-1 text-xs text-muted-foreground ml-auto">
                      <Calendar className="h-3 w-3" aria-hidden="true" />
                      <time dateTime={entry.date}>{entry.date}</time>
                    </div>
                  </header>

                  {entry.markdownBody && (
                    <div className="rounded-md border bg-muted/30 p-3 text-sm">
                      <MarkdownRenderer
                        content={entry.markdownBody}
                        className="prose-sm"
                      />
                    </div>
                  )}

                  {entry.changes.length > 0 && (
                    <ul className="space-y-1.5">
                      {entry.changes.map((change, i) => (
                        <li key={i} className="flex items-start gap-2">
                          <Badge
                            variant="secondary"
                            className={`text-[10px] px-1.5 py-0 h-5 flex-shrink-0 ${getTypeColor(change.type)}`}
                          >
                            {getTypeLabel(change.type, t)}
                          </Badge>
                          <span className="text-sm text-foreground">
                            {change.description}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}

                  {entry.url && (
                    <a
                      href={entry.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <ExternalLink className="h-3 w-3" aria-hidden="true" />
                      {t("about.changelogViewOnGithub")}
                    </a>
                  )}
                </article>
              ))}
            </div>
          )}
        </ScrollArea>

        <DialogFooter className="flex-row gap-2 sm:justify-between">
          <Button variant="ghost" size="sm" onClick={onShowFullChangelog}>
            <FileText className="h-4 w-4 mr-1.5" aria-hidden="true" />
            {t("about.changelogShowAll")}
          </Button>
          <Button variant="default" size="sm" onClick={onDismiss}>
            {t("about.changelogGotIt")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
