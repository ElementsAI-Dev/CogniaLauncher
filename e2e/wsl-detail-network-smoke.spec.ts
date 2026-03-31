import { test, expect, type Page } from '@playwright/test';
import { expectNoFatalOverlay, waitForAppReady } from './fixtures/app-fixture';

const ONBOARDING_STORAGE_KEY = 'cognia-onboarding';
const ONBOARDING_DONE_STATE = {
  state: {
    mode: 'quick',
    completed: true,
    skipped: false,
    currentStep: 6,
    visitedSteps: [
      'mode-selection',
      'language',
      'theme',
      'environment-detection',
      'mirrors',
      'shell-init',
      'complete',
    ],
    tourCompleted: false,
    dismissedHints: [],
    hintsEnabled: true,
    version: 4,
    sessionState: 'completed',
    lastActiveStepId: 'complete',
    lastActiveAt: 0,
    canResume: false,
    sessionSummary: {
      mode: 'quick',
      locale: 'en',
      theme: 'light',
      mirrorPreset: 'default',
      detectedCount: 0,
      primaryEnvironment: null,
      manageableEnvironments: [],
      shellType: null,
      shellConfigured: null,
    },
  },
  version: 4,
} as const;

type WslMockState = {
  capabilityError?: string | null;
  runtimeSnapshot: {
    state: 'unavailable' | 'empty' | 'degraded' | 'ready';
    available: boolean;
    reasonCode: string;
    reason: string;
    runtimeProbes: Array<{ id: string; command: string; success: boolean; reasonCode: string; detail?: string }>;
    statusProbe: { ready: boolean; reasonCode: string; detail?: string };
    capabilityProbe: { ready: boolean; reasonCode: string; detail?: string };
    distroProbe: { ready: boolean; reasonCode: string; detail?: string };
    distroCount: number;
    degradedReasons: string[];
  };
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
  versionInfo: {
    wslVersion: string;
    kernelVersion: string;
    wslgVersion: string;
    windowsVersion: string;
  };
  config: Record<string, Record<string, string>>;
  distroConfig: Record<string, Record<string, Record<string, string>>>;
  distroEnvironment: Record<string, Record<string, unknown>>;
  distroResources: Record<string, Record<string, unknown>>;
  portForwards: Array<{
    listenAddress: string;
    listenPort: string;
    connectAddress: string;
    connectPort: string;
  }>;
};

const DEFAULT_WSL_MOCK_STATE: WslMockState = {
  capabilityError: null,
  runtimeSnapshot: {
    state: 'ready',
    available: true,
    reasonCode: 'runtime_ready',
    reason: 'Runtime and management probes passed.',
    runtimeProbes: [],
    statusProbe: { ready: true, reasonCode: 'ok' },
    capabilityProbe: { ready: true, reasonCode: 'ok' },
    distroProbe: { ready: true, reasonCode: 'ok' },
    distroCount: 1,
    degradedReasons: [],
  },
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
  versionInfo: {
    wslVersion: '2.4.0',
    kernelVersion: '5.15.153.1',
    wslgVersion: '1.0.61',
    windowsVersion: '10.0.22631',
  },
  config: {
    wsl2: {
      memory: '4GB',
      processors: '4',
      networkingMode: 'mirrored',
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
  distroEnvironment: {
    Ubuntu: {
      distroId: 'ubuntu',
      distroIdLike: ['debian'],
      prettyName: 'Ubuntu 24.04 LTS',
      architecture: 'x86_64',
      kernelVersion: '5.15.153.1',
      packageManager: 'apt',
      initSystem: 'systemd',
      defaultShell: '/bin/bash',
      defaultUser: 'cognia',
      installedPackages: 512,
      dockerAvailable: true,
      dockerSocket: true,
      dockerContainerCount: 2,
    },
  },
  distroResources: {
    Ubuntu: {
      memTotalKb: 1024 * 1024,
      memAvailableKb: 512 * 1024,
      memUsedKb: 512 * 1024,
      swapTotalKb: 0,
      swapUsedKb: 0,
      cpuCount: 4,
      loadAvg: [0.2, 0.1, 0.05],
    },
  },
  portForwards: [
    {
      listenAddress: '0.0.0.0',
      listenPort: '3000',
      connectAddress: '172.20.0.2',
      connectPort: '3000',
    },
  ],
};

async function installTauriMock(page: Page): Promise<void> {
  await page.addInitScript(({ onboardingKey, onboardingState, seedState }) => {
    window.localStorage.setItem(onboardingKey, JSON.stringify(onboardingState));

    const deepClone = <T,>(value: T): T => JSON.parse(JSON.stringify(value));
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
        case 'wsl_get_runtime_snapshot':
          state.runtimeSnapshot.distroCount = state.distros.length;
          return state.runtimeSnapshot;
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
          if (state.capabilityError) {
            throw new Error(state.capabilityError);
          }
          return state.capabilities;
        case 'wsl_get_version_info':
          return state.versionInfo;
        case 'wsl_detect_distro_env': {
          const distro = String(args.distro ?? '');
          return state.distroEnvironment[distro] ?? null;
        }
        case 'wsl_get_distro_resources': {
          const distro = String(args.distro ?? '');
          return state.distroResources[distro] ?? null;
        }
        case 'wsl_disk_usage':
          return {
            totalBytes: 1024 * 1024 * 1024,
            usedBytes: 512 * 1024 * 1024,
            filesystemPath: '/mock',
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
        case 'wsl_get_ip':
          return '172.20.0.2';
        case 'wsl_list_port_forwards':
          return state.portForwards;
        case 'wsl_list_backups':
          return [];
        case 'wsl_exec':
          if (String(args.command ?? '').includes('hostname')) {
            return { stdout: 'ubuntu\n', stderr: '', exitCode: 0 };
          }
          if (String(args.command ?? '').includes('nameserver')) {
            return { stdout: '8.8.8.8\n', stderr: '', exitCode: 0 };
          }
          if (String(args.command ?? '').includes('ss ')) {
            return { stdout: "LISTEN 0 128 0.0.0.0:22 0.0.0.0:* users:((\"sshd\",pid=42,fd=3))\n", stderr: '', exitCode: 0 };
          }
          if (String(args.command ?? '').includes('ip addr')) {
            return {
              stdout: '1: lo: <LOOPBACK>\n    inet 127.0.0.1/8 scope host lo\n2: eth0: <BROADCAST>\n    inet 172.20.0.2/20\n',
              stderr: '',
              exitCode: 0,
            };
          }
          return { stdout: '', stderr: '', exitCode: 0 };
        case 'app_check_init':
          return { initialized: true, version: '0.1.0' };
        case 'plugin:event|listen':
          return callbackId++;
        case 'plugin:event|unlisten':
          return null;
        case 'plugin:os|locale':
          return 'en-US';
        case 'plugin:os|hostname':
          return 'cognia-test';
        case 'env_list':
        case 'env_list_providers':
        case 'provider_list':
        case 'provider_status_all':
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
    Object.defineProperty(window, '__TAURI_EVENT_PLUGIN_INTERNALS__', {
      configurable: true,
      value: {
        unregisterListener: () => undefined,
      },
    });

    (window as typeof window & {
      __TAURI_MOCK_CALLS?: unknown;
      __WSL_MOCK_STATE?: WslMockState;
    }).__TAURI_MOCK_CALLS = calls;
    (window as typeof window & {
      __WSL_MOCK_STATE?: WslMockState;
    }).__WSL_MOCK_STATE = state;
  }, {
    onboardingKey: ONBOARDING_STORAGE_KEY,
    onboardingState: ONBOARDING_DONE_STATE,
    seedState: DEFAULT_WSL_MOCK_STATE,
  });
}

async function openMockedNetworkTab(page: Page): Promise<void> {
  await page.setViewportSize({ width: 1280, height: 900 });
  await installTauriMock(page);
  await page.goto('/wsl', { waitUntil: 'domcontentloaded' });
  await waitForAppReady(page);
  await expectNoFatalOverlay(page);
  await expect(page.getByTestId('wsl-config-support-section')).toBeVisible({ timeout: 60_000 });
  await page.goto('/wsl/distro?name=Ubuntu&tab=network', { waitUntil: 'domcontentloaded' });
  await expectNoFatalOverlay(page);

  await expect(page).toHaveURL(/\/wsl\/distro\?name=Ubuntu(?:&.*)?tab=network|\/wsl\/distro\?tab=network(?:&.*)?name=Ubuntu/);
  await expect(page.getByLabel('add-port-forward-rule')).toBeVisible({ timeout: 60_000 });
}

test.describe('WSL Detail Network Smoke', () => {
  test.describe.configure({ mode: 'serial' });

  test('network tab renders port-forward card', async ({ page }) => {
    test.slow();
    await openMockedNetworkTab(page);
    await expect(page.getByLabel('add-port-forward-rule')).toBeVisible();
    await expect(page.getByText('0.0.0.0').first()).toBeVisible();
    await expect(page.getByText('172.20.0.2').first()).toBeVisible();
  });

  test('network tab renders network-mode selector', async ({ page }) => {
    test.slow();
    await openMockedNetworkTab(page);
    await expect(page.getByRole('combobox').first()).toBeVisible();
  });
});
