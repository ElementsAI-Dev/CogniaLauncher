import type { WslSettingDef, QuickSetting } from '@/types/wsl';

// ============================================================================
// Validation helpers
// ============================================================================

const validateSize = (v: string): string | null =>
  /^\d+(\.\d+)?\s*(B|KB|MB|GB|TB)$/i.test(v.trim()) ? null : 'Must be a size like 4GB, 512MB, or 1TB';

const validatePositiveInt = (v: string): string | null =>
  /^\d+$/.test(v.trim()) && parseInt(v.trim(), 10) > 0 ? null : 'Must be a positive integer';

const validateNonNegativeInt = (v: string): string | null =>
  /^\d+$/.test(v.trim()) ? null : 'Must be a non-negative integer';

const validateWindowsPath = (v: string): string | null =>
  /^[A-Za-z]:[\\\/]/.test(v.trim()) || v.trim().startsWith('%') ? null : 'Must be a valid Windows path (e.g. C:\\...)';

const validatePortList = (v: string): string | null =>
  v.trim().split(',').every(p => /^\d+$/.test(p.trim()) && parseInt(p.trim(), 10) <= 65535)
    ? null : 'Must be comma-separated port numbers (0-65535)';

const validateIpv4 = (v: string): string | null =>
  /^(\d{1,3}\.){3}\d{1,3}$/.test(v.trim()) ? null : 'Must be a valid IPv4 address';

/** Common WSL2 global settings for .wslconfig */
export const COMMON_WSL2_SETTINGS: WslSettingDef[] = [
  // [wsl2] section
  { key: 'memory', label: 'Memory', placeholder: '4GB', description: 'wsl.config.memoryDesc', type: 'text', section: 'wsl2', validate: validateSize },
  { key: 'processors', label: 'Processors', placeholder: '2', description: 'wsl.config.processorsDesc', type: 'number', section: 'wsl2', validate: validatePositiveInt },
  { key: 'swap', label: 'Swap', placeholder: '8GB', description: 'wsl.config.swapDesc', type: 'text', section: 'wsl2', validate: validateSize },
  { key: 'localhostForwarding', label: 'Localhost Forwarding', placeholder: 'true', description: 'wsl.config.localhostForwardingDesc', type: 'bool', section: 'wsl2' },
  { key: 'nestedVirtualization', label: 'Nested Virtualization', placeholder: 'true', description: 'wsl.config.nestedVirtualizationDesc', type: 'bool', section: 'wsl2' },
  { key: 'guiApplications', label: 'GUI Applications', placeholder: 'true', description: 'wsl.config.guiApplicationsDesc', type: 'bool', section: 'wsl2' },
  { key: 'networkingMode', label: 'Networking Mode', placeholder: 'NAT', description: 'wsl.config.networkingModeDesc', type: 'select', options: ['NAT', 'mirrored', 'virtioproxy'], section: 'wsl2' },
  { key: 'dnsProxy', label: 'DNS Proxy', placeholder: 'true', description: 'wsl.config.dnsProxyDesc', type: 'bool', section: 'wsl2' },
  { key: 'kernel', label: 'Custom Kernel', placeholder: 'C:\\path\\to\\kernel', description: 'wsl.config.kernelDesc', type: 'path', section: 'wsl2', validate: validateWindowsPath },
  { key: 'kernelModules', label: 'Kernel Modules VHD', placeholder: 'C:\\path\\to\\modules.vhdx', description: 'wsl.config.kernelModulesDesc', type: 'path', section: 'wsl2', validate: validateWindowsPath },
  { key: 'kernelCommandLine', label: 'Kernel Command Line', placeholder: 'vsyscall=emulate', description: 'wsl.config.kernelCommandLineDesc', type: 'text', section: 'wsl2' },
  { key: 'swapFile', label: 'Swap File Path', placeholder: '%Temp%\\swap.vhdx', description: 'wsl.config.swapFileDesc', type: 'path', section: 'wsl2', validate: validateWindowsPath },
  { key: 'safeMode', label: 'Safe Mode', placeholder: 'false', description: 'wsl.config.safeModeDesc', type: 'bool', section: 'wsl2' },
  { key: 'debugConsole', label: 'Debug Console', placeholder: 'false', description: 'wsl.config.debugConsoleDesc', type: 'bool', section: 'wsl2' },
  { key: 'maxCrashDumpCount', label: 'Max Crash Dumps', placeholder: '10', description: 'wsl.config.maxCrashDumpCountDesc', type: 'number', section: 'wsl2', validate: validateNonNegativeInt },
  { key: 'vmIdleTimeout', label: 'VM Idle Timeout (ms)', placeholder: '60000', description: 'wsl.config.vmIdleTimeoutDesc', type: 'number', section: 'wsl2', validate: validateNonNegativeInt },
  { key: 'defaultVhdSize', label: 'Default VHD Size', placeholder: '1TB', description: 'wsl.config.defaultVhdSizeDesc', type: 'text', section: 'wsl2', validate: validateSize },
  // [experimental] section
  { key: 'autoMemoryReclaim', label: 'Auto Memory Reclaim', placeholder: 'disabled', description: 'wsl.config.autoMemoryReclaimDesc', type: 'select', options: ['disabled', 'gradual', 'dropcache'], section: 'experimental' },
  { key: 'sparseVhd', label: 'Sparse VHD', placeholder: 'true', description: 'wsl.config.sparseVhdDesc', type: 'bool', section: 'experimental' },
  { key: 'dnsTunneling', label: 'DNS Tunneling', placeholder: 'true', description: 'wsl.config.dnsTunnelingDesc', type: 'bool', section: 'experimental' },
  { key: 'firewall', label: 'Firewall', placeholder: 'true', description: 'wsl.config.firewallDesc', type: 'bool', section: 'experimental' },
  { key: 'autoProxy', label: 'Auto Proxy', placeholder: 'true', description: 'wsl.config.autoProxyDesc', type: 'bool', section: 'experimental' },
  { key: 'hostAddressLoopback', label: 'Host Address Loopback', placeholder: 'true', description: 'wsl.config.hostAddressLoopbackDesc', type: 'bool', section: 'experimental' },
  { key: 'bestEffortDnsParsing', label: 'Best-Effort DNS Parsing', placeholder: 'false', description: 'wsl.config.bestEffortDnsParsingDesc', type: 'bool', section: 'experimental' },
  { key: 'dnsTunnelingIpAddress', label: 'DNS Tunneling IP', placeholder: '10.255.255.254', description: 'wsl.config.dnsTunnelingIpAddressDesc', type: 'text', section: 'experimental', validate: validateIpv4 },
  { key: 'initialAutoProxyTimeout', label: 'Auto Proxy Timeout (ms)', placeholder: '1000', description: 'wsl.config.initialAutoProxyTimeoutDesc', type: 'number', section: 'experimental', validate: validateNonNegativeInt },
  { key: 'ignoredPorts', label: 'Ignored Ports', placeholder: '3000,9000,9090', description: 'wsl.config.ignoredPortsDesc', type: 'text', section: 'experimental', validate: validatePortList },
];

/** Per-distro quick settings for /etc/wsl.conf */
export const QUICK_SETTINGS: QuickSetting[] = [
  { section: 'boot', key: 'systemd', labelKey: 'wsl.distroConfig.systemd', descKey: 'wsl.distroConfig.systemdDesc', type: 'boolean', defaultValue: 'false' },
  { section: 'automount', key: 'enabled', labelKey: 'wsl.distroConfig.automount', descKey: 'wsl.distroConfig.automountDesc', type: 'boolean', defaultValue: 'true' },
  { section: 'automount', key: 'root', labelKey: 'wsl.distroConfig.automountRoot', descKey: 'wsl.distroConfig.automountRootDesc', type: 'text', defaultValue: '/mnt/' },
  { section: 'automount', key: 'options', labelKey: 'wsl.distroConfig.automountOptions', descKey: 'wsl.distroConfig.automountOptionsDesc', type: 'text', defaultValue: '' },
  { section: 'network', key: 'generateHosts', labelKey: 'wsl.distroConfig.generateHosts', descKey: 'wsl.distroConfig.generateHostsDesc', type: 'boolean', defaultValue: 'true' },
  { section: 'network', key: 'generateResolvConf', labelKey: 'wsl.distroConfig.generateResolvConf', descKey: 'wsl.distroConfig.generateResolvConfDesc', type: 'boolean', defaultValue: 'true' },
  { section: 'network', key: 'hostname', labelKey: 'wsl.distroConfig.hostname', descKey: 'wsl.distroConfig.hostnameDesc', type: 'text', defaultValue: '' },
  { section: 'interop', key: 'enabled', labelKey: 'wsl.distroConfig.interop', descKey: 'wsl.distroConfig.interopDesc', type: 'boolean', defaultValue: 'true' },
  { section: 'interop', key: 'appendWindowsPath', labelKey: 'wsl.distroConfig.appendWindowsPath', descKey: 'wsl.distroConfig.appendWindowsPathDesc', type: 'boolean', defaultValue: 'true' },
  { section: 'gpu', key: 'enabled', labelKey: 'wsl.distroConfig.gpuEnabled', descKey: 'wsl.distroConfig.gpuEnabledDesc', type: 'boolean', defaultValue: 'true' },
  { section: 'time', key: 'useWindowsTimezone', labelKey: 'wsl.distroConfig.useWindowsTimezone', descKey: 'wsl.distroConfig.useWindowsTimezoneDesc', type: 'boolean', defaultValue: 'true' },
  { section: 'automount', key: 'mountFsTab', labelKey: 'wsl.distroConfig.mountFsTab', descKey: 'wsl.distroConfig.mountFsTabDesc', type: 'boolean', defaultValue: 'true' },
  { section: 'boot', key: 'command', labelKey: 'wsl.distroConfig.bootCommand', descKey: 'wsl.distroConfig.bootCommandDesc', type: 'text', defaultValue: '' },
  { section: 'boot', key: 'protectBinfmt', labelKey: 'wsl.distroConfig.protectBinfmt', descKey: 'wsl.distroConfig.protectBinfmtDesc', type: 'boolean', defaultValue: 'true' },
];

/** Network configuration presets for .wslconfig */
export interface WslNetworkPreset {
  id: string;
  labelKey: string;
  descKey: string;
  settings: { section: 'wsl2' | 'experimental'; key: string; value: string }[];
}

export const NETWORK_PRESETS: WslNetworkPreset[] = [
  {
    id: 'vpn-optimized',
    labelKey: 'wsl.preset.vpnOptimized',
    descKey: 'wsl.preset.vpnOptimizedDesc',
    settings: [
      { section: 'wsl2', key: 'networkingMode', value: 'mirrored' },
      { section: 'experimental', key: 'dnsTunneling', value: 'true' },
      { section: 'experimental', key: 'autoProxy', value: 'true' },
      { section: 'experimental', key: 'firewall', value: 'true' },
    ],
  },
  {
    id: 'developer',
    labelKey: 'wsl.preset.developer',
    descKey: 'wsl.preset.developerDesc',
    settings: [
      { section: 'wsl2', key: 'networkingMode', value: 'mirrored' },
      { section: 'experimental', key: 'dnsTunneling', value: 'true' },
      { section: 'experimental', key: 'autoProxy', value: 'true' },
      { section: 'experimental', key: 'firewall', value: 'true' },
      { section: 'experimental', key: 'hostAddressLoopback', value: 'true' },
      { section: 'experimental', key: 'sparseVhd', value: 'true' },
      { section: 'experimental', key: 'autoMemoryReclaim', value: 'gradual' },
    ],
  },
  {
    id: 'classic-nat',
    labelKey: 'wsl.preset.classicNat',
    descKey: 'wsl.preset.classicNatDesc',
    settings: [
      { section: 'wsl2', key: 'networkingMode', value: 'NAT' },
      { section: 'wsl2', key: 'localhostForwarding', value: 'true' },
    ],
  },
];

/** Resource configuration profiles for .wslconfig (full system profiles) */
export const CONFIG_PROFILES: WslNetworkPreset[] = [
  {
    id: 'lightweight',
    labelKey: 'wsl.profile.lightweight',
    descKey: 'wsl.profile.lightweightDesc',
    settings: [
      { section: 'wsl2', key: 'memory', value: '2GB' },
      { section: 'wsl2', key: 'processors', value: '2' },
      { section: 'wsl2', key: 'swap', value: '2GB' },
      { section: 'experimental', key: 'autoMemoryReclaim', value: 'gradual' },
      { section: 'experimental', key: 'sparseVhd', value: 'true' },
    ],
  },
  {
    id: 'standard-dev',
    labelKey: 'wsl.profile.standardDev',
    descKey: 'wsl.profile.standardDevDesc',
    settings: [
      { section: 'wsl2', key: 'memory', value: '4GB' },
      { section: 'wsl2', key: 'processors', value: '4' },
      { section: 'wsl2', key: 'swap', value: '8GB' },
      { section: 'wsl2', key: 'localhostForwarding', value: 'true' },
      { section: 'experimental', key: 'sparseVhd', value: 'true' },
    ],
  },
  {
    id: 'heavy-dev',
    labelKey: 'wsl.profile.heavyDev',
    descKey: 'wsl.profile.heavyDevDesc',
    settings: [
      { section: 'wsl2', key: 'memory', value: '8GB' },
      { section: 'wsl2', key: 'processors', value: '8' },
      { section: 'wsl2', key: 'swap', value: '8GB' },
      { section: 'wsl2', key: 'nestedVirtualization', value: 'true' },
      { section: 'wsl2', key: 'networkingMode', value: 'mirrored' },
      { section: 'experimental', key: 'dnsTunneling', value: 'true' },
      { section: 'experimental', key: 'autoProxy', value: 'true' },
      { section: 'experimental', key: 'sparseVhd', value: 'true' },
      { section: 'experimental', key: 'autoMemoryReclaim', value: 'gradual' },
    ],
  },
  {
    id: 'ai-ml',
    labelKey: 'wsl.profile.aiMl',
    descKey: 'wsl.profile.aiMlDesc',
    settings: [
      { section: 'wsl2', key: 'memory', value: '16GB' },
      { section: 'wsl2', key: 'processors', value: '12' },
      { section: 'wsl2', key: 'swap', value: '16GB' },
      { section: 'wsl2', key: 'nestedVirtualization', value: 'true' },
      { section: 'wsl2', key: 'guiApplications', value: 'true' },
      { section: 'experimental', key: 'sparseVhd', value: 'true' },
      { section: 'experimental', key: 'autoMemoryReclaim', value: 'gradual' },
    ],
  },
  {
    id: 'minimal-ci',
    labelKey: 'wsl.profile.minimalCi',
    descKey: 'wsl.profile.minimalCiDesc',
    settings: [
      { section: 'wsl2', key: 'memory', value: '1GB' },
      { section: 'wsl2', key: 'processors', value: '1' },
      { section: 'wsl2', key: 'swap', value: '0' },
      { section: 'experimental', key: 'autoMemoryReclaim', value: 'dropcache' },
      { section: 'experimental', key: 'sparseVhd', value: 'true' },
    ],
  },
];

/** Preset commands for WSL terminal quick execution */
export interface WslSavedCommandDef {
  id: string;
  name: string;
  command: string;
  user?: string;
  isPreset: true;
}

export const PRESET_COMMANDS: WslSavedCommandDef[] = [
  { id: 'preset-update-apt', name: 'System Update (apt)', command: 'sudo apt update && sudo apt upgrade -y', isPreset: true },
  { id: 'preset-update-pacman', name: 'System Update (pacman)', command: 'sudo pacman -Syu --noconfirm', isPreset: true },
  { id: 'preset-update-dnf', name: 'System Update (dnf)', command: 'sudo dnf upgrade -y', isPreset: true },
  { id: 'preset-cleanup-apt', name: 'Cleanup (apt)', command: 'sudo apt autoremove -y && sudo apt clean', isPreset: true },
  { id: 'preset-disk', name: 'Disk Usage', command: 'df -h', isPreset: true },
  { id: 'preset-memory', name: 'Memory Usage', command: 'free -h', isPreset: true },
  { id: 'preset-processes', name: 'Top Processes', command: 'top -b -n 1 | head -20', isPreset: true },
  { id: 'preset-network', name: 'Network Info', command: 'ip addr && echo "---" && cat /etc/resolv.conf', isPreset: true },
  { id: 'preset-dns-test', name: 'DNS Test', command: 'nslookup google.com', isPreset: true },
  { id: 'preset-uptime', name: 'Uptime & Load', command: 'uptime', isPreset: true },
];

/** Boot command presets for wsl.conf [boot] command */
export interface BootCommandPreset {
  id: string;
  labelKey: string;
  command: string;
}

export const BOOT_COMMAND_PRESETS: BootCommandPreset[] = [
  { id: 'docker', labelKey: 'wsl.bootPreset.docker', command: 'service docker start' },
  { id: 'ssh', labelKey: 'wsl.bootPreset.ssh', command: 'service ssh start' },
  { id: 'cron', labelKey: 'wsl.bootPreset.cron', command: 'service cron start' },
  { id: 'docker-ssh', labelKey: 'wsl.bootPreset.dockerSsh', command: 'service docker start && service ssh start' },
  { id: 'mysql', labelKey: 'wsl.bootPreset.mysql', command: 'service mysql start' },
  { id: 'postgresql', labelKey: 'wsl.bootPreset.postgresql', command: 'service postgresql start' },
  { id: 'redis', labelKey: 'wsl.bootPreset.redis', command: 'service redis-server start' },
  { id: 'nginx', labelKey: 'wsl.bootPreset.nginx', command: 'service nginx start' },
  { id: 'apache', labelKey: 'wsl.bootPreset.apache', command: 'service apache2 start' },
  { id: 'all-dev', labelKey: 'wsl.bootPreset.allDev', command: 'service docker start && service ssh start && service cron start && service redis-server start' },
];

/** Networking mode descriptions for status display */
export const NETWORKING_MODE_INFO: Record<string, { labelKey: string; descKey: string; color: string }> = {
  NAT: { labelKey: 'wsl.netMode.nat', descKey: 'wsl.netMode.natDesc', color: 'blue' },
  mirrored: { labelKey: 'wsl.netMode.mirrored', descKey: 'wsl.netMode.mirroredDesc', color: 'green' },
  virtioproxy: { labelKey: 'wsl.netMode.virtioproxy', descKey: 'wsl.netMode.virtioproxyDesc', color: 'amber' },
  none: { labelKey: 'wsl.netMode.none', descKey: 'wsl.netMode.noneDesc', color: 'red' },
};

/** Package manager display name mapping */
export const PM_LABELS: Record<string, string> = {
  apt: 'APT (dpkg)',
  pacman: 'Pacman',
  dnf: 'DNF (rpm)',
  yum: 'YUM (rpm)',
  zypper: 'Zypper (rpm)',
  apk: 'APK',
  'xbps-install': 'XBPS',
  emerge: 'Portage',
  nix: 'Nix',
  swupd: 'swupd',
  eopkg: 'eopkg',
};
