"use client";

import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Blocks } from "lucide-react";
import { BUILD_DEPENDENCIES } from "@/lib/constants/about";
import { useTheme } from "next-themes";

interface DepItemProps {
  dep: (typeof BUILD_DEPENDENCIES)[number];
  isDark: boolean;
  openLabel: string;
}

function DepItem({ dep, isDark, openLabel }: DepItemProps) {
  return (
    <a
      href={dep.url}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-2 p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
      aria-label={`${dep.name} ${dep.version} - ${openLabel}`}
    >
      <div
        className="flex items-center justify-center w-6 h-6 rounded text-xs font-bold flex-shrink-0"
        style={{
          backgroundColor: isDark ? dep.darkColor : dep.color,
          color: isDark ? dep.darkTextColor : dep.textColor,
        }}
        aria-hidden="true"
      >
        {dep.letter}
      </div>
      <div className="flex flex-col gap-0.5">
        <span className="text-[13px] font-medium text-foreground">
          {dep.name}
        </span>
        <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 w-fit text-muted-foreground">
          {dep.version}
        </Badge>
      </div>
    </a>
  );
}

interface BuildDepsCardProps {
  t: (key: string) => string;
}

export function BuildDepsCard({ t }: BuildDepsCardProps) {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";
  const openLabel = t("about.openInNewTab");

  return (
    <Card
      role="region"
      aria-labelledby="build-deps-heading"
    >
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Blocks className="h-5 w-5 text-foreground" aria-hidden="true" />
          <span id="build-deps-heading">{t("about.buildDependencies")}</span>
        </CardTitle>
        <CardDescription>{t("about.buildDependenciesDesc")}</CardDescription>
      </CardHeader>

      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            {BUILD_DEPENDENCIES.slice(0, 2).map((dep) => (
              <DepItem key={dep.name} dep={dep} isDark={isDark} openLabel={openLabel} />
            ))}
          </div>
          <div className="space-y-2">
            {BUILD_DEPENDENCIES.slice(2, 4).map((dep) => (
              <DepItem key={dep.name} dep={dep} isDark={isDark} openLabel={openLabel} />
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
