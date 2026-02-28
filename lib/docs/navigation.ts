export interface DocNavItem {
  title: string;
  titleEn?: string;
  slug?: string;
  children?: DocNavItem[];
}

export const DOC_NAV: DocNavItem[] = [
  {
    title: '首页',
    titleEn: 'Home',
    slug: 'index',
  },
  {
    title: '快速开始',
    titleEn: 'Getting Started',
    children: [
      { title: '概览', titleEn: 'Overview', slug: 'getting-started' },
      { title: '安装', titleEn: 'Installation', slug: 'getting-started/installation' },
      { title: '快速上手', titleEn: 'Quick Start', slug: 'getting-started/quick-start' },
      { title: '配置', titleEn: 'Configuration', slug: 'getting-started/configuration' },
    ],
  },
  {
    title: '使用指南',
    titleEn: 'User Guide',
    children: [
      { title: '概览', titleEn: 'Overview', slug: 'guide' },
      { title: '仪表板', titleEn: 'Dashboard', slug: 'guide/dashboard' },
      { title: '环境管理', titleEn: 'Environments', slug: 'guide/environments' },
      { title: '包管理', titleEn: 'Packages', slug: 'guide/packages' },
      { title: 'Provider 系统', titleEn: 'Provider System', slug: 'guide/providers' },
      { title: '缓存管理', titleEn: 'Cache', slug: 'guide/cache' },
      { title: '下载管理', titleEn: 'Downloads', slug: 'guide/downloads' },
      { title: 'WSL 管理', titleEn: 'WSL', slug: 'guide/wsl' },
      { title: '设置与主题', titleEn: 'Settings', slug: 'guide/settings' },
      { title: '命令面板', titleEn: 'Command Palette', slug: 'guide/command-palette' },
      { title: '日志系统', titleEn: 'Logs', slug: 'guide/logs' },
    ],
  },
  {
    title: '架构设计',
    titleEn: 'Architecture',
    children: [
      { title: '概览', titleEn: 'Overview', slug: 'architecture' },
      { title: '架构总览', titleEn: 'Architecture Overview', slug: 'architecture/overview' },
      { title: '前端架构', titleEn: 'Frontend', slug: 'architecture/frontend' },
      { title: '后端架构', titleEn: 'Backend', slug: 'architecture/backend' },
      { title: 'Provider 系统', titleEn: 'Provider System', slug: 'architecture/provider-system' },
      { title: '数据模型', titleEn: 'Data Model', slug: 'architecture/data-model' },
      { title: '安全设计', titleEn: 'Security', slug: 'architecture/security' },
    ],
  },
  {
    title: '开发者',
    titleEn: 'Development',
    children: [
      { title: '概览', titleEn: 'Overview', slug: 'development' },
      { title: '开发环境搭建', titleEn: 'Setup', slug: 'development/setup' },
      { title: '贡献指南', titleEn: 'Contributing', slug: 'development/contributing' },
      { title: '添加 Provider', titleEn: 'Adding Providers', slug: 'development/adding-providers' },
      { title: '添加命令', titleEn: 'Adding Commands', slug: 'development/adding-commands' },
      { title: '测试指南', titleEn: 'Testing', slug: 'development/testing' },
      { title: 'CI/CD', titleEn: 'CI/CD', slug: 'development/ci-cd' },
    ],
  },
  {
    title: '参考',
    titleEn: 'Reference',
    children: [
      { title: '概览', titleEn: 'Overview', slug: 'reference' },
      { title: 'Tauri 命令', titleEn: 'Commands', slug: 'reference/commands' },
      { title: 'Provider 列表', titleEn: 'Providers List', slug: 'reference/providers-list' },
      { title: 'React Hooks', titleEn: 'Hooks', slug: 'reference/hooks' },
      { title: '状态管理', titleEn: 'Stores', slug: 'reference/stores' },
      { title: '国际化', titleEn: 'i18n', slug: 'reference/i18n' },
      { title: '快捷键', titleEn: 'Keyboard Shortcuts', slug: 'reference/keyboard-shortcuts' },
    ],
  },
  {
    title: '设计文档',
    titleEn: 'Design',
    children: [
      { title: '概览', titleEn: 'Overview', slug: 'design' },
      { title: '软件设计', titleEn: 'Software Design', slug: 'design/software-design' },
      { title: '错误处理', titleEn: 'Error Handling', slug: 'design/error-handling' },
    ],
  },
  {
    title: '附录',
    titleEn: 'Appendix',
    children: [
      { title: '概览', titleEn: 'Overview', slug: 'appendix' },
      { title: '软件推荐', titleEn: 'Software Recommendations', slug: 'appendix/software-recommendations' },
    ],
  },
];

export function flattenNav(items: DocNavItem[] = DOC_NAV): DocNavItem[] {
  const result: DocNavItem[] = [];
  for (const item of items) {
    if (item.slug) {
      result.push(item);
    }
    if (item.children) {
      result.push(...flattenNav(item.children));
    }
  }
  return result;
}

export function getDocTitle(slug: string, locale: string = 'zh'): string | undefined {
  const flat = flattenNav();
  const item = flat.find((i) => i.slug === slug);
  if (!item) return undefined;
  return locale === 'en' ? (item.titleEn ?? item.title) : item.title;
}

export function getAdjacentDocs(
  slug: string
): { prev?: DocNavItem; next?: DocNavItem } {
  const flat = flattenNav();
  const index = flat.findIndex((i) => i.slug === slug);
  if (index === -1) return {};
  return {
    prev: index > 0 ? flat[index - 1] : undefined,
    next: index < flat.length - 1 ? flat[index + 1] : undefined,
  };
}

export function getBreadcrumbs(slug: string): DocNavItem[] {
  const crumbs: DocNavItem[] = [{ title: '文档', titleEn: 'Docs', slug: 'index' }];
  if (slug === 'index') return crumbs;

  // Find the parent section and the item itself
  for (const section of DOC_NAV) {
    if (section.slug === slug) {
      crumbs.push(section);
      return crumbs;
    }
    if (section.children) {
      const child = section.children.find((c) => c.slug === slug);
      if (child) {
        crumbs.push({ title: section.title, titleEn: section.titleEn, slug: section.children[0]?.slug });
        if (child.slug !== section.children[0]?.slug) {
          crumbs.push(child);
        }
        return crumbs;
      }
    }
  }

  return crumbs;
}

export function slugToArray(slug: string): string[] {
  if (slug === 'index') return [];
  return slug.split('/');
}

export function arrayToSlug(arr?: string[]): string {
  if (!arr || arr.length === 0) return 'index';
  return arr.join('/');
}
