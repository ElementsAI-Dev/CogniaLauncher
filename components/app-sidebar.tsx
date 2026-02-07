"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home,
  Package,
  Settings,
  HardDrive,
  Layers,
  Server,
  Info,
  ScrollText,
  ArrowDownToLine,
  Terminal,
  ChevronRight,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarRail,
} from "@/components/ui/sidebar";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ThemeToggle } from "@/components/theme-toggle";
import { LanguageToggle } from "@/components/language-toggle";
import { useLocale } from "@/components/providers/locale-provider";
import { LANGUAGES } from "@/lib/constants/environments";

const navItems = [
  { href: "/", labelKey: "nav.dashboard", icon: Home, tourId: undefined },
  { href: "/environments", labelKey: "nav.environments", icon: Layers, tourId: "nav-environments" },
  { href: "/packages", labelKey: "nav.packages", icon: Package, tourId: "nav-packages" },
  { href: "/providers", labelKey: "nav.providers", icon: Server, tourId: undefined },
  { href: "/cache", labelKey: "nav.cache", icon: HardDrive, tourId: undefined },
  { href: "/downloads", labelKey: "nav.downloads", icon: ArrowDownToLine, tourId: undefined },
  { href: "/wsl", labelKey: "nav.wsl", icon: Terminal, tourId: undefined },
  { href: "/logs", labelKey: "nav.logs", icon: ScrollText, tourId: undefined },
  { href: "/settings", labelKey: "nav.settings", icon: Settings, tourId: "nav-settings" },
  { href: "/about", labelKey: "nav.about", icon: Info, tourId: undefined },
] as const;

export function AppSidebar() {
  const pathname = usePathname();
  const { t } = useLocale();

  return (
    <Sidebar collapsible="icon" data-tour="sidebar">
      <SidebarHeader className="border-b border-sidebar-border">
        <div className="flex items-center gap-2 px-2 py-1">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <Layers className="h-4 w-4" />
          </div>
          <div className="sidebar-text flex flex-col">
            <span className="text-sm font-semibold">{t("common.appName")}</span>
            <span className="text-xs text-muted-foreground">
              {t("common.appDescription")}
            </span>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>{t("nav.dashboard")}</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.slice(0, 1).map((item) => {
                const Icon = item.icon;
                const isActive = pathname === item.href;
                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive}
                      tooltip={t(item.labelKey)}
                    >
                      <Link href={item.href} {...(item.tourId ? { 'data-tour': item.tourId } : {})}>
                        <Icon className="h-4 w-4" />
                        <span>{t(item.labelKey)}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>{t("nav.environments")}</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {/* Environments - with collapsible language sub-items */}
              <Collapsible
                defaultOpen={pathname.startsWith("/environments")}
                className="group/collapsible"
              >
                <SidebarMenuItem>
                  <CollapsibleTrigger asChild>
                    <SidebarMenuButton
                      isActive={pathname === "/environments"}
                      tooltip={t("nav.environments")}
                      data-tour="nav-environments"
                    >
                      <Layers className="h-4 w-4" />
                      <span>{t("nav.environments")}</span>
                      <ChevronRight className="ml-auto h-4 w-4 transition-transform group-data-[state=open]/collapsible:rotate-90" />
                    </SidebarMenuButton>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <SidebarMenuSub>
                      <SidebarMenuSubItem>
                        <SidebarMenuSubButton
                          asChild
                          isActive={pathname === "/environments"}
                        >
                          <Link href="/environments">
                            {t("environments.detail.allEnvironments")}
                          </Link>
                        </SidebarMenuSubButton>
                      </SidebarMenuSubItem>
                      {LANGUAGES.map((lang) => (
                        <SidebarMenuSubItem key={lang.id}>
                          <SidebarMenuSubButton
                            asChild
                            isActive={pathname === `/environments/${lang.id}`}
                          >
                            <Link href={`/environments/${lang.id}`}>
                              <span className="mr-1">{lang.icon}</span>
                              {t(`environments.languages.${lang.id}`)}
                            </Link>
                          </SidebarMenuSubButton>
                        </SidebarMenuSubItem>
                      ))}
                    </SidebarMenuSub>
                  </CollapsibleContent>
                </SidebarMenuItem>
              </Collapsible>

              {/* Remaining nav items: packages, providers, cache, downloads, wsl */}
              {navItems.slice(2, 7).map((item) => {
                const Icon = item.icon;
                const isActive = pathname === item.href;
                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive}
                      tooltip={t(item.labelKey)}
                    >
                      <Link href={item.href} {...(item.tourId ? { 'data-tour': item.tourId } : {})}>
                        <Icon className="h-4 w-4" />
                        <span>{t(item.labelKey)}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>{t("nav.settings")}</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.slice(7).map((item) => {
                const Icon = item.icon;
                const isActive = pathname === item.href;
                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive}
                      tooltip={t(item.labelKey)}
                    >
                      <Link href={item.href} {...(item.tourId ? { 'data-tour': item.tourId } : {})}>
                        <Icon className="h-4 w-4" />
                        <span>{t(item.labelKey)}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border">
        <div className="flex items-center justify-between px-2 py-1 group-data-[collapsible=icon]:flex-col group-data-[collapsible=icon]:items-center group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:gap-1">
          <span className="sidebar-text text-xs text-muted-foreground">
            {t("common.version")}
          </span>
          <div className="flex items-center gap-1 group-data-[collapsible=icon]:flex-col">
            <ThemeToggle />
            <LanguageToggle />
          </div>
        </div>
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  );
}
