"use client";

import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
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
    <TableRow>
      <TableCell className="py-2">
        <a
          href={dep.url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-muted transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
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
          <span className="text-[13px] font-medium text-foreground">
            {dep.name}
          </span>
        </a>
      </TableCell>
      <TableCell className="py-2 text-right">
        <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 w-fit text-muted-foreground">
          {dep.version}
        </Badge>
      </TableCell>
    </TableRow>
  );
}

interface BuildDepsCardProps {
  t: (key: string) => string;
}

export function BuildDepsCard({ t }: BuildDepsCardProps) {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";
  const openLabel = t("about.openInNewTab");
  const hasDependencies = BUILD_DEPENDENCIES.length > 0;

  return (
    <Card
      role="region"
      aria-labelledby="build-deps-heading"
    >
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Blocks className="h-5 w-5 text-foreground" aria-hidden="true" />
          <span id="build-deps-heading">{t("about.buildDependencies")}</span>
        </CardTitle>
        <CardDescription>{t("about.buildDependenciesDesc")}</CardDescription>
      </CardHeader>

      <CardContent>
        {!hasDependencies ? (
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <Blocks className="h-5 w-5" aria-hidden="true" />
              </EmptyMedia>
              <EmptyTitle>{t("about.buildDependencies")}</EmptyTitle>
              <EmptyDescription>{t("about.buildDependenciesDesc")}</EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Dependency</TableHead>
                <TableHead className="text-right">Version</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {BUILD_DEPENDENCIES.map((dep) => (
                <DepItem key={dep.name} dep={dep} isDark={isDark} openLabel={openLabel} />
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
