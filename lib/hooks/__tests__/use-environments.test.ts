import { renderHook, act } from '@testing-library/react';
import { useEnvironments } from '../use-environments';
import { useEnvironmentStore } from '../../stores/environment';
import * as tauri from '../../tauri';

jest.mock('../../tauri', () => ({
  isTauri: jest.fn(),
  envResolveAlias: jest.fn(),
  envInstall: jest.fn(),
  envGet: jest.fn(),
  listenEnvInstallProgress: jest.fn(),
  envSaveSettings: jest.fn(),
  envLoadSettings: jest.fn(),
}));

const mockedTauri = jest.mocked(tauri);

describe('useEnvironments', () => {
  beforeEach(() => {
    useEnvironmentStore.setState({
      environments: [],
      selectedEnv: null,
      detectedVersions: [],
      availableVersions: {},
      availableProviders: [],
      loading: false,
      error: null,
      envSettings: {},
      currentInstallation: null,
      selectedVersions: [],
      addDialogOpen: false,
      progressDialogOpen: false,
      installationProgress: null,
      versionBrowserOpen: false,
      versionBrowserEnvType: null,
      detailsPanelOpen: false,
      detailsPanelEnvType: null,
    });

    mockedTauri.isTauri.mockReturnValue(true);
    mockedTauri.envResolveAlias.mockReset();
    mockedTauri.envInstall.mockReset();
    mockedTauri.envGet.mockReset();
    mockedTauri.listenEnvInstallProgress.mockReset();
    mockedTauri.envSaveSettings.mockReset();
    mockedTauri.envLoadSettings.mockReset();
  });

  it('resolves aliases and installs with provider id', async () => {
    useEnvironmentStore.setState((state) => ({
      ...state,
      environments: [
        {
          env_type: 'fnm',
          provider_id: 'fnm',
          provider: 'fnm',
          current_version: null,
          installed_versions: [],
          available: true,
        },
      ],
      availableProviders: [
        {
          id: 'fnm',
          display_name: 'fnm',
          env_type: 'node',
          description: 'Fast Node Manager',
        },
      ],
    }));

    mockedTauri.envResolveAlias.mockResolvedValue('20.10.0');
    mockedTauri.envInstall.mockResolvedValue(undefined);
    mockedTauri.envGet.mockResolvedValue({
      env_type: 'fnm',
      provider_id: 'fnm',
      provider: 'fnm',
      current_version: '20.10.0',
      installed_versions: [],
      available: true,
    });
    mockedTauri.listenEnvInstallProgress.mockResolvedValue(jest.fn());

    const { result } = renderHook(() => useEnvironments());

    await act(async () => {
      await result.current.installVersion('fnm', 'lts', 'fnm');
    });

    expect(mockedTauri.envResolveAlias).toHaveBeenCalledWith('node', 'lts');
    expect(mockedTauri.envInstall).toHaveBeenCalledWith('fnm', '20.10.0', 'fnm');
  });

  it('saves environment settings via tauri and updates store', async () => {
    const settings = {
      envVariables: [{ key: 'NODE_ENV', value: 'production', enabled: true }],
      detectionFiles: [{ fileName: '.nvmrc', enabled: true }],
      autoSwitch: true,
    };

    mockedTauri.envSaveSettings.mockResolvedValue(undefined);

    const { result } = renderHook(() => useEnvironments());

    await act(async () => {
      await result.current.saveEnvSettings('fnm', settings);
    });

    expect(mockedTauri.envSaveSettings).toHaveBeenCalledWith({
      env_type: 'fnm',
      env_variables: [{ key: 'NODE_ENV', value: 'production', enabled: true }],
      detection_files: [{ file_name: '.nvmrc', enabled: true }],
      auto_switch: true,
    });

    expect(useEnvironmentStore.getState().getEnvSettings('fnm')).toEqual(settings);
  });
});
