export interface BuildDependency {
  name: string;
  version: string;
  color: string;
  textColor: string;
  darkColor: string;
  darkTextColor: string;
  letter: string;
  url: string;
}

export const BUILD_DEPENDENCIES: BuildDependency[] = [
  {
    name: 'Tauri',
    version: process.env.NEXT_PUBLIC_TAURI_VERSION || 'v2.9.0',
    color: '#FFC131',
    textColor: '#000000',
    darkColor: '#FFC131',
    darkTextColor: '#000000',
    letter: 'T',
    url: 'https://tauri.app',
  },
  {
    name: 'Rust',
    version: process.env.NEXT_PUBLIC_RUST_VERSION || 'v1.77.2',
    color: '#DEA584',
    textColor: '#000000',
    darkColor: '#DEA584',
    darkTextColor: '#000000',
    letter: 'R',
    url: 'https://www.rust-lang.org',
  },
  {
    name: 'Next.js',
    version: process.env.NEXT_PUBLIC_NEXTJS_VERSION || 'v16.0.0',
    color: '#000000',
    textColor: '#FFFFFF',
    darkColor: '#FFFFFF',
    darkTextColor: '#000000',
    letter: 'N',
    url: 'https://nextjs.org',
  },
  {
    name: 'React',
    version: process.env.NEXT_PUBLIC_REACT_VERSION || 'v19.0.0',
    color: '#61DAFB',
    textColor: '#000000',
    darkColor: '#61DAFB',
    darkTextColor: '#000000',
    letter: '⚛',
    url: 'https://react.dev',
  },
];

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
