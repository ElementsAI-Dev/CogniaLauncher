"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { FileText, Calendar, Tag } from "lucide-react";
import type { ChangelogEntry } from "@/lib/constants/about";

interface ChangelogDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entries: ChangelogEntry[];
  t: (key: string) => string;
}

function getTypeColor(type: string): string {
  switch (type) {
    case "added":
      return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400";
    case "changed":
      return "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400";
    case "fixed":
      return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400";
    case "removed":
      return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400";
    default:
      return "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400";
  }
}

function getTypeLabel(type: string, t: (key: string) => string): string {
  switch (type) {
    case "added":
      return t("about.changelogAdded");
    case "changed":
      return t("about.changelogChanged");
    case "fixed":
      return t("about.changelogFixed");
    case "removed":
      return t("about.changelogRemoved");
    default:
      return type;
  }
}

export function ChangelogDialog({
  open,
  onOpenChange,
  entries,
  t,
}: ChangelogDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" aria-hidden="true" />
            {t("about.changelog")}
          </DialogTitle>
          <DialogDescription>
            {t("about.changelogDescription")}
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="h-[50vh] pr-4">
          <div className="space-y-6">
            {entries.map((entry) => (
              <article key={entry.version} className="space-y-3">
                <header className="flex items-center gap-3 pb-2 border-b">
                  <div className="flex items-center gap-1.5">
                    <Tag
                      className="h-4 w-4 text-muted-foreground"
                      aria-hidden="true"
                    />
                    <span className="font-semibold text-foreground">
                      v{entry.version}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                    <Calendar className="h-3.5 w-3.5" aria-hidden="true" />
                    <time dateTime={entry.date}>{entry.date}</time>
                  </div>
                </header>

                <ul
                  className="space-y-2"
                  aria-label={`Changes in version ${entry.version}`}
                >
                  {entry.changes.map((change, index) => (
                    <li key={index} className="flex items-start gap-2">
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
              </article>
            ))}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
