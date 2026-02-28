import type { WslSettingDef, QuickSetting } from '@/types/wsl';

/** Common WSL2 global settings for .wslconfig */
export const COMMON_WSL2_SETTINGS: WslSettingDef[] = [
  // [wsl2] section
  { key: 'memory', label: 'Memory', placeholder: '4GB', description: 'wsl.config.memoryDesc', type: 'text', section: 'wsl2' },
  { key: 'processors', label: 'Processors', placeholder: '2', description: 'wsl.config.processorsDesc', type: 'text', section: 'wsl2' },
  { key: 'swap', label: 'Swap', placeholder: '8GB', description: 'wsl.config.swapDesc', type: 'text', section: 'wsl2' },
  { key: 'localhostForwarding', label: 'Localhost Forwarding', placeholder: 'true', description: 'wsl.config.localhostForwardingDesc', type: 'bool', section: 'wsl2' },
  { key: 'nestedVirtualization', label: 'Nested Virtualization', placeholder: 'true', description: 'wsl.config.nestedVirtualizationDesc', type: 'bool', section: 'wsl2' },
  { key: 'guiApplications', label: 'GUI Applications', placeholder: 'true', description: 'wsl.config.guiApplicationsDesc', type: 'bool', section: 'wsl2' },
  { key: 'networkingMode', label: 'Networking Mode', placeholder: 'NAT', description: 'wsl.config.networkingModeDesc', type: 'select', options: ['NAT', 'mirrored', 'virtioproxy'], section: 'wsl2' },
  { key: 'dnsProxy', label: 'DNS Proxy', placeholder: 'true', description: 'wsl.config.dnsProxyDesc', type: 'bool', section: 'wsl2' },
  // [experimental] section
  { key: 'autoMemoryReclaim', label: 'Auto Memory Reclaim', placeholder: 'disabled', description: 'wsl.config.autoMemoryReclaimDesc', type: 'select', options: ['disabled', 'gradual', 'dropcache'], section: 'experimental' },
  { key: 'sparseVhd', label: 'Sparse VHD', placeholder: 'true', description: 'wsl.config.sparseVhdDesc', type: 'bool', section: 'experimental' },
  { key: 'dnsTunneling', label: 'DNS Tunneling', placeholder: 'true', description: 'wsl.config.dnsTunnelingDesc', type: 'bool', section: 'experimental' },
  { key: 'firewall', label: 'Firewall', placeholder: 'true', description: 'wsl.config.firewallDesc', type: 'bool', section: 'experimental' },
  { key: 'autoProxy', label: 'Auto Proxy', placeholder: 'true', description: 'wsl.config.autoProxyDesc', type: 'bool', section: 'experimental' },
  { key: 'hostAddressLoopback', label: 'Host Address Loopback', placeholder: 'true', description: 'wsl.config.hostAddressLoopbackDesc', type: 'bool', section: 'experimental' },
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
