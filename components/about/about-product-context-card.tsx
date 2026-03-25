"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Blocks, Package, ShieldCheck, Info } from "lucide-react";
import {
  ABOUT_DIAGNOSTIC_GUIDANCE,
  ABOUT_PRODUCT_HIGHLIGHTS,
} from "@/lib/constants/about";

interface AboutProductContextCardProps {
  isDesktop: boolean;
  t: (key: string) => string;
}

function getHighlightIcon(id: (typeof ABOUT_PRODUCT_HIGHLIGHTS)[number]["id"]) {
  switch (id) {
    case "environments":
      return Package;
    case "providers":
      return Blocks;
    case "support":
    default:
      return ShieldCheck;
  }
}

export function AboutProductContextCard({
  isDesktop,
  t,
}: AboutProductContextCardProps) {
  const runtimeDescription = isDesktop
    ? t(ABOUT_DIAGNOSTIC_GUIDANCE.desktopDescriptionKey)
    : t(ABOUT_DIAGNOSTIC_GUIDANCE.webDescriptionKey);

  return (
    <Card role="region" aria-labelledby="about-product-context-heading">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Info className="h-5 w-5 text-foreground" aria-hidden="true" />
          <span id="about-product-context-heading">{t("about.productContextTitle")}</span>
        </CardTitle>
        <CardDescription>{t("about.productContextDesc")}</CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="grid gap-3 lg:grid-cols-3">
          {ABOUT_PRODUCT_HIGHLIGHTS.map((highlight) => {
            const Icon = getHighlightIcon(highlight.id);

            return (
              <div
                key={highlight.id}
                className="rounded-lg border bg-muted/30 p-3"
              >
                <div className="flex items-center gap-2">
                  <Icon className="h-4 w-4 text-foreground" aria-hidden="true" />
                  <span className="text-sm font-medium text-foreground">
                    {t(highlight.titleKey)}
                  </span>
                </div>
                <p className="mt-2 text-xs leading-5 text-muted-foreground">
                  {t(highlight.descriptionKey)}
                </p>
              </div>
            );
          })}
        </div>

        <Separator />

        <div className="rounded-lg border bg-background p-4">
          <div className="flex items-center gap-2">
            <Badge variant="outline">{t(ABOUT_DIAGNOSTIC_GUIDANCE.titleKey)}</Badge>
          </div>
          <p className="mt-3 text-sm text-foreground">{runtimeDescription}</p>
          <p className="mt-2 text-xs leading-5 text-muted-foreground">
            {t(ABOUT_DIAGNOSTIC_GUIDANCE.followUpDescriptionKey)}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
