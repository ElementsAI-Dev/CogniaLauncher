/**
 * Settings Registry - Metadata for all settings items
 * Used for search functionality and navigation
 */

export type SettingsSection =
  | 'general'
  | 'network'
  | 'security'
  | 'mirrors'
  | 'appearance'
  | 'updates'
  | 'tray'
  | 'paths'
  | 'provider'
  | 'system';

export type SettingType = 'input' | 'switch' | 'select';

export interface SettingDefinition {
  /** Unique key matching the config key, e.g., 'general.parallel_downloads' */
  key: string;
  /** Section this setting belongs to */
  section: SettingsSection;
  /** i18n key for the label */
  labelKey: string;
  /** i18n key for the description */
  descKey: string;
  /** Type of input control */
  type: SettingType;
  /** Additional search keywords (both English and Chinese) */
  keywords?: string[];
  /** Whether this is an advanced setting */
  advanced?: boolean;
  /** Whether this setting requires Tauri (desktop only) */
  tauriOnly?: boolean;
}

export interface SectionDefinition {
  id: SettingsSection;
  labelKey: string;
  descKey: string;
  icon: string;
  order: number;
}

/**
 * Section definitions with display order
 */
export const SETTINGS_SECTIONS: SectionDefinition[] = [
  {
    id: 'general',
    labelKey: 'settings.general',
    descKey: 'settings.generalDesc',
    icon: 'Settings2',
    order: 1,
  },
  {
    id: 'network',
    labelKey: 'settings.network',
    descKey: 'settings.networkDesc',
    icon: 'Network',
    order: 2,
  },
  {
    id: 'security',
    labelKey: 'settings.security',
    descKey: 'settings.securityDesc',
    icon: 'Shield',
    order: 3,
  },
  {
    id: 'mirrors',
    labelKey: 'settings.mirrors',
    descKey: 'settings.mirrorsDesc',
    icon: 'Server',
    order: 4,
  },
  {
    id: 'appearance',
    labelKey: 'settings.appearance',
    descKey: 'settings.appearanceDesc',
    icon: 'Palette',
    order: 5,
  },
  {
    id: 'updates',
    labelKey: 'settings.updates',
    descKey: 'settings.updatesDesc',
    icon: 'RefreshCw',
    order: 6,
  },
  {
    id: 'tray',
    labelKey: 'settings.tray',
    descKey: 'settings.trayDesc',
    icon: 'Monitor',
    order: 7,
  },
  {
    id: 'paths',
    labelKey: 'settings.paths',
    descKey: 'settings.pathsDesc',
    icon: 'FolderOpen',
    order: 8,
  },
  {
    id: 'provider',
    labelKey: 'settings.providerSettings',
    descKey: 'settings.providerSettingsDesc',
    icon: 'Package',
    order: 9,
  },
  {
    id: 'system',
    labelKey: 'settings.systemInfo',
    descKey: 'settings.systemInfoDesc',
    icon: 'Info',
    order: 10,
  },
];

/**
 * Complete registry of all settings items
 */
export const SETTINGS_REGISTRY: SettingDefinition[] = [
  // General Settings
  {
    key: 'general.parallel_downloads',
    section: 'general',
    labelKey: 'settings.parallelDownloads',
    descKey: 'settings.parallelDownloadsDesc',
    type: 'input',
    keywords: ['concurrent', 'download', 'parallel', '并行', '下载', '并发'],
  },
  {
    key: 'general.min_install_space_mb',
    section: 'general',
    labelKey: 'settings.minInstallSpace',
    descKey: 'settings.minInstallSpaceDesc',
    type: 'input',
    keywords: ['disk', 'space', 'install', 'minimum', '磁盘', '空间', '安装'],
  },
  {
    key: 'general.metadata_cache_ttl',
    section: 'general',
    labelKey: 'settings.metadataCacheTtl',
    descKey: 'settings.metadataCacheTtlDesc',
    type: 'input',
    keywords: ['cache', 'ttl', 'expire', 'metadata', '缓存', '过期', '元数据'],
  },
  {
    key: 'general.resolve_strategy',
    section: 'general',
    labelKey: 'settings.resolveStrategy',
    descKey: 'settings.resolveStrategyDesc',
    type: 'select',
    keywords: ['resolve', 'version', 'strategy', '解析', '版本', '策略'],
    advanced: true,
  },
  {
    key: 'general.auto_update_metadata',
    section: 'general',
    labelKey: 'settings.autoUpdateMetadata',
    descKey: 'settings.autoUpdateMetadataDesc',
    type: 'switch',
    keywords: ['auto', 'update', 'metadata', 'refresh', '自动', '更新', '刷新'],
  },
  {
    key: 'general.cache_max_size',
    section: 'general',
    labelKey: 'settings.cacheMaxSize',
    descKey: 'settings.cacheMaxSizeDesc',
    type: 'input',
    keywords: ['cache', 'size', 'max', 'limit', 'storage', '缓存', '大小', '限制', '存储'],
    advanced: true,
  },
  {
    key: 'general.cache_max_age_days',
    section: 'general',
    labelKey: 'settings.cacheMaxAgeDays',
    descKey: 'settings.cacheMaxAgeDaysDesc',
    type: 'input',
    keywords: ['cache', 'age', 'expire', 'days', 'ttl', '缓存', '过期', '天数'],
    advanced: true,
  },
  {
    key: 'general.auto_clean_cache',
    section: 'general',
    labelKey: 'settings.autoCleanCache',
    descKey: 'settings.autoCleanCacheDesc',
    type: 'switch',
    keywords: ['cache', 'clean', 'auto', 'automatic', '缓存', '清理', '自动'],
    advanced: true,
  },
  {
    key: 'general.cache_auto_clean_threshold',
    section: 'general',
    labelKey: 'settings.cacheAutoCleanThreshold',
    descKey: 'settings.cacheAutoCleanThresholdDesc',
    type: 'input',
    keywords: ['cache', 'threshold', 'percent', 'clean', 'auto', '缓存', '阈值', '百分比', '清理'],
    advanced: true,
  },
  {
    key: 'general.cache_monitor_interval',
    section: 'general',
    labelKey: 'settings.cacheMonitorInterval',
    descKey: 'settings.cacheMonitorIntervalDesc',
    type: 'input',
    keywords: ['cache', 'monitor', 'interval', 'check', 'poll', '缓存', '监控', '间隔', '检查'],
    advanced: true,
  },
  {
    key: 'general.cache_monitor_external',
    section: 'general',
    labelKey: 'settings.cacheMonitorExternal',
    descKey: 'settings.cacheMonitorExternalDesc',
    type: 'switch',
    keywords: ['cache', 'monitor', 'external', 'tool', '缓存', '监控', '外部', '工具'],
    advanced: true,
  },
  {
    key: 'general.download_speed_limit',
    section: 'general',
    labelKey: 'settings.downloadSpeedLimit',
    descKey: 'settings.downloadSpeedLimitDesc',
    type: 'input',
    keywords: ['download', 'speed', 'limit', 'bandwidth', 'throttle', '下载', '速度', '限制', '带宽'],
    advanced: true,
  },

  // Network Settings
  {
    key: 'network.timeout',
    section: 'network',
    labelKey: 'settings.timeout',
    descKey: 'settings.timeoutDesc',
    type: 'input',
    keywords: ['timeout', 'request', 'connection', '超时', '请求', '连接'],
  },
  {
    key: 'network.retries',
    section: 'network',
    labelKey: 'settings.retries',
    descKey: 'settings.retriesDesc',
    type: 'input',
    keywords: ['retry', 'attempt', 'fail', '重试', '尝试', '失败'],
  },
  {
    key: 'network.proxy',
    section: 'network',
    labelKey: 'settings.proxy',
    descKey: 'settings.proxyDesc',
    type: 'input',
    keywords: ['proxy', 'http', 'https', 'socks', '代理', '网络'],
  },

  // Security Settings
  {
    key: 'security.allow_http',
    section: 'security',
    labelKey: 'settings.allowHttp',
    descKey: 'settings.allowHttpDesc',
    type: 'switch',
    keywords: ['http', 'insecure', 'ssl', 'tls', '不安全', '协议'],
  },
  {
    key: 'security.verify_certificates',
    section: 'security',
    labelKey: 'settings.verifyCerts',
    descKey: 'settings.verifyCertsDesc',
    type: 'switch',
    keywords: ['certificate', 'ssl', 'tls', 'verify', '证书', '验证', 'https'],
  },
  {
    key: 'security.allow_self_signed',
    section: 'security',
    labelKey: 'settings.allowSelfSigned',
    descKey: 'settings.allowSelfSignedDesc',
    type: 'switch',
    keywords: ['self-signed', 'certificate', 'trust', '自签名', '证书', '信任'],
    advanced: true,
  },

  // Mirrors Settings
  {
    key: 'mirrors.npm',
    section: 'mirrors',
    labelKey: 'settings.npmRegistry',
    descKey: 'settings.npmRegistryDesc',
    type: 'input',
    keywords: ['npm', 'registry', 'node', 'javascript', 'pnpm', 'yarn', '镜像', '源'],
  },
  {
    key: 'mirrors.pypi',
    section: 'mirrors',
    labelKey: 'settings.pypiIndex',
    descKey: 'settings.pypiIndexDesc',
    type: 'input',
    keywords: ['pypi', 'pip', 'python', 'uv', '镜像', '源'],
  },
  {
    key: 'mirrors.crates',
    section: 'mirrors',
    labelKey: 'settings.cratesRegistry',
    descKey: 'settings.cratesRegistryDesc',
    type: 'input',
    keywords: ['crates', 'cargo', 'rust', '镜像', '源'],
  },
  {
    key: 'mirrors.go',
    section: 'mirrors',
    labelKey: 'settings.goProxy',
    descKey: 'settings.goProxyDesc',
    type: 'input',
    keywords: ['go', 'golang', 'goproxy', 'module', '镜像', '源'],
  },

  // Appearance Settings
  {
    key: 'appearance.theme',
    section: 'appearance',
    labelKey: 'settings.theme',
    descKey: 'settings.themeDesc',
    type: 'select',
    keywords: ['theme', 'dark', 'light', 'system', '主题', '深色', '浅色', '外观'],
  },
  {
    key: 'appearance.chart_color_theme',
    section: 'appearance',
    labelKey: 'settings.chartColorTheme',
    descKey: 'settings.chartColorThemeDesc',
    type: 'select',
    keywords: ['chart', 'color', 'theme', 'dashboard', 'graph', '图表', '颜色', '主题', '仪表盘'],
  },
  {
    key: 'appearance.language',
    section: 'appearance',
    labelKey: 'settings.language',
    descKey: 'settings.languageDesc',
    type: 'select',
    keywords: ['language', 'locale', 'english', 'chinese', '语言', '中文', '英文'],
  },
  {
    key: 'appearance.accent_color',
    section: 'appearance',
    labelKey: 'settings.accentColor',
    descKey: 'settings.accentColorDesc',
    type: 'select',
    keywords: ['accent', 'color', 'primary', '强调色', '主色', '颜色'],
  },
  {
    key: 'appearance.reduced_motion',
    section: 'appearance',
    labelKey: 'settings.reducedMotion',
    descKey: 'settings.reducedMotionDesc',
    type: 'switch',
    keywords: ['motion', 'animation', 'transition', 'accessibility', '动画', '过渡', '无障碍'],
  },

  // Update Settings
  {
    key: 'updates.check_on_start',
    section: 'updates',
    labelKey: 'settings.checkUpdatesOnStart',
    descKey: 'settings.checkUpdatesOnStartDesc',
    type: 'switch',
    keywords: ['update', 'check', 'startup', 'auto', '更新', '检查', '启动'],
    tauriOnly: true,
  },
  {
    key: 'updates.auto_install',
    section: 'updates',
    labelKey: 'settings.autoInstallUpdates',
    descKey: 'settings.autoInstallUpdatesDesc',
    type: 'switch',
    keywords: ['update', 'auto', 'install', '更新', '自动', '安装'],
    tauriOnly: true,
  },
  {
    key: 'updates.notify',
    section: 'updates',
    labelKey: 'settings.notifyOnUpdates',
    descKey: 'settings.notifyOnUpdatesDesc',
    type: 'switch',
    keywords: ['update', 'notify', 'notification', '更新', '通知'],
    tauriOnly: true,
  },

  // Tray Settings
  {
    key: 'tray.minimize_to_tray',
    section: 'tray',
    labelKey: 'settings.minimizeToTray',
    descKey: 'settings.minimizeToTrayDesc',
    type: 'switch',
    keywords: ['tray', 'minimize', 'close', 'system', '托盘', '最小化', '关闭'],
    tauriOnly: true,
  },
  {
    key: 'tray.start_minimized',
    section: 'tray',
    labelKey: 'settings.startMinimized',
    descKey: 'settings.startMinimizedDesc',
    type: 'switch',
    keywords: ['startup', 'minimized', 'hidden', 'background', '启动', '最小化', '后台'],
    tauriOnly: true,
  },
  {
    key: 'tray.autostart',
    section: 'tray',
    labelKey: 'settings.autostart',
    descKey: 'settings.autostartDesc',
    type: 'switch',
    keywords: ['autostart', 'boot', 'startup', 'login', '自启动', '开机', '登录'],
    tauriOnly: true,
  },
  {
    key: 'tray.show_notifications',
    section: 'tray',
    labelKey: 'settings.showNotifications',
    descKey: 'settings.showNotificationsDesc',
    type: 'switch',
    keywords: ['notification', 'alert', 'popup', '通知', '提醒', '弹窗'],
    tauriOnly: true,
  },
  {
    key: 'tray.click_behavior',
    section: 'tray',
    labelKey: 'settings.trayClickBehavior',
    descKey: 'settings.trayClickBehaviorDesc',
    type: 'select',
    keywords: ['tray', 'click', 'action', 'behavior', '托盘', '点击', '行为'],
    tauriOnly: true,
  },

  // Paths Settings
  {
    key: 'paths.root',
    section: 'paths',
    labelKey: 'settings.pathRoot',
    descKey: 'settings.pathRootDesc',
    type: 'input',
    keywords: ['path', 'root', 'directory', 'folder', 'data', '路径', '根目录', '文件夹', '数据'],
    advanced: true,
  },
  {
    key: 'paths.cache',
    section: 'paths',
    labelKey: 'settings.pathCache',
    descKey: 'settings.pathCacheDesc',
    type: 'input',
    keywords: ['path', 'cache', 'directory', 'folder', '路径', '缓存', '文件夹'],
    advanced: true,
  },
  {
    key: 'paths.environments',
    section: 'paths',
    labelKey: 'settings.pathEnvironments',
    descKey: 'settings.pathEnvironmentsDesc',
    type: 'input',
    keywords: ['path', 'environment', 'directory', 'folder', '路径', '环境', '文件夹'],
    advanced: true,
  },

  // Provider Settings
  {
    key: 'provider_settings.disabled_providers',
    section: 'provider',
    labelKey: 'settings.disabledProviders',
    descKey: 'settings.disabledProvidersDesc',
    type: 'input',
    keywords: ['provider', 'disable', 'package', 'manager', '提供者', '禁用', '包管理器'],
    advanced: true,
  },
];

/**
 * Get settings by section
 */
export function getSettingsBySection(section: SettingsSection): SettingDefinition[] {
  return SETTINGS_REGISTRY.filter((s) => s.section === section);
}

/**
 * Get section definition by ID
 */
export function getSectionById(id: SettingsSection): SectionDefinition | undefined {
  return SETTINGS_SECTIONS.find((s) => s.id === id);
}

/**
 * Get all section IDs in order
 */
export function getOrderedSectionIds(): SettingsSection[] {
  return SETTINGS_SECTIONS.sort((a, b) => a.order - b.order).map((s) => s.id);
}
