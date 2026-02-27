import { formatBytes } from '@/lib/utils';
import { PM_LABELS } from '@/lib/constants/wsl';
import type { FileEntry, ListeningPort, NetworkInterface, ServiceInfo } from '@/types/wsl';

// ============================================================================
// Filesystem parsing
// ============================================================================

/** Parse `ls -la` output into structured FileEntry objects */
export function parseFileEntries(output: string): FileEntry[] {
  const lines = output.split('\n').filter((l) => l.trim() && !l.startsWith('total'));
  return lines.map((line) => {
    // Parse ls -la output: permissions links owner group size month day time name [-> target]
    const parts = line.trim().split(/\s+/);
    if (parts.length < 9) {
      return { name: parts[parts.length - 1] || line, type: 'other' as const, permissions: '', size: '', modified: '' };
    }

    const permissions = parts[0];
    const size = parts[4];
    const month = parts[5];
    const day = parts[6];
    const timeOrYear = parts[7];
    const modified = `${month} ${day} ${timeOrYear}`;

    // Handle filenames with spaces and symlinks
    const nameStartIdx = line.indexOf(timeOrYear) + timeOrYear.length;
    const nameStr = line.substring(nameStartIdx).trim();

    let name = nameStr;
    let linkTarget: string | undefined;
    const arrowIdx = nameStr.indexOf(' -> ');
    if (arrowIdx !== -1) {
      name = nameStr.substring(0, arrowIdx);
      linkTarget = nameStr.substring(arrowIdx + 4);
    }

    let type: FileEntry['type'] = 'file';
    if (permissions.startsWith('d')) type = 'dir';
    else if (permissions.startsWith('l')) type = 'link';
    else if (!permissions.startsWith('-')) type = 'other';

    return { name, type, permissions, size, modified, linkTarget };
  }).filter((f) => f.name !== '.' && f.name !== '..');
}

// ============================================================================
// Network parsing
// ============================================================================

/** Parse `ss -tlnp` or `ss -ulnp` output into ListeningPort objects */
export function parseListeningPorts(output: string): ListeningPort[] {
  const ports: ListeningPort[] = [];
  const lines = output.split('\n').filter((l) => l.trim());
  for (const line of lines) {
    const parts = line.trim().split(/\s+/);
    if (parts.length < 5) continue;
    if (parts[0] === 'State' || parts[0] === 'Netid') continue;

    const protocol = parts[0] || 'tcp';
    const localAddr = parts[3] || parts[4] || '';
    const lastColon = localAddr.lastIndexOf(':');
    const address = lastColon !== -1 ? localAddr.substring(0, lastColon) : localAddr;
    const port = lastColon !== -1 ? localAddr.substring(lastColon + 1) : '';

    // Extract process from the last column
    const processInfo = parts[parts.length - 1] || '';
    const processMatch = processInfo.match(/users:\(\("([^"]+)"/);
    const process = processMatch?.[1] || '';

    if (port) {
      ports.push({ protocol, address, port, process });
    }
  }
  return ports;
}

/** Parse `ip addr show` or `ifconfig` output into NetworkInterface objects */
export function parseInterfaces(output: string): NetworkInterface[] {
  const interfaces: NetworkInterface[] = [];
  const blocks = output.split(/^\d+: /m).filter(Boolean);

  for (const block of blocks) {
    const lines = block.split('\n');
    const nameMatch = lines[0]?.match(/^(\S+?)[@:]/)
    const name = nameMatch?.[1] || lines[0]?.split(':')[0]?.trim() || '';
    if (!name) continue;

    let ipv4 = '';
    let ipv6 = '';
    let mac = '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith('inet ')) {
        const m = trimmed.match(/inet\s+(\S+)/);
        ipv4 = m?.[1] || '';
      } else if (trimmed.startsWith('inet6 ')) {
        const m = trimmed.match(/inet6\s+(\S+)/);
        ipv6 = m?.[1] || '';
      } else if (trimmed.startsWith('link/ether ')) {
        const m = trimmed.match(/link\/ether\s+(\S+)/);
        mac = m?.[1] || '';
      }
    }

    interfaces.push({ name, ipv4, ipv6, mac });
  }
  return interfaces;
}

// ============================================================================
// Service parsing
// ============================================================================

/** Parse `systemctl list-units --type=service` output into ServiceInfo objects */
export function parseServices(output: string): ServiceInfo[] {
  const services: ServiceInfo[] = [];
  const lines = output.split('\n').filter((l) => l.trim());

  for (const line of lines) {
    // Format: UNIT LOAD ACTIVE SUB DESCRIPTION...
    const match = line.trim().match(/^(\S+\.service)\s+(\S+)\s+(\S+)\s+(\S+)\s+(.*)/);
    if (!match) continue;

    const [, unit, , active, sub, description] = match;
    const name = unit.replace('.service', '');

    let status: ServiceInfo['status'] = 'other';
    if (sub === 'running') status = 'running';
    else if (active === 'inactive' || sub === 'dead') status = 'inactive';
    else if (active === 'failed') status = 'failed';
    else if (sub === 'exited') status = 'exited';
    else if (active === 'active' && sub !== 'running') status = 'stopped';

    services.push({
      name,
      status,
      description: description.trim(),
      activeState: active,
      subState: sub,
    });
  }

  return services;
}

/** Map service status to Badge variant */
export function getStatusVariant(status: ServiceInfo['status']): 'default' | 'secondary' | 'destructive' | 'outline' {
  switch (status) {
    case 'running': return 'default';
    case 'failed': return 'destructive';
    case 'exited': return 'outline';
    default: return 'secondary';
  }
}

// ============================================================================
// Formatting helpers
// ============================================================================

/** Map distro package manager ID to a display-friendly label */
export function formatPmLabel(pm: string): string {
  return PM_LABELS[pm] ?? pm;
}

/** Format kilobytes to human-readable string */
export function formatKb(kb: number): string {
  return formatBytes(kb * 1024);
}
