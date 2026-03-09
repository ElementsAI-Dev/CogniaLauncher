import { test, expect, type Page } from '@playwright/test';
import { waitForAppReady } from './fixtures/app-fixture';

type WslMockState = {
  distros: Array<{ name: string; state: string; wslVersion: string; isDefault: boolean }>;
  status: {
    version: string;
    kernelVersion: string;
    wslgVersion: string;
    statusInfo: string;
    runningDistros: string[];
    defaultDistribution: string;
    defaultVersion: string;
  };
  capabilities: {
    manage: boolean;
    move: boolean;
    resize: boolean;
    setSparse: boolean;
    setDefaultUser: boolean;
    mountOptions: boolean;
    shutdownForce: boolean;
    exportFormat: boolean;
    importInPlace: boolean;
    version: string;
  };
  config: Record<string, Record<string, string>>;
  distroConfig: Record<string, Record<string, Record<string, string>>>;
};

const DEFAULT_WSL_MOCK_STATE: WslMockState = {
  distros: [{ name: 'Ubuntu', state: 'Running', wslVersion: '2', isDefault: true }],
  status: {
    version: '2.4.0',
    kernelVersion: '5.15.153.1',
    wslgVersion: '1.0.61',
    statusInfo: 'Ready',
    runningDistros: ['Ubuntu'],
    defaultDistribution: 'Ubuntu',
    defaultVersion: '2',
  },
  capabilities: {
    manage: true,
    move: true,
    resize: true,
    setSparse: true,
    setDefaultUser: true,
    mountOptions: true,
    shutdownForce: true,
    exportFormat: true,
    importInPlace: true,
    version: '2.4.0',
  },
  config: {
    wsl2: {
      memory: '4GB',
      processors: '4',
    },
    experimental: {
      autoMemoryReclaim: 'gradual',
    },
  },
  distroConfig: {
    Ubuntu: {
      boot: {
        systemd: 'true',
      },
      network: {
        customDns: '8.8.8.8',
      },
      wsl2: {
        memory: '2GB',
      },
    },
  },
};

async function installTauriMock(page: Page): Promise<void> {
  await page.addInitScript((seedState: WslMockState) => {
    const deepClone = <T>(value: T): T => JSON.parse(JSON.stringify(value));
    const state = deepClone(seedState);
    const calls: Array<{ cmd: string; args: Record<string, unknown> }> = [];

    const mutateSectionMap = (
      root: Record<string, Record<string, string>>,
      section: string,
      key: string,
      value: unknown,
    ) => {
      root[section] ??= {};
      if (value === undefined || value === null || String(value).trim() === '') {
        delete root[section][key];
      } else {
        root[section][key] = String(value);
      }
    };

    const invoke = async (cmd: string, args: Record<string, unknown> = {}) => {
      calls.push({ cmd, args });
      switch (cmd) {
        case 'wsl_is_available':
          return true;
        case 'wsl_list_distros':
          return state.distros;
        case 'wsl_list_online':
          return [];
        case 'wsl_status':
          return state.status;
        case 'wsl_list_running':
          return state.status.runningDistros;
        case 'wsl_get_config':
          return state.config;
        case 'wsl_get_distro_config': {
          const distro = String(args.distro ?? '');
          return state.distroConfig[distro] ?? null;
        }
        case 'wsl_get_capabilities':
          return state.capabilities;
        case 'wsl_get_version_info':
          return {
            wslVersion: state.status.version,
            kernelVersion: state.status.kernelVersion,
            wslgVersion: state.status.wslgVersion,
          };
        case 'wsl_total_disk_usage':
          return [1024 * 1024 * 1024, [['Ubuntu', 1024 * 1024 * 1024]]];
        case 'wsl_set_config': {
          const section = String(args.section ?? '');
          const key = String(args.key ?? '');
          mutateSectionMap(state.config, section, key, args.value);
          return null;
        }
        case 'wsl_set_distro_config': {
          const distro = String(args.distro ?? '');
          const section = String(args.section ?? '');
          const key = String(args.key ?? '');
          state.distroConfig[distro] ??= {};
          mutateSectionMap(state.distroConfig[distro], section, key, args.value);
          return null;
        }
        case 'wsl_disk_usage':
          return {
            totalBytes: 1024 * 1024 * 1024,
            usedBytes: 512 * 1024 * 1024,
            filesystemPath: '/mock',
          };
        case 'wsl_get_ip':
          return '172.20.0.2';
        case 'wsl_list_port_forwards':
          return [];
        case 'wsl_list_backups':
          return [];
        case 'app_check_init':
          return { initialized: true, version: '0.1.0' };
        case 'env_list':
          return [];
        case 'env_list_providers':
          return [];
        case 'provider_list':
          return [];
        case 'provider_status_all':
          return [];
        case 'package_list':
          return [];
        case 'config_get':
          return null;
        case 'config_list':
        case 'config_list_defaults':
          return [];
        default:
          return null;
      }
    };

    let callbackId = 1;
    Object.defineProperty(window, '__TAURI_INTERNALS__', {
      configurable: true,
      value: {
        invoke,
        transformCallback: () => callbackId++,
        unregisterCallback: () => undefined,
        convertFileSrc: (value: string) => value,
      },
    });
    Object.defineProperty(window, '__TAURI_OS_PLUGIN_INTERNALS__', {
      configurable: true,
      value: {
        platform: 'windows',
        arch: 'x86_64',
        family: 'windows',
        exe_extension: 'exe',
        eol: '\r\n',
        os_type: 'windows',
        version: '10.0.22631',
      },
    });

    (window as typeof window & { __TAURI_MOCK_CALLS?: unknown }).__TAURI_MOCK_CALLS = calls;
  }, DEFAULT_WSL_MOCK_STATE);
}

async function openMockedWslPage(page: Page, width: number, height: number): Promise<void> {
  await page.setViewportSize({ width: 1280, height: 900 });
  await installTauriMock(page);
  await page.goto('/wsl', { waitUntil: 'domcontentloaded' });
  await waitForAppReady(page);
  await expect(page).toHaveURL(/\/wsl(?:\?.*)?$/);
  await page.setViewportSize({ width, height });
  await expect(page.getByTestId('wsl-config-support-section')).toBeVisible({ timeout: 45_000 });
}

test.describe('WSL Layout Smoke (Mocked Desktop Runtime)', () => {
  test('wide viewport keeps global/distro config forms operable', async ({ page }) => {
    await openMockedWslPage(page, 1440, 900);

    const globalForm = page.getByTestId('wsl-config-custom-form');
    const distroForm = page.getByTestId('wsl-distro-config-custom-form');
    await expect(globalForm).toBeVisible();
    await expect(distroForm).toBeVisible();

    await expect(globalForm.locator('button').last()).toBeVisible();
    await expect(distroForm.locator('button').last()).toBeVisible();

    await globalForm.locator('input').nth(0).fill('swapFile');
    await globalForm.locator('input').nth(1).fill('2GB');
    await globalForm.locator('input').nth(1).press('Enter');

    await expect.poll(async () => {
      return page.evaluate(() => {
        const calls = (window as typeof window & {
          __TAURI_MOCK_CALLS?: Array<{ cmd: string; args: Record<string, unknown> }>;
        }).__TAURI_MOCK_CALLS ?? [];
        return calls.some((call) => call.cmd === 'wsl_set_config' && call.args.key === 'swapFile');
      });
    }).toBe(true);

    await distroForm.locator('input').nth(1).fill('vmIdleTimeout');
    await distroForm.locator('input').nth(2).fill('60000');
    await distroForm.locator('input').nth(2).press('Enter');

    await expect.poll(async () => {
      return page.evaluate(() => {
        const calls = (window as typeof window & {
          __TAURI_MOCK_CALLS?: Array<{ cmd: string; args: Record<string, unknown> }>;
        }).__TAURI_MOCK_CALLS ?? [];
        return calls.some(
          (call) => call.cmd === 'wsl_set_distro_config'
            && call.args.distro === 'Ubuntu'
            && call.args.section === 'wsl2'
            && call.args.key === 'vmIdleTimeout',
        );
      });
    }).toBe(true);
  });

  test('narrow viewport keeps custom forms visible without horizontal overflow', async ({ page }) => {
    await openMockedWslPage(page, 560, 900);

    const globalForm = page.getByTestId('wsl-config-custom-form');
    const distroForm = page.getByTestId('wsl-distro-config-custom-form');
    await expect(globalForm).toBeVisible();
    await expect(distroForm).toBeVisible();

    const globalHasOverflow = await globalForm.evaluate((node) => node.scrollWidth > node.clientWidth);
    const distroHasOverflow = await distroForm.evaluate((node) => node.scrollWidth > node.clientWidth);
    expect(globalHasOverflow).toBeFalsy();
    expect(distroHasOverflow).toBeFalsy();

    await expect(globalForm.locator('button').last()).toBeVisible();
    await expect(distroForm.locator('button').last()).toBeVisible();
  });
});
