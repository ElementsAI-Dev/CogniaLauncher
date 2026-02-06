"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Server, SearchX, FilterX } from "lucide-react";

export interface ProviderEmptyStateProps {
  hasFilters: boolean;
  onClearFilters: () => void;
  t: (key: string) => string;
}

export function ProviderEmptyState({
  hasFilters,
  onClearFilters,
  t,
}: ProviderEmptyStateProps) {
  if (hasFilters) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center py-12 text-center">
          <div className="rounded-full bg-muted p-4 mb-4">
            <SearchX className="h-8 w-8 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-semibold mb-2">
            {t("providers.noResults")}
          </h3>
          <p className="text-sm text-muted-foreground mb-4 max-w-sm">
            {t("providers.noResultsDesc")}
          </p>
          <Button variant="outline" onClick={onClearFilters} className="gap-2">
            <FilterX className="h-4 w-4" />
            {t("providers.clearFilters")}
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-dashed">
      <CardContent className="flex flex-col items-center justify-center py-12 text-center">
        <div className="rounded-full bg-muted p-4 mb-4">
          <Server className="h-8 w-8 text-muted-foreground" />
        </div>
        <h3 className="text-lg font-semibold mb-2">
          {t("providers.noProviders")}
        </h3>
        <p className="text-sm text-muted-foreground max-w-sm">
          {t("providers.noProvidersDesc")}
        </p>
      </CardContent>
    </Card>
  );
}
