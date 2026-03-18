"use client";

import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Scale, ShieldCheck, Copyright } from "lucide-react";

interface LicenseCardProps {
  t: (key: string) => string;
}

export function LicenseCard({ t }: LicenseCardProps) {
  return (
    <Card
      role="region"
      aria-labelledby="license-heading"
    >
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Scale className="h-5 w-5 text-foreground" aria-hidden="true" />
          <span id="license-heading">{t("about.licenseCertificates")}</span>
        </CardTitle>
        <CardDescription>{t("about.licenseCertificatesDesc")}</CardDescription>
      </CardHeader>

      <CardContent className="flex flex-col gap-4">
        {/* MIT License Row */}
        <a
          href="https://opensource.org/licenses/MIT"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-3 rounded-lg border bg-muted/40 p-3 transition-colors hover:bg-muted focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
          aria-label={`${t("about.mitLicense")} - ${t("about.openInNewTab")}`}
        >
          <ShieldCheck
            className="h-5 w-5 shrink-0 text-foreground"
            aria-hidden="true"
          />
          <div className="flex flex-col gap-0.5">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-foreground">
                {t("about.mitLicense")}
              </span>
              <Badge variant="outline" className="h-5 px-1.5 py-0 text-[10px]">
                MIT
              </Badge>
            </div>
            <span className="text-xs text-muted-foreground">
              {t("about.mitLicenseDesc")}
            </span>
          </div>
        </a>

        <Separator />

        {/* Copyright Row */}
        <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 border border-border">
          <Copyright
            className="h-5 w-5 text-muted-foreground shrink-0"
            aria-hidden="true"
          />
          <div className="flex flex-col gap-0.5">
            <span className="text-sm font-medium text-foreground">
              {t("about.copyright")}
            </span>
            <span className="text-xs text-muted-foreground">
              {t("about.copyrightDesc")}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
