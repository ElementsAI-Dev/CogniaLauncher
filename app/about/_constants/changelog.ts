export interface ChangelogEntry {
  version: string;
  date: string;
  changes: {
    type: 'added' | 'changed' | 'fixed' | 'removed';
    description: string;
  }[];
}

const CHANGELOG_EN: ChangelogEntry[] = [
  {
    version: '0.1.0',
    date: '2025-01-15',
    changes: [
      { type: 'added', description: 'Initial release' },
      { type: 'added', description: 'Environment management for Python, Node.js, Rust, and Go' },
      { type: 'added', description: 'Package search and installation from multiple providers' },
      { type: 'added', description: 'Cache management with automatic cleanup' },
      { type: 'added', description: 'Cross-platform support for Windows, macOS, and Linux' },
      { type: 'added', description: 'Dark mode and internationalization (English/Chinese)' },
    ],
  },
];

const CHANGELOG_ZH: ChangelogEntry[] = [
  {
    version: '0.1.0',
    date: '2025-01-15',
    changes: [
      { type: 'added', description: '首次发布' },
      { type: 'added', description: '支持 Python、Node.js、Rust、Go 的环境管理' },
      { type: 'added', description: '多提供商的软件包搜索与安装' },
      { type: 'added', description: '缓存管理与自动清理' },
      { type: 'added', description: '支持 Windows、macOS、Linux 跨平台运行' },
      { type: 'added', description: '深色模式与中英文国际化' },
    ],
  },
];

export function getChangelog(locale: string): ChangelogEntry[] {
  if (locale === 'zh') {
    return CHANGELOG_ZH;
  }
  return CHANGELOG_EN;
}
