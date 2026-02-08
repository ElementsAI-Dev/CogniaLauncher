"use client";

import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
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
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Scale className="h-5 w-5 text-foreground" aria-hidden="true" />
          <span id="license-heading">{t("about.licenseCertificates")}</span>
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-3">
        {/* MIT License Row */}
        <a
          href="https://opensource.org/licenses/MIT"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-3 p-4 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 hover:bg-green-100 dark:hover:bg-green-900/30 transition-colors focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2"
          aria-label={`${t("about.mitLicense")} - ${t("about.openInNewTab")}`}
        >
          <ShieldCheck
            className="h-5 w-5 text-green-600 dark:text-green-400 flex-shrink-0"
            aria-hidden="true"
          />
          <div className="flex flex-col gap-0.5">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-green-800 dark:text-green-200">
                {t("about.mitLicense")}
              </span>
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-5 bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300 border-transparent">
                MIT
              </Badge>
            </div>
            <span className="text-xs text-green-700 dark:text-green-300">
              {t("about.mitLicenseDesc")}
            </span>
          </div>
        </a>

        <Separator />

        {/* Copyright Row */}
        <div className="flex items-center gap-3 p-4 rounded-lg bg-muted/50 border border-border">
          <Copyright
            className="h-5 w-5 text-muted-foreground flex-shrink-0"
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
