"use client";

import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

interface PageLoadingSkeletonProps {
  variant?: "dashboard" | "list" | "cards" | "settings" | "detail" | "tabs";
}

const cardClass = (i: number) => `skeleton-card-${i}` as const;

export function PageLoadingSkeleton({
  variant = "list",
}: PageLoadingSkeletonProps) {
  if (variant === "dashboard") {
    return (
      <div className="p-4 md:p-6 space-y-6 skeleton-shimmer" role="status" aria-busy="true" aria-label="Loading...">
        <div className="flex items-center justify-between skeleton-card-1">
          <div className="space-y-2">
            <Skeleton className="h-7 w-40" />
            <Skeleton className="h-4 w-64" />
          </div>
          <div className="flex gap-2">
            <Skeleton className="h-9 w-28 rounded-lg" />
            <Skeleton className="h-9 w-28 rounded-lg" />
          </div>
        </div>
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i} className={`${cardClass(i)} overflow-hidden`}>
              <CardHeader className="pb-2">
                <Skeleton className="h-4 w-24 rounded-md" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-20 rounded-md" />
                <Skeleton className="h-3 w-32 mt-2 rounded-md" />
              </CardContent>
            </Card>
          ))}
        </div>
        <div className="grid gap-4 grid-cols-1 lg:grid-cols-2">
          {[5, 6].map((i) => (
            <Card key={i} className={`${cardClass(i)} overflow-hidden`}>
              <CardHeader>
                <Skeleton className="h-5 w-32 rounded-md" />
              </CardHeader>
              <CardContent className="space-y-3">
                {[1, 2, 3].map((j) => (
                  <Skeleton key={j} className="h-10 w-full rounded-lg" />
                ))}
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (variant === "cards") {
    return (
      <div className="p-4 md:p-6 space-y-6 skeleton-shimmer" role="status" aria-busy="true" aria-label="Loading...">
        <div className="flex items-center justify-between skeleton-card-1">
          <div className="space-y-2">
            <Skeleton className="h-7 w-40" />
            <Skeleton className="h-4 w-64" />
          </div>
          <Skeleton className="h-9 w-32 rounded-lg" />
        </div>
        <div className="grid gap-4 grid-cols-1 lg:grid-cols-2">
          {[2, 3, 4, 5].map((i) => (
            <Card key={i} className={`${cardClass(i)} overflow-hidden`}>
              <CardHeader>
                <Skeleton className="h-6 w-24 rounded-md" />
                <Skeleton className="h-4 w-32 rounded-md" />
              </CardHeader>
              <CardContent className="space-y-4">
                <Skeleton className="h-8 w-full rounded-lg" />
                <Skeleton className="h-10 w-full rounded-lg" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (variant === "settings") {
    return (
      <div className="p-4 md:p-6 space-y-6 skeleton-shimmer" role="status" aria-busy="true" aria-label="Loading...">
        <div className="space-y-2 skeleton-card-1">
          <Skeleton className="h-7 w-32" />
          <Skeleton className="h-4 w-56" />
        </div>
        {[2, 3, 4].map((i) => (
          <Card key={i} className={`${cardClass(i)} overflow-hidden`}>
            <CardHeader>
              <Skeleton className="h-6 w-28 rounded-md" />
              <Skeleton className="h-4 w-48 mt-1 rounded-md" />
            </CardHeader>
            <CardContent className="space-y-4">
              {[1, 2].map((j) => (
                <div key={j} className="flex items-center justify-between py-3">
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-36 rounded-md" />
                    <Skeleton className="h-3 w-56 rounded-md" />
                  </div>
                  <Skeleton className="h-9 w-48 rounded-lg" />
                </div>
              ))}
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (variant === "detail") {
    return (
      <div className="p-4 md:p-6 space-y-6 skeleton-shimmer" role="status" aria-busy="true" aria-label="Loading...">
        <div className="flex items-center gap-4 skeleton-card-1">
          <Skeleton className="h-12 w-12 rounded-xl" />
          <div className="space-y-2">
            <Skeleton className="h-7 w-48" />
            <Skeleton className="h-4 w-72" />
          </div>
        </div>
        <div className="grid gap-4 grid-cols-1 lg:grid-cols-3">
          {[2, 3, 4].map((i) => (
            <Card key={i} className={`${cardClass(i)} overflow-hidden`}>
              <CardContent className="pt-6">
                <Skeleton className="h-4 w-20 mb-2 rounded-md" />
                <Skeleton className="h-6 w-32 rounded-md" />
              </CardContent>
            </Card>
          ))}
        </div>
        <Card className="skeleton-card-5 overflow-hidden">
          <CardContent className="pt-6 space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-12 w-full rounded-lg" />
            ))}
          </CardContent>
        </Card>
      </div>
    );
  }

  if (variant === "tabs") {
    return (
      <div className="p-4 md:p-6 space-y-6 skeleton-shimmer" role="status" aria-busy="true" aria-label="Loading...">
        <div className="space-y-2 skeleton-card-1">
          <Skeleton className="h-7 w-40" />
          <Skeleton className="h-4 w-64" />
        </div>
        <Skeleton className="h-10 w-80 rounded-lg skeleton-card-2" />
        <div className="space-y-4">
          {[3, 4, 5].map((i) => (
            <Card key={i} className={`${cardClass(i)} overflow-hidden`}>
              <CardHeader>
                <Skeleton className="h-5 w-32 rounded-md" />
              </CardHeader>
              <CardContent className="space-y-2">
                <Skeleton className="h-4 w-full rounded-md" />
                <Skeleton className="h-4 w-3/4 rounded-md" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  // Default: list variant
  return (
    <div className="p-4 md:p-6 space-y-6 skeleton-shimmer" role="status" aria-busy="true" aria-label="Loading...">
      <div className="flex items-center justify-between skeleton-card-1">
        <div className="space-y-2">
          <Skeleton className="h-7 w-40" />
          <Skeleton className="h-4 w-64" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-9 w-24 rounded-lg" />
          <Skeleton className="h-9 w-24 rounded-lg" />
        </div>
      </div>
      <div className="flex items-center gap-3 skeleton-card-2">
        <Skeleton className="h-10 flex-1 rounded-lg" />
        <Skeleton className="h-10 w-32 rounded-lg" />
      </div>
      <div className="space-y-3">
        {[3, 4, 5, 6].map((i) => (
          <Skeleton key={i} className={`${cardClass(i)} h-16 w-full rounded-lg`} />
        ))}
      </div>
    </div>
  );
}
