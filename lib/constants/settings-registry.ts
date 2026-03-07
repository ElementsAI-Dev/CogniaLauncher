/**
 * Settings Registry - Metadata for all settings items
 * Used for search functionality and navigation
 */

import {
  Settings2,
  Network,
  Shield,
  Server,
  Palette,
  RefreshCw,
  Monitor,
  FolderOpen,
  Package,
  Archive,
  Info,
  Zap,
  Keyboard,
  type LucideIcon,
} from "lucide-react";

/** Icon map for settings sections, keyed by icon name string */
export const SECTION_ICONS: Record<string, LucideIcon> = {
  Settings2,
  Network,
  Shield,
  Server,
  Palette,
  RefreshCw,
  Monitor,
  FolderOpen,
  Package,
  Archive,
  Info,
  Zap,
  Keyboard,
};

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
  | 'backup'
  | 'shortcuts'
  | 'startup'
  | 'system';

export type SettingType = 'input' | 'switch' | 'select';

export interface SettingDefinition {
  /** Unique key matching the config key, e.g., 'general.parallel_downloads' */
  key: string;
  /** Optional DOM id used for focusing from search navigation */
  focusId?: string;
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

const SETTING_FOCUS_IDS: Record<string, string> = {
  // General
  "general.parallel_downloads": "parallel-downloads",
  "general.min_install_space_mb": "min-install-space",
  "general.metadata_cache_ttl": "metadata-cache-ttl",
  "general.resolve_strategy": "resolve-strategy",
  "general.auto_update_metadata": "auto-update-metadata",
  "general.cache_max_size": "cache-max-size",
  "general.cache_max_age_days": "cache-max-age-days",
  "general.auto_clean_cache": "auto-clean-cache",
  "general.cache_auto_clean_threshold": "cache-auto-clean-threshold",
  "general.cache_monitor_interval": "cache-monitor-interval",
  "general.cache_monitor_external": "cache-monitor-external",
  "general.custom_cache_entries": "custom-cache-entries",
  "general.external_cache_excluded_providers": "external-cache-excluded-providers",
  "general.download_speed_limit": "download-speed-limit",
  "general.update_check_concurrency": "update-check-concurrency",

  // Network
  "network.timeout": "network-timeout",
  "network.retries": "network-retries",
  "network.proxy": "network-proxy",
  "network.no_proxy": "network-no-proxy",

  // Security
  "security.allow_http": "allow-http",
  "security.verify_certificates": "verify-certs",
  "security.allow_self_signed": "allow-self-signed",

  // Mirrors
  "mirrors.npm": "mirrors-npm",
  "mirrors.pypi": "mirrors-pypi",
  "mirrors.crates": "mirrors-crates",
  "mirrors.go": "mirrors-go",

  // Appearance
  "appearance.theme": "theme-select",
  "appearance.chart_color_theme": "chart-color-theme",
  "appearance.language": "language-select",
  "appearance.accent_color": "accent-color-label",
  "appearance.interface_radius": "interface-radius-label",
  "appearance.interface_density": "interface-density",
  "appearance.reduced_motion": "reduced-motion",
  "appearance.background_image": "background-enabled",
  "appearance.window_effect": "window-effect",

  // Updates
  "updates.check_on_start": "check-updates-on-start",
  "updates.auto_install": "auto-install-updates",
  "updates.notify": "notify-on-updates",

  // Tray
  "tray.minimize_to_tray": "minimize-to-tray",
  "tray.start_minimized": "start-minimized",
  "tray.autostart": "autostart",
  "tray.show_notifications": "show-notifications",
  "tray.click_behavior": "tray-click-behavior",
  "tray.menu_customize": "tray-menu-customize",

  // Paths
  "paths.root": "paths-root",
  "paths.cache": "paths-cache",
  "paths.environments": "paths-environments",

  // Providers
  "provider_settings.disabled_providers": "disabled-providers",

  // Backup policy
  "backup.auto_backup_enabled": "backup-auto-enabled",
  "backup.auto_backup_interval_hours": "backup-auto-interval-hours",
  "backup.max_backups": "backup-max-backups",
  "backup.retention_days": "backup-retention-days",

  // Startup
  // Shortcuts
  "shortcuts.enabled": "shortcuts-enabled",
  "shortcuts.toggle_window": "shortcuts-toggle-window",
  "shortcuts.command_palette": "shortcuts-command-palette",
  "shortcuts.quick_search": "shortcuts-quick-search",

  // Startup
  "startup.scan_environments": "startup-scan-environments",
  "startup.scan_packages": "startup-scan-packages",
  "startup.max_concurrent_scans": "startup-max-concurrent-scans",
  "startup.startup_timeout_secs": "startup-timeout-secs",
  "startup.integrity_check": "startup-integrity-check",
};

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
    id: 'shortcuts',
    labelKey: 'settings.shortcuts',
    descKey: 'settings.shortcutsDesc',
    icon: 'Keyboard',
    order: 8,
  },
  {
    id: 'paths',
    labelKey: 'settings.paths',
    descKey: 'settings.pathsDesc',
    icon: 'FolderOpen',
    order: 9,
  },
  {
    id: 'provider',
    labelKey: 'settings.providerSettings',
    descKey: 'settings.providerSettingsDesc',
    icon: 'Package',
    order: 10,
  },
  {
    id: 'backup',
    labelKey: 'backup.title',
    descKey: 'backup.description',
    icon: 'Archive',
    order: 11,
  },
  {
    id: 'startup',
    labelKey: 'settings.startup',
    descKey: 'settings.startupDesc',
    icon: 'Zap',
    order: 12,
  },
  {
    id: 'system',
    labelKey: 'settings.systemInfo',
    descKey: 'settings.systemInfoDesc',
    icon: 'Info',
    order: 13,
  },
];

/**
 * Complete registry of all settings items
 */
const SETTINGS_REGISTRY_BASE: SettingDefinition[] = [
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
  {
    key: 'general.update_check_concurrency',
    section: 'general',
    labelKey: 'settings.updateCheckConcurrency',
    descKey: 'settings.updateCheckConcurrencyDesc',
    type: 'input',
    keywords: ['update', 'check', 'concurrency', 'parallel', 'thread', '更新', '检查', '并发', '线程'],
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
  {
    key: 'network.no_proxy',
    section: 'network',
    labelKey: 'settings.noProxyGlobal',
    descKey: 'settings.noProxyGlobalDesc',
    type: 'input',
    keywords: ['proxy', 'bypass', 'no_proxy', 'exclude', '代理', '绕过', '排除'],
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
    key: 'appearance.interface_radius',
    section: 'appearance',
    labelKey: 'settings.interfaceRadius',
    descKey: 'settings.interfaceRadiusDesc',
    type: 'select',
    keywords: ['radius', 'border', 'round', 'corner', 'shape', '圆角', '边框', '形状'],
  },
  {
    key: 'appearance.interface_density',
    section: 'appearance',
    labelKey: 'settings.interfaceDensity',
    descKey: 'settings.interfaceDensityDesc',
    type: 'select',
    keywords: ['density', 'compact', 'spacing', 'comfortable', 'spacious', '密度', '紧凑', '间距', '宽松'],
  },
  {
    key: 'appearance.reduced_motion',
    section: 'appearance',
    labelKey: 'settings.reducedMotion',
    descKey: 'settings.reducedMotionDesc',
    type: 'switch',
    keywords: ['motion', 'animation', 'transition', 'accessibility', '动画', '过渡', '无障碍'],
  },
  {
    key: 'appearance.background_image',
    section: 'appearance',
    labelKey: 'settings.backgroundImage',
    descKey: 'settings.backgroundImageDesc',
    type: 'switch',
    keywords: ['background', 'image', 'wallpaper', 'picture', '背景', '图片', '壁纸'],
  },
  {
    key: 'appearance.window_effect',
    section: 'appearance',
    labelKey: 'settings.windowEffect',
    descKey: 'settings.windowEffectDesc',
    type: 'select',
    keywords: ['transparent', 'mica', 'acrylic', 'blur', 'vibrancy', 'glass', 'effect', '透明', '毛玻璃', '磨砂', '效果', '云母'],
    tauriOnly: true,
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
    key: 'tray.notification_level',
    section: 'tray',
    labelKey: 'settings.trayNotificationLevel',
    descKey: 'settings.trayNotificationLevelDesc',
    type: 'select',
    keywords: ['tray', 'notification', 'level', 'important', '托盘', '通知', '级别', '重要'],
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
  {
    key: 'tray.menu_customize',
    section: 'tray',
    labelKey: 'settings.trayMenuCustomize',
    descKey: 'settings.trayMenuCustomizeDesc',
    type: 'select',
    keywords: ['tray', 'menu', 'customize', 'order', 'reorder', '托盘', '菜单', '自定义', '排序'],
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

  // Backup Settings
  {
    key: 'backup.auto_backup_enabled',
    section: 'backup',
    labelKey: 'settings.backupAutoBackupEnabled',
    descKey: 'settings.backupAutoBackupEnabledDesc',
    type: 'switch',
    keywords: ['backup', 'auto', 'schedule', '备份', '自动', '计划'],
    tauriOnly: true,
  },
  {
    key: 'backup.auto_backup_interval_hours',
    section: 'backup',
    labelKey: 'settings.backupAutoBackupIntervalHours',
    descKey: 'settings.backupAutoBackupIntervalHoursDesc',
    type: 'input',
    keywords: ['backup', 'interval', 'hours', 'frequency', '备份', '间隔', '小时', '频率'],
    tauriOnly: true,
  },
  {
    key: 'backup.max_backups',
    section: 'backup',
    labelKey: 'settings.backupMaxBackups',
    descKey: 'settings.backupMaxBackupsDesc',
    type: 'input',
    keywords: ['backup', 'limit', 'max', 'count', '备份', '数量', '上限'],
    tauriOnly: true,
  },
  {
    key: 'backup.retention_days',
    section: 'backup',
    labelKey: 'settings.backupRetentionDays',
    descKey: 'settings.backupRetentionDaysDesc',
    type: 'input',
    keywords: ['backup', 'retention', 'days', 'cleanup', '备份', '保留', '天数', '清理'],
    tauriOnly: true,
  },

  // Startup Settings
  {
    key: 'startup.scan_environments',
    section: 'startup',
    labelKey: 'settings.startupScanEnvironments',
    descKey: 'settings.startupScanEnvironmentsDesc',
    type: 'switch',
    keywords: ['startup', 'scan', 'environment', 'launch', 'boot', '启动', '扫描', '环境'],
  },
  {
    key: 'startup.scan_packages',
    section: 'startup',
    labelKey: 'settings.startupScanPackages',
    descKey: 'settings.startupScanPackagesDesc',
    type: 'switch',
    keywords: ['startup', 'scan', 'package', 'launch', 'boot', '启动', '扫描', '包'],
  },
  {
    key: 'startup.max_concurrent_scans',
    section: 'startup',
    labelKey: 'settings.startupMaxConcurrentScans',
    descKey: 'settings.startupMaxConcurrentScansDesc',
    type: 'input',
    keywords: ['startup', 'concurrent', 'parallel', 'scan', 'performance', '启动', '并发', '扫描'],
  },
  {
    key: 'startup.startup_timeout_secs',
    section: 'startup',
    labelKey: 'settings.startupTimeoutSecs',
    descKey: 'settings.startupTimeoutSecsDesc',
    type: 'input',
    keywords: ['startup', 'timeout', 'launch', 'boot', '启动', '超时'],
  },
  {
    key: 'startup.integrity_check',
    section: 'startup',
    labelKey: 'settings.startupIntegrityCheck',
    descKey: 'settings.startupIntegrityCheckDesc',
    type: 'switch',
    keywords: ['startup', 'integrity', 'check', 'cache', 'database', '启动', '完整性', '检查'],
  },

  // Shortcuts Settings
  {
    key: 'shortcuts.enabled',
    section: 'shortcuts',
    labelKey: 'settings.shortcutsEnabled',
    descKey: 'settings.shortcutsEnabledDesc',
    type: 'switch',
    keywords: ['shortcut', 'hotkey', 'global', 'keyboard', '快捷键', '热键', '全局', '键盘'],
    tauriOnly: true,
  },
  {
    key: 'shortcuts.toggle_window',
    section: 'shortcuts',
    labelKey: 'settings.shortcutsToggleWindow',
    descKey: 'settings.shortcutsToggleWindowDesc',
    type: 'input',
    keywords: ['shortcut', 'toggle', 'window', 'show', 'hide', '快捷键', '切换', '窗口', '显示', '隐藏'],
    tauriOnly: true,
  },
  {
    key: 'shortcuts.command_palette',
    section: 'shortcuts',
    labelKey: 'settings.shortcutsCommandPalette',
    descKey: 'settings.shortcutsCommandPaletteDesc',
    type: 'input',
    keywords: ['shortcut', 'command', 'palette', 'search', '快捷键', '命令', '面板', '搜索'],
    tauriOnly: true,
  },
  {
    key: 'shortcuts.quick_search',
    section: 'shortcuts',
    labelKey: 'settings.shortcutsQuickSearch',
    descKey: 'settings.shortcutsQuickSearchDesc',
    type: 'input',
    keywords: ['shortcut', 'search', 'quick', 'find', '快捷键', '搜索', '快速', '查找'],
    tauriOnly: true,
  },
];

export const SETTINGS_REGISTRY: SettingDefinition[] = SETTINGS_REGISTRY_BASE.map((setting) => ({
  ...setting,
  focusId: SETTING_FOCUS_IDS[setting.key] ?? setting.focusId,
}));

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
  return [...SETTINGS_SECTIONS].sort((a, b) => a.order - b.order).map((s) => s.id);
}
