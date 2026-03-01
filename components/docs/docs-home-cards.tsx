'use client';

import Link from 'next/link';
import { useLocale } from '@/components/providers/locale-provider';
import { DOC_NAV, slugToArray } from '@/lib/docs/navigation';
import {
  BookOpen,
  Rocket,
  Layout,
  Code2,
  FileText,
  Palette,
  Bookmark,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const SECTION_ICONS: Record<string, LucideIcon> = {
  '快速开始': Rocket,
  '使用指南': BookOpen,
  '架构设计': Layout,
  '开发者': Code2,
  '参考': FileText,
  '设计文档': Palette,
  '附录': Bookmark,
};

const SECTION_DESCRIPTIONS: Record<string, { zh: string; en: string }> = {
  '快速开始': { zh: '安装、配置、快速上手', en: 'Install, configure, and get started' },
  '使用指南': { zh: '仪表板、环境、包、缓存等功能', en: 'Dashboard, environments, packages, cache' },
  '架构设计': { zh: '前后端架构、Provider 系统、数据模型', en: 'Frontend/backend, provider system, data model' },
  '开发者': { zh: '开发环境、贡献指南、测试、CI/CD', en: 'Dev setup, contributing, testing, CI/CD' },
  '参考': { zh: 'Tauri 命令、Hooks、Store、国际化', en: 'Commands, hooks, stores, i18n reference' },
  '设计文档': { zh: '软件设计、错误处理', en: 'Software design, error handling' },
  '附录': { zh: '软件推荐等补充内容', en: 'Software recommendations and extras' },
};

interface DocsHomeCardsProps {
  className?: string;
}

export function DocsHomeCards({ className }: DocsHomeCardsProps) {
  const { locale } = useLocale();

  const sections = DOC_NAV.filter((item) => item.children && item.children.length > 0);

  return (
    <div className={cn('grid grid-cols-1 sm:grid-cols-2 gap-4 mt-8', className)}>
      {sections.map((section) => {
        const Icon = SECTION_ICONS[section.title] ?? BookOpen;
        const desc = SECTION_DESCRIPTIONS[section.title];
        const title = locale === 'en' ? (section.titleEn ?? section.title) : section.title;
        const description = desc
          ? (locale === 'en' ? desc.en : desc.zh)
          : undefined;
        const firstChild = section.children?.[0];
        const href = firstChild?.slug
          ? (slugToArray(firstChild.slug).length === 0 ? '/docs' : `/docs/${slugToArray(firstChild.slug).join('/')}`)
          : '/docs';
        const childCount = section.children?.length ?? 0;

        return (
          <Link
            key={section.title}
            href={href}
            className="group rounded-lg border border-border bg-card p-4 hover:border-primary/40 hover:bg-accent/30 transition-all"
          >
            <div className="flex items-start gap-3">
              <div className="rounded-md bg-primary/10 p-2 shrink-0">
                <Icon className="h-5 w-5 text-primary" />
              </div>
              <div className="min-w-0">
                <h3 className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors">
                  {title}
                </h3>
                {description && (
                  <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                    {description}
                  </p>
                )}
                <span className="text-xs text-muted-foreground/60 mt-2 inline-block">
                  {childCount} {locale === 'en' ? 'pages' : '篇'}
                </span>
              </div>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
