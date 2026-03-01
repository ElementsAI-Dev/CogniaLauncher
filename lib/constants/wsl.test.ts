import {
  COMMON_WSL2_SETTINGS,
  QUICK_SETTINGS,
  NETWORK_PRESETS,
  PM_LABELS,
  BOOT_COMMAND_PRESETS,
  NETWORKING_MODE_INFO,
} from './wsl';

describe('COMMON_WSL2_SETTINGS', () => {
  it('is a non-empty array', () => {
    expect(COMMON_WSL2_SETTINGS.length).toBeGreaterThan(0);
  });

  it('each setting has required fields', () => {
    COMMON_WSL2_SETTINGS.forEach((s) => {
      expect(s.key).toBeTruthy();
      expect(s.label).toBeTruthy();
      expect(s.description).toBeTruthy();
      expect(['text', 'bool', 'select', 'number', 'path']).toContain(s.type);
      expect(['wsl2', 'experimental']).toContain(s.section);
    });
  });

  it('contains memory setting', () => {
    expect(COMMON_WSL2_SETTINGS.find((s) => s.key === 'memory')).toBeDefined();
  });

  it('contains new kernel setting', () => {
    expect(COMMON_WSL2_SETTINGS.find((s) => s.key === 'kernel')).toBeDefined();
  });

  it('contains new experimental settings', () => {
    expect(COMMON_WSL2_SETTINGS.find((s) => s.key === 'ignoredPorts')).toBeDefined();
    expect(COMMON_WSL2_SETTINGS.find((s) => s.key === 'dnsTunnelingIpAddress')).toBeDefined();
    expect(COMMON_WSL2_SETTINGS.find((s) => s.key === 'bestEffortDnsParsing')).toBeDefined();
    expect(COMMON_WSL2_SETTINGS.find((s) => s.key === 'initialAutoProxyTimeout')).toBeDefined();
  });

  it('select type settings have options', () => {
    COMMON_WSL2_SETTINGS.filter((s) => s.type === 'select').forEach((s) => {
      expect(s.options).toBeDefined();
      expect(s.options!.length).toBeGreaterThan(0);
    });
  });

  it('has at least 27 settings (14 original + 13 new)', () => {
    expect(COMMON_WSL2_SETTINGS.length).toBeGreaterThanOrEqual(27);
  });

  describe('validation functions', () => {
    it('memory validates size format', () => {
      const mem = COMMON_WSL2_SETTINGS.find((s) => s.key === 'memory')!;
      expect(mem.validate).toBeDefined();
      expect(mem.validate!('4GB')).toBeNull();
      expect(mem.validate!('512MB')).toBeNull();
      expect(mem.validate!('1TB')).toBeNull();
      expect(mem.validate!('abc')).not.toBeNull();
      expect(mem.validate!('')).not.toBeNull();
    });

    it('processors validates positive integer', () => {
      const proc = COMMON_WSL2_SETTINGS.find((s) => s.key === 'processors')!;
      expect(proc.validate).toBeDefined();
      expect(proc.validate!('4')).toBeNull();
      expect(proc.validate!('1')).toBeNull();
      expect(proc.validate!('0')).not.toBeNull();
      expect(proc.validate!('-1')).not.toBeNull();
      expect(proc.validate!('abc')).not.toBeNull();
    });

    it('kernel validates Windows path', () => {
      const k = COMMON_WSL2_SETTINGS.find((s) => s.key === 'kernel')!;
      expect(k.validate).toBeDefined();
      expect(k.validate!('C:\\custom\\kernel')).toBeNull();
      expect(k.validate!('D:\\path\\to\\vmlinux')).toBeNull();
      expect(k.validate!('%Temp%\\kernel')).toBeNull();
      expect(k.validate!('/linux/path')).not.toBeNull();
    });

    it('vmIdleTimeout validates non-negative integer', () => {
      const vit = COMMON_WSL2_SETTINGS.find((s) => s.key === 'vmIdleTimeout')!;
      expect(vit.validate).toBeDefined();
      expect(vit.validate!('60000')).toBeNull();
      expect(vit.validate!('0')).toBeNull();
      expect(vit.validate!('-1')).not.toBeNull();
      expect(vit.validate!('abc')).not.toBeNull();
    });

    it('dnsTunnelingIpAddress validates IPv4', () => {
      const dns = COMMON_WSL2_SETTINGS.find((s) => s.key === 'dnsTunnelingIpAddress')!;
      expect(dns.validate).toBeDefined();
      expect(dns.validate!('10.255.255.254')).toBeNull();
      expect(dns.validate!('192.168.1.1')).toBeNull();
      expect(dns.validate!('not-an-ip')).not.toBeNull();
    });

    it('ignoredPorts validates comma-separated port list', () => {
      const ports = COMMON_WSL2_SETTINGS.find((s) => s.key === 'ignoredPorts')!;
      expect(ports.validate).toBeDefined();
      expect(ports.validate!('3000,9000,9090')).toBeNull();
      expect(ports.validate!('80')).toBeNull();
      expect(ports.validate!('3000,abc')).not.toBeNull();
      expect(ports.validate!('99999')).not.toBeNull();
    });

    it('settings without validate return undefined', () => {
      const localhostFwd = COMMON_WSL2_SETTINGS.find((s) => s.key === 'localhostForwarding')!;
      expect(localhostFwd.validate).toBeUndefined();
    });
  });
});

describe('QUICK_SETTINGS', () => {
  it('is a non-empty array', () => {
    expect(QUICK_SETTINGS.length).toBeGreaterThan(0);
  });

  it('each setting has required fields', () => {
    QUICK_SETTINGS.forEach((s) => {
      expect(s.section).toBeTruthy();
      expect(s.key).toBeTruthy();
      expect(s.labelKey).toBeTruthy();
      expect(s.descKey).toBeTruthy();
      expect(['boolean', 'text']).toContain(s.type);
      expect(s.defaultValue).toBeDefined();
    });
  });

  it('contains systemd setting', () => {
    expect(QUICK_SETTINGS.find((s) => s.key === 'systemd')).toBeDefined();
  });

  it('contains new mountFsTab setting', () => {
    expect(QUICK_SETTINGS.find((s) => s.key === 'mountFsTab')).toBeDefined();
  });

  it('contains new protectBinfmt setting', () => {
    expect(QUICK_SETTINGS.find((s) => s.key === 'protectBinfmt')).toBeDefined();
  });

  it('contains new boot command setting', () => {
    expect(QUICK_SETTINGS.find((s) => s.key === 'command' && s.section === 'boot')).toBeDefined();
  });
});

describe('NETWORK_PRESETS', () => {
  it('has at least 3 presets', () => {
    expect(NETWORK_PRESETS.length).toBeGreaterThanOrEqual(3);
  });

  it('each preset has required fields', () => {
    NETWORK_PRESETS.forEach((p) => {
      expect(p.id).toBeTruthy();
      expect(p.labelKey).toBeTruthy();
      expect(p.descKey).toBeTruthy();
      expect(p.settings.length).toBeGreaterThan(0);
    });
  });

  it('has unique IDs', () => {
    const ids = NETWORK_PRESETS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('BOOT_COMMAND_PRESETS', () => {
  it('is a non-empty array', () => {
    expect(BOOT_COMMAND_PRESETS.length).toBeGreaterThan(0);
  });

  it('each preset has id, labelKey, and command', () => {
    BOOT_COMMAND_PRESETS.forEach((p) => {
      expect(p.id).toBeTruthy();
      expect(p.labelKey).toBeTruthy();
      expect(p.command).toBeTruthy();
    });
  });

  it('contains docker preset', () => {
    const docker = BOOT_COMMAND_PRESETS.find((p) => p.id === 'docker');
    expect(docker).toBeDefined();
    expect(docker!.command).toContain('docker');
  });
});

describe('NETWORKING_MODE_INFO', () => {
  it('has entries for NAT, mirrored, virtioproxy, none', () => {
    expect(NETWORKING_MODE_INFO['NAT']).toBeDefined();
    expect(NETWORKING_MODE_INFO['mirrored']).toBeDefined();
    expect(NETWORKING_MODE_INFO['virtioproxy']).toBeDefined();
    expect(NETWORKING_MODE_INFO['none']).toBeDefined();
  });

  it('each mode has labelKey, descKey, and color', () => {
    Object.values(NETWORKING_MODE_INFO).forEach((info) => {
      expect(info.labelKey).toBeTruthy();
      expect(info.descKey).toBeTruthy();
      expect(info.color).toBeTruthy();
    });
  });
});

describe('PM_LABELS', () => {
  it('is a non-empty Record', () => {
    expect(Object.keys(PM_LABELS).length).toBeGreaterThan(0);
  });

  it('maps apt to its label', () => {
    expect(PM_LABELS['apt']).toBe('APT (dpkg)');
  });

  it('maps pacman to its label', () => {
    expect(PM_LABELS['pacman']).toBe('Pacman');
  });
});
