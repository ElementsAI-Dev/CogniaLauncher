import { parseFileEntries, parseListeningPorts, parseInterfaces, parseServices, getStatusVariant, formatPmLabel, formatKb } from './wsl';

describe('parseFileEntries', () => {
  it('parses standard ls -la output', () => {
    const output = `total 12
drwxr-xr-x  3 user group 4096 Jan 15 10:30 mydir
-rw-r--r--  1 user group  123 Jan 15 10:30 file.txt
lrwxrwxrwx  1 user group   11 Jan 15 10:30 link -> /target`;
    const entries = parseFileEntries(output);
    expect(entries).toHaveLength(3);
    expect(entries[0]).toEqual(expect.objectContaining({ name: 'mydir', type: 'dir' }));
    expect(entries[1]).toEqual(expect.objectContaining({ name: 'file.txt', type: 'file' }));
    expect(entries[2]).toEqual(expect.objectContaining({ name: 'link', type: 'link', linkTarget: '/target' }));
  });

  it('filters out . and ..', () => {
    const output = `drwxr-xr-x  2 user group 4096 Jan 15 10:30 .
drwxr-xr-x  3 user group 4096 Jan 15 10:30 ..
-rw-r--r--  1 user group  123 Jan 15 10:30 file.txt`;
    const entries = parseFileEntries(output);
    expect(entries).toHaveLength(1);
    expect(entries[0].name).toBe('file.txt');
  });

  it('handles short lines gracefully', () => {
    const entries = parseFileEntries('short line');
    expect(entries).toHaveLength(1);
    expect(entries[0].type).toBe('other');
  });

  it('returns empty for empty input', () => {
    expect(parseFileEntries('')).toEqual([]);
  });
});

describe('parseListeningPorts', () => {
  it('parses ss -tlnp output', () => {
    const output = `State  Recv-Q Send-Q Local Address:Port  Peer Address:Port Process
LISTEN 0      128    0.0.0.0:22   0.0.0.0:*     users:(("sshd",pid=123,fd=3))
LISTEN 0      128    0.0.0.0:80   0.0.0.0:*     users:(("nginx",pid=456,fd=3))`;
    const ports = parseListeningPorts(output);
    expect(ports).toHaveLength(2);
    expect(ports[0]).toEqual(expect.objectContaining({ port: '22', process: 'sshd' }));
    expect(ports[1]).toEqual(expect.objectContaining({ port: '80', process: 'nginx' }));
  });

  it('skips header lines', () => {
    const output = `Netid State Recv-Q Send-Q Local Address:Port Peer
LISTEN 0 128 0.0.0.0:3000 0.0.0.0:*`;
    const ports = parseListeningPorts(output);
    expect(ports).toHaveLength(1);
  });

  it('returns empty for empty input', () => {
    expect(parseListeningPorts('')).toEqual([]);
  });
});

describe('parseInterfaces', () => {
  it('parses ip addr show output', () => {
    const output = `1: lo: <LOOPBACK,UP> mtu 65536
    link/loopback 00:00:00:00:00:00
    inet 127.0.0.1/8 scope host lo
    inet6 ::1/128 scope host
2: eth0: <BROADCAST,MULTICAST,UP> mtu 1500
    link/ether aa:bb:cc:dd:ee:ff
    inet 192.168.1.100/24 scope global eth0
    inet6 fe80::1/64 scope link`;
    const ifaces = parseInterfaces(output);
    expect(ifaces).toHaveLength(2);
    expect(ifaces[0]).toEqual(expect.objectContaining({ name: 'lo', ipv4: '127.0.0.1/8' }));
    expect(ifaces[1]).toEqual(expect.objectContaining({ name: 'eth0', mac: 'aa:bb:cc:dd:ee:ff', ipv4: '192.168.1.100/24' }));
  });

  it('returns empty for empty input', () => {
    expect(parseInterfaces('')).toEqual([]);
  });
});

describe('parseServices', () => {
  it('parses systemctl list-units output', () => {
    const output = `  sshd.service         loaded active running OpenSSH Daemon
  nginx.service        loaded inactive dead    nginx web server
  mysql.service        loaded failed  failed   MySQL Database`;
    const services = parseServices(output);
    expect(services).toHaveLength(3);
    expect(services[0]).toEqual(expect.objectContaining({ name: 'sshd', status: 'running' }));
    expect(services[1]).toEqual(expect.objectContaining({ name: 'nginx', status: 'inactive' }));
    expect(services[2]).toEqual(expect.objectContaining({ name: 'mysql', status: 'failed' }));
  });

  it('handles exited status', () => {
    const output = `  oneshot.service      loaded active exited  One Shot Service`;
    const services = parseServices(output);
    expect(services[0].status).toBe('exited');
  });

  it('returns empty for non-matching lines', () => {
    expect(parseServices('random text')).toEqual([]);
  });
});

describe('getStatusVariant', () => {
  it('returns default for running', () => expect(getStatusVariant('running')).toBe('default'));
  it('returns destructive for failed', () => expect(getStatusVariant('failed')).toBe('destructive'));
  it('returns outline for exited', () => expect(getStatusVariant('exited')).toBe('outline'));
  it('returns secondary for inactive', () => expect(getStatusVariant('inactive')).toBe('secondary'));
  it('returns secondary for other', () => expect(getStatusVariant('other')).toBe('secondary'));
});

describe('formatPmLabel', () => {
  it('maps known pm to label', () => {
    expect(formatPmLabel('apt')).toBe('APT (dpkg)');
    expect(formatPmLabel('pacman')).toBe('Pacman');
  });

  it('returns raw pm for unknown', () => {
    expect(formatPmLabel('unknown-pm')).toBe('unknown-pm');
  });
});

describe('formatKb', () => {
  it('converts kilobytes to human-readable', () => {
    expect(formatKb(1024)).toContain('1');
    expect(formatKb(0)).toBeDefined();
  });
});
