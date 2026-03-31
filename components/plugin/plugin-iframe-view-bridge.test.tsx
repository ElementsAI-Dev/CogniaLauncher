import { render, screen, waitFor } from '@testing-library/react';
import { PluginIframeView } from './plugin-iframe-view';

const mockPluginGetUiEntry = jest.fn();
const mockCallTool = jest.fn();
const mockGetLocales = jest.fn().mockResolvedValue(null);
const mockTranslatePluginKey = jest.fn((_l: unknown, _locale: string, key: string) => key);
const mockGetUiAsset = jest.fn().mockResolvedValue(null);
const mockPush = jest.fn();
const mockConfirm = jest.fn();
const mockOpen = jest.fn();
const mockSave = jest.fn();
const mockOpenUrl = jest.fn();
const mockRevealItemInDir = jest.fn();

jest.mock('@/components/providers/locale-provider', () => ({
  useLocale: () => ({ t: (k: string) => k, locale: 'en' }),
}));

jest.mock('@/hooks/plugins/use-plugins', () => ({
  usePlugins: () => ({
    callTool: mockCallTool,
    getLocales: mockGetLocales,
    translatePluginKey: mockTranslatePluginKey,
    getUiAsset: mockGetUiAsset,
  }),
}));

jest.mock('@/lib/tauri', () => ({
  pluginGetUiEntry: (...args: unknown[]) => mockPluginGetUiEntry(...args),
}));

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}));

jest.mock('sonner', () => ({
  toast: {
    info: jest.fn(),
    success: jest.fn(),
    warning: jest.fn(),
    error: jest.fn(),
  },
}));

jest.mock('@tauri-apps/plugin-dialog', () => ({
  open: (...args: unknown[]) => mockOpen(...args),
  save: (...args: unknown[]) => mockSave(...args),
  confirm: (...args: unknown[]) => mockConfirm(...args),
}));

jest.mock('@tauri-apps/plugin-opener', () => ({
  openUrl: (...args: unknown[]) => mockOpenUrl(...args),
  revealItemInDir: (...args: unknown[]) => mockRevealItemInDir(...args),
}));

describe('PluginIframeView UI bridge', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  async function renderView(permissions: string[]) {
    mockPluginGetUiEntry.mockResolvedValue({
      html: '<html><head></head><body><div>demo</div></body></html>',
      pluginId: 'plugin.demo',
      permissions,
    });

    render(<PluginIframeView pluginId="plugin.demo" toolEntry="run" />);

    const iframe = await waitFor(() => screen.getByTitle('Plugin: plugin.demo'));
    const postMessage = jest.fn();
    Object.defineProperty(iframe, 'contentWindow', {
      value: { postMessage },
      configurable: true,
    });

    return { iframe, postMessage };
  }

  function dispatchRpc(
    iframe: HTMLElement,
    method: string,
    params: Record<string, unknown> = {},
  ) {
    window.dispatchEvent(
      new MessageEvent('message', {
        data: { type: 'cognia-rpc', id: 'rpc_1', method, params },
        source: (iframe as HTMLIFrameElement).contentWindow as MessageEventSource,
      }),
    );
  }

  it('returns ok for confirm when dialog resolves true', async () => {
    mockConfirm.mockResolvedValue(true);
    const { iframe, postMessage } = await renderView(['ui_dialog']);

    dispatchRpc(iframe, 'ui.confirm', { message: 'Continue?' });

    await waitFor(() => expect(postMessage).toHaveBeenCalled());
    expect(postMessage.mock.calls[0][0].result.status).toBe('ok');
    expect(postMessage.mock.calls[0][0].result.data).toEqual({ confirmed: true });
  });

  it('returns denied for navigate without permission', async () => {
    const { iframe, postMessage } = await renderView([]);

    dispatchRpc(iframe, 'ui.navigate', { path: '/toolbox' });

    await waitFor(() => expect(postMessage).toHaveBeenCalled());
    expect(postMessage.mock.calls[0][0].result.status).toBe('denied');
    expect(mockPush).not.toHaveBeenCalled();
  });

  it('rejects protocol-relative navigate paths', async () => {
    const { iframe, postMessage } = await renderView(['ui_navigation']);

    dispatchRpc(iframe, 'ui.navigate', { path: '//attacker.example' });

    await waitFor(() => expect(postMessage).toHaveBeenCalled());
    expect(postMessage.mock.calls[0][0].result.status).toBe('error');
    expect(mockPush).not.toHaveBeenCalled();
  });

  it('returns cancelled for pickFile when user closes dialog', async () => {
    mockOpen.mockResolvedValue(null);
    const { iframe, postMessage } = await renderView(['ui_file_picker']);

    dispatchRpc(iframe, 'ui.pickFile', { title: 'Pick file' });

    await waitFor(() => expect(postMessage).toHaveBeenCalled());
    expect(postMessage.mock.calls[0][0].result.status).toBe('cancelled');
  });

  it('returns unavailable for openExternal with empty url payload', async () => {
    const { iframe, postMessage } = await renderView(['ui_navigation']);

    dispatchRpc(iframe, 'ui.openExternal', { url: '' });

    await waitFor(() => expect(postMessage).toHaveBeenCalled());
    expect(postMessage.mock.calls[0][0].result.status).toBe('unavailable');
  });
});
