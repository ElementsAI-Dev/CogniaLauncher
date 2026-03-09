"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useLocale } from "@/components/providers/locale-provider";
import { getToolboxDetailPath } from "@/lib/toolbox-route";
import type { ToolboxMarketplaceResolvedListing } from "@/types/toolbox-marketplace";

interface MarketplaceListingCardProps {
  listing: ToolboxMarketplaceResolvedListing;
  busy?: boolean;
  onInstall: (
    listing: ToolboxMarketplaceResolvedListing,
  ) => void | Promise<unknown>;
  onUpdate: (
    listing: ToolboxMarketplaceResolvedListing,
  ) => void | Promise<unknown>;
}

export function MarketplaceListingCard({
  listing,
  busy = false,
  onInstall,
  onUpdate,
}: MarketplaceListingCardProps) {
  const { t } = useLocale();
  const primaryToolHref = listing.tools[0]
    ? getToolboxDetailPath(
        `plugin:${listing.pluginId}:${listing.tools[0].toolId}`,
      )
    : null;
  const updatedLabel = listing.updatedAt
    ? listing.updatedAt.slice(0, 10)
    : null;

  return (
    <Card className="h-full">
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center gap-2">
          <CardTitle className="text-base">{listing.name}</CardTitle>
          <Badge variant="outline">v{listing.version}</Badge>
          {listing.featured && (
            <Badge variant="secondary">
              {t("toolbox.marketplace.featuredBadge")}
            </Badge>
          )}
          <Badge variant="secondary">{listing.category}</Badge>
        </div>
        <CardDescription>{listing.description}</CardDescription>
        {(listing.publisher ||
          listing.installCount !== null ||
          updatedLabel ||
          listing.highlights.length > 0) && (
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            {listing.publisher && <span>{listing.publisher.name}</span>}
            {listing.publisher?.verified && (
              <Badge variant="secondary">
                {t("toolbox.marketplace.verifiedPublisher")}
              </Badge>
            )}
            {listing.installCount !== null && (
              <span>
                {t("toolbox.marketplace.installCount", {
                  count: String(listing.installCount),
                })}
              </span>
            )}
            {updatedLabel && (
              <span>
                {t("toolbox.marketplace.updatedAt", { date: updatedLabel })}
              </span>
            )}
            {listing.highlights[0] && <span>{listing.highlights[0]}</span>}
          </div>
        )}
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <div className="flex flex-wrap gap-2 text-xs">
          <Badge variant="secondary">
            {t(`toolbox.marketplace.state.${listing.installState}`)}
          </Badge>
          <Badge variant="outline">{listing.source.storeId}</Badge>
        </div>
        {listing.blockedReason && (
          <p className="rounded-md border border-amber-300/50 bg-amber-50/60 px-2 py-1.5 text-xs text-amber-800 dark:border-amber-700/40 dark:bg-amber-950/20 dark:text-amber-200">
            {listing.blockedReason}
          </p>
        )}
        <div className="space-y-1">
          {listing.tools.slice(0, 3).map((tool) => (
            <div
              key={tool.toolId}
              className="flex items-center justify-between gap-2 text-xs"
            >
              <span className="truncate font-medium">{tool.name}</span>
              <span className="shrink-0 text-muted-foreground">
                {tool.uiMode}
              </span>
            </div>
          ))}
        </div>
      </CardContent>
      <CardFooter className="flex flex-wrap gap-2 pt-0">
        <Button size="sm" variant="outline" asChild>
          <Link href={`/toolbox/market/${encodeURIComponent(listing.id)}`}>
            {t("toolbox.marketplace.details")}
          </Link>
        </Button>
        {listing.installState === "blocked" ? (
          <Button size="sm" disabled>
            {t("toolbox.marketplace.unavailable")}
          </Button>
        ) : listing.installState === "disabled" ? (
          <Button size="sm" variant="outline" asChild>
            <Link href="/toolbox/plugins">
              {t("toolbox.marketplace.managePlugin")}
            </Link>
          </Button>
        ) : listing.installState === "update-available" ? (
          <>
            <Button size="sm" disabled={busy} onClick={() => void onUpdate(listing)}>
              {busy ? "Working..." : t("toolbox.marketplace.update")}
            </Button>
            <Button size="sm" variant="outline" asChild>
              <Link href="/toolbox/plugins">
                {t("toolbox.marketplace.managePlugin")}
              </Link>
            </Button>
          </>
        ) : listing.installState === "installed" ? (
          <>
            {primaryToolHref ? (
              <Button size="sm" asChild>
                <Link href={primaryToolHref}>
                  {t("toolbox.marketplace.openInstalledTool")}
                </Link>
              </Button>
            ) : (
              <Button size="sm" variant="outline" asChild>
                <Link href="/toolbox/plugins">
                  {t("toolbox.marketplace.managePlugin")}
                </Link>
              </Button>
            )}
            <Button size="sm" variant="outline" asChild>
              <Link href="/toolbox/plugins">
                {t("toolbox.marketplace.managePlugin")}
              </Link>
            </Button>
          </>
        ) : (
          <Button size="sm" disabled={busy} onClick={() => void onInstall(listing)}>
            {busy ? "Working..." : t("toolbox.marketplace.install")}
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}
