"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowDownToLine, SearchX, FilterX } from "lucide-react";

export interface DownloadEmptyStateProps {
  hasFilters: boolean;
  onClearFilters: () => void;
  t: (key: string) => string;
}

export function DownloadEmptyState({
  hasFilters,
  onClearFilters,
  t,
}: DownloadEmptyStateProps) {
  if (hasFilters) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center py-12 text-center">
          <div className="rounded-full bg-muted p-4 mb-4">
            <SearchX className="h-8 w-8 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-semibold mb-2">
            {t("downloads.toolbar.noResults")}
          </h3>
          <p className="text-sm text-muted-foreground mb-4 max-w-sm">
            {t("downloads.toolbar.noResultsDesc")}
          </p>
          <Button variant="outline" onClick={onClearFilters} className="gap-2">
            <FilterX className="h-4 w-4" />
            {t("downloads.toolbar.clearFilters")}
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-dashed">
      <CardContent className="flex flex-col items-center justify-center py-12 text-muted-foreground">
        <ArrowDownToLine className="h-12 w-12 mb-4 opacity-50" />
        <p className="text-sm font-medium">{t("downloads.noTasks")}</p>
        <p className="text-xs">{t("downloads.noTasksDesc")}</p>
      </CardContent>
    </Card>
  );
}
