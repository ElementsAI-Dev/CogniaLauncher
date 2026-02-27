import type { WslSettingDef, QuickSetting } from '@/types/wsl';

/** Common WSL2 global settings for .wslconfig [wsl2] section */
export const COMMON_WSL2_SETTINGS: WslSettingDef[] = [
  { key: 'memory', label: 'Memory', placeholder: '4GB', description: 'wsl.config.memoryDesc', type: 'text' },
  { key: 'processors', label: 'Processors', placeholder: '2', description: 'wsl.config.processorsDesc', type: 'text' },
  { key: 'swap', label: 'Swap', placeholder: '8GB', description: 'wsl.config.swapDesc', type: 'text' },
  { key: 'localhostForwarding', label: 'Localhost Forwarding', placeholder: 'true', description: 'wsl.config.localhostForwardingDesc', type: 'bool' },
  { key: 'nestedVirtualization', label: 'Nested Virtualization', placeholder: 'true', description: 'wsl.config.nestedVirtualizationDesc', type: 'bool' },
  { key: 'guiApplications', label: 'GUI Applications', placeholder: 'true', description: 'wsl.config.guiApplicationsDesc', type: 'bool' },
  { key: 'networkingMode', label: 'Networking Mode', placeholder: 'NAT', description: 'wsl.config.networkingModeDesc', type: 'select', options: ['NAT', 'mirrored', 'virtioproxy'] },
  { key: 'autoMemoryReclaim', label: 'Auto Memory Reclaim', placeholder: 'disabled', description: 'wsl.config.autoMemoryReclaimDesc', type: 'select', options: ['disabled', 'gradual', 'dropcache'] },
  { key: 'sparseVhd', label: 'Sparse VHD', placeholder: 'true', description: 'wsl.config.sparseVhdDesc', type: 'bool' },
  { key: 'dnsTunneling', label: 'DNS Tunneling', placeholder: 'true', description: 'wsl.config.dnsTunnelingDesc', type: 'bool' },
  { key: 'firewall', label: 'Firewall', placeholder: 'true', description: 'wsl.config.firewallDesc', type: 'bool' },
];

/** Per-distro quick settings for /etc/wsl.conf */
export const QUICK_SETTINGS: QuickSetting[] = [
  { section: 'boot', key: 'systemd', labelKey: 'wsl.distroConfig.systemd', descKey: 'wsl.distroConfig.systemdDesc', type: 'boolean', defaultValue: 'false' },
  { section: 'automount', key: 'enabled', labelKey: 'wsl.distroConfig.automount', descKey: 'wsl.distroConfig.automountDesc', type: 'boolean', defaultValue: 'true' },
  { section: 'interop', key: 'enabled', labelKey: 'wsl.distroConfig.interop', descKey: 'wsl.distroConfig.interopDesc', type: 'boolean', defaultValue: 'true' },
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
