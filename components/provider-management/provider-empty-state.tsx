"use client";

import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
  EmptyContent,
} from "@/components/ui/empty";
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
      <Empty className="border-dashed border">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <SearchX />
          </EmptyMedia>
          <EmptyTitle>{t("providers.noResults")}</EmptyTitle>
          <EmptyDescription>{t("providers.noResultsDesc")}</EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button variant="outline" onClick={onClearFilters} className="gap-2">
            <FilterX className="h-4 w-4" />
            {t("providers.clearFilters")}
          </Button>
        </EmptyContent>
      </Empty>
    );
  }

  return (
    <Empty className="border-dashed border">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <Server />
        </EmptyMedia>
        <EmptyTitle>{t("providers.noProviders")}</EmptyTitle>
        <EmptyDescription>{t("providers.noProvidersDesc")}</EmptyDescription>
      </EmptyHeader>
    </Empty>
  );
}
