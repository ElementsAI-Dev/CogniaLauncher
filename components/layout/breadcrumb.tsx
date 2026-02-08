"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLocale } from "@/components/providers/locale-provider";
import {
  Breadcrumb as BreadcrumbRoot,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";

const NAV_LABELS: Record<string, string> = {
  "": "nav.dashboard",
  environments: "nav.environments",
  packages: "nav.packages",
  providers: "nav.providers",
  cache: "nav.cache",
  downloads: "nav.downloads",
  logs: "nav.logs",
  settings: "nav.settings",
  about: "nav.about",
};

export function Breadcrumb() {
  const pathname = usePathname();
  const { t } = useLocale();
  const segments = pathname.split("/").filter(Boolean);
  const items = [{ href: "/", label: t("nav.dashboard") }];

  segments.forEach((segment, index) => {
    const href = `/${segments.slice(0, index + 1).join("/")}`;
    const labelKey = NAV_LABELS[segment];
    const fallbackLabel = segment.charAt(0).toUpperCase() + segment.slice(1);
    items.push({ href, label: labelKey ? t(labelKey) : fallbackLabel });
  });

  return (
    <BreadcrumbRoot>
      <BreadcrumbList>
        {items.map((item, index) => {
          const isLast = index === items.length - 1;
          return (
            <BreadcrumbItem key={item.href}>
              {index > 0 && <BreadcrumbSeparator />}
              {isLast ? (
                <BreadcrumbPage>{item.label}</BreadcrumbPage>
              ) : (
                <BreadcrumbLink asChild>
                  <Link href={item.href}>{item.label}</Link>
                </BreadcrumbLink>
              )}
            </BreadcrumbItem>
          );
        })}
      </BreadcrumbList>
    </BreadcrumbRoot>
  );
}
