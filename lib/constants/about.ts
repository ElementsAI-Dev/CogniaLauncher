export type AboutBrandIconCategory = 'brands' | 'languages' | 'providers';

export interface AboutBrandAsset {
  category: AboutBrandIconCategory;
  name: string;
}

export interface BuildDependency {
  id: string;
  name: string;
  version: string;
  url: string;
  icon: AboutBrandAsset;
}

// About page brand audit:
// - Reuse existing `languages` asset for Rust
// - Reuse existing `providers` asset for GitHub
// - Add dedicated `brands` assets for Tauri, Next.js, and React
export const BUILD_DEPENDENCIES: BuildDependency[] = [
  {
    id: 'tauri',
    name: 'Tauri',
    version: process.env.NEXT_PUBLIC_TAURI_VERSION || 'v2.9.0',
    url: 'https://tauri.app',
    icon: {
      category: 'brands',
      name: 'tauri',
    },
  },
  {
    id: 'rust',
    name: 'Rust',
    version: process.env.NEXT_PUBLIC_RUST_VERSION || 'v1.77.2',
    url: 'https://www.rust-lang.org',
    icon: {
      category: 'languages',
      name: 'rust',
    },
  },
  {
    id: 'nextjs',
    name: 'Next.js',
    version: process.env.NEXT_PUBLIC_NEXTJS_VERSION || 'v16.0.10',
    url: 'https://nextjs.org',
    icon: {
      category: 'brands',
      name: 'nextjs',
    },
  },
  {
    id: 'react',
    name: 'React',
    version: process.env.NEXT_PUBLIC_REACT_VERSION || 'v19.2.0',
    url: 'https://react.dev',
    icon: {
      category: 'brands',
      name: 'react',
    },
  },
];

export interface AboutBrandedExternalLink {
  id: string;
  label: string;
  url: string;
  icon: AboutBrandAsset;
}

export const ABOUT_BRANDED_EXTERNAL_LINKS: AboutBrandedExternalLink[] = [
  {
    id: 'github',
    label: 'GitHub',
    url: 'https://github.com/ElementAstro/CogniaLauncher',
    icon: {
      category: 'providers',
      name: 'github',
    },
  },
];

export interface AboutProductHighlight {
  id: 'environments' | 'providers' | 'support';
  titleKey: string;
  descriptionKey: string;
}

export const ABOUT_PRODUCT_HIGHLIGHTS: AboutProductHighlight[] = [
  {
    id: 'environments',
    titleKey: 'about.productHighlightEnvironmentsTitle',
    descriptionKey: 'about.productHighlightEnvironmentsDesc',
  },
  {
    id: 'providers',
    titleKey: 'about.productHighlightProvidersTitle',
    descriptionKey: 'about.productHighlightProvidersDesc',
  },
  {
    id: 'support',
    titleKey: 'about.productHighlightSupportTitle',
    descriptionKey: 'about.productHighlightSupportDesc',
  },
];

export interface AboutDiagnosticGuidance {
  titleKey: string;
  desktopDescriptionKey: string;
  webDescriptionKey: string;
  followUpDescriptionKey: string;
}

export const ABOUT_DIAGNOSTIC_GUIDANCE: AboutDiagnosticGuidance = {
  titleKey: 'about.diagnosticsExpectationTitle',
  desktopDescriptionKey: 'about.diagnosticsExpectationDesktop',
  webDescriptionKey: 'about.diagnosticsExpectationWeb',
  followUpDescriptionKey: 'about.diagnosticsExpectationFollowUp',
};

export type AboutSupportResourceAction =
  | 'check_updates'
  | 'open_changelog'
  | 'export_diagnostics'
  | 'open_external'
  | 'report_bug'
  | 'feature_request';

export type AboutSupportResourceIcon =
  | 'refresh'
  | 'file-text'
  | 'clipboard-list'
  | 'book-open'
  | 'bug'
  | 'message-square-plus';

export interface AboutSupportResource {
  id:
    | 'check_updates'
    | 'changelog'
    | 'export_diagnostics'
    | 'github'
    | 'documentation'
    | 'report_bug'
    | 'feature_request';
  action: AboutSupportResourceAction;
  labelKey: string;
  descriptionKey: string;
  webDescriptionKey?: string;
  displayLabel?: string;
  url?: string;
  external?: boolean;
  icon?: AboutSupportResourceIcon;
  brandIcon?: AboutBrandAsset;
}

const githubAboutLink = ABOUT_BRANDED_EXTERNAL_LINKS.find(
  (link) => link.id === 'github',
);

export const ABOUT_SUPPORT_RESOURCES: AboutSupportResource[] = [
  {
    id: 'check_updates',
    action: 'check_updates',
    labelKey: 'about.checkForUpdates',
    descriptionKey: 'about.checkForUpdatesDesc',
    icon: 'refresh',
  },
  {
    id: 'changelog',
    action: 'open_changelog',
    labelKey: 'about.changelog',
    descriptionKey: 'about.changelogDescription',
    icon: 'file-text',
  },
  {
    id: 'export_diagnostics',
    action: 'export_diagnostics',
    labelKey: 'about.exportDiagnostics',
    descriptionKey: 'about.exportDiagnosticsDescDesktop',
    webDescriptionKey: 'about.exportDiagnosticsDescWeb',
    icon: 'clipboard-list',
  },
  {
    id: 'github',
    action: 'open_external',
    labelKey: 'about.repository',
    displayLabel: githubAboutLink?.label ?? 'GitHub',
    descriptionKey: 'about.repositoryDesc',
    url: githubAboutLink?.url,
    external: true,
    brandIcon: githubAboutLink?.icon,
  },
  {
    id: 'documentation',
    action: 'open_external',
    labelKey: 'about.documentation',
    descriptionKey: 'about.documentationDesc',
    url: 'https://cognia.dev/docs',
    external: true,
    icon: 'book-open',
  },
  {
    id: 'report_bug',
    action: 'report_bug',
    labelKey: 'about.reportBug',
    descriptionKey: 'about.reportBugDesc',
    icon: 'bug',
  },
  {
    id: 'feature_request',
    action: 'feature_request',
    labelKey: 'about.featureRequest',
    descriptionKey: 'about.featureRequestDesc',
    icon: 'message-square-plus',
  },
];

export type ChangelogChangeType =
  | 'added'
  | 'changed'
  | 'fixed'
  | 'removed'
  | 'deprecated'
  | 'security'
  | 'performance'
  | 'breaking';

export const ALL_CHANGE_TYPES: ChangelogChangeType[] = [
  'added',
  'changed',
  'fixed',
  'removed',
  'deprecated',
  'security',
  'performance',
  'breaking',
];

export interface ChangelogChange {
  type: ChangelogChangeType;
  description: string;
}

export interface ChangelogEntry {
  version: string;
  date: string;
  changes: ChangelogChange[];
  /** Raw markdown body from GitHub release (if fetched remotely) */
  markdownBody?: string;
  /** Whether this is a pre-release version */
  prerelease?: boolean;
  /** URL to the GitHub release page */
  url?: string;
  /** Source of this entry: 'local' (hardcoded) or 'remote' (GitHub) */
  source?: 'local' | 'remote';
}

const CHANGELOG_EN: ChangelogEntry[] = [
  {
    version: '0.1.0',
    date: '2025-01-15',
    source: 'local',
    changes: [
      { type: 'added', description: 'Initial release of CogniaLauncher' },
      { type: 'added', description: 'Environment management for 15+ languages: Python, Node.js, Rust, Go, Java, Kotlin, Ruby, PHP, .NET, Deno, and more' },
      { type: 'added', description: '49+ package manager providers including npm, pip, cargo, brew, apt, winget, scoop, chocolatey, and more' },
      { type: 'added', description: 'WSL management with distro install, export, import, and per-distro configuration' },
      { type: 'added', description: 'Onboarding wizard with environment detection, mirror configuration, and guided tour' },
      { type: 'added', description: 'System health checks for environments and package managers' },
      { type: 'added', description: 'Cache management with auto-cleanup, external cache discovery, and size monitoring' },
      { type: 'added', description: 'Download manager with queue, pause/resume, history, and batch operations' },
      { type: 'added', description: 'Dependency resolution with conflict detection and version pinning' },
      { type: 'added', description: 'Command palette with keyboard shortcuts (Ctrl+K)' },
      { type: 'added', description: 'Customizable dashboard with drag-and-drop widgets' },
      { type: 'added', description: 'Cross-platform support for Windows, macOS, and Linux' },
      { type: 'added', description: 'Dark mode, i18n (English/Chinese), customizable accent colors and themes' },
      { type: 'added', description: 'Diagnostic export for bug reports' },
    ],
  },
];

const CHANGELOG_ZH: ChangelogEntry[] = [
  {
    version: '0.1.0',
    date: '2025-01-15',
    source: 'local',
    changes: [
      { type: 'added', description: 'CogniaLauncher 首次发布' },
      { type: 'added', description: '支持 15+ 语言的环境管理：Python、Node.js、Rust、Go、Java、Kotlin、Ruby、PHP、.NET、Deno 等' },
      { type: 'added', description: '49+ 包管理器提供商，包括 npm、pip、cargo、brew、apt、winget、scoop、chocolatey 等' },
      { type: 'added', description: 'WSL 管理，支持发行版安装、导出、导入和逐发行版配置' },
      { type: 'added', description: '引导向导，支持环境检测、镜像配置和引导导览' },
      { type: 'added', description: '环境和包管理器的系统健康检查' },
      { type: 'added', description: '缓存管理，支持自动清理、外部缓存发现和大小监控' },
      { type: 'added', description: '下载管理器，支持队列、暂停/恢复、历史记录和批量操作' },
      { type: 'added', description: '依赖解析，支持冲突检测和版本锁定' },
      { type: 'added', description: '命令面板，支持键盘快捷键 (Ctrl+K)' },
      { type: 'added', description: '可自定义仪表盘，支持拖拽组件' },
      { type: 'added', description: '支持 Windows、macOS、Linux 跨平台运行' },
      { type: 'added', description: '深色模式、中英文国际化、可自定义强调色和主题' },
      { type: 'added', description: '诊断信息导出，便于问题反馈' },
    ],
  },
];

export function getChangelog(locale: string): ChangelogEntry[] {
  if (locale === 'zh') {
    return CHANGELOG_ZH;
  }
  return CHANGELOG_EN;
}
