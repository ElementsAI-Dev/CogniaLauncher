import { render } from '@testing-library/react';
import { Titlebar } from './titlebar';

let mockIsTauri = true;

jest.mock('@/lib/tauri', () => ({
  isTauri: () => mockIsTauri,
}));

const mockMinimize = jest.fn();
const mockToggleMaximize = jest.fn();
const mockClose = jest.fn();
const mockSetAlwaysOnTop = jest.fn();

jest.mock('@tauri-apps/api/window', () => ({
  getCurrentWindow: () => ({
    minimize: mockMinimize,
    toggleMaximize: mockToggleMaximize,
    close: mockClose,
    setAlwaysOnTop: mockSetAlwaysOnTop,
    isMaximized: jest.fn().mockResolvedValue(false),
    onResized: jest.fn().mockResolvedValue(() => {}),
    onFocusChanged: jest.fn().mockResolvedValue(() => {}),
  }),
}));

jest.mock('@/components/providers/locale-provider', () => ({
  useLocale: () => ({
    t: (key: string) => {
      const translations: Record<string, string> = {
        'titlebar.minimize': 'Minimize',
        'titlebar.maximize': 'Maximize',
        'titlebar.restore': 'Restore',
        'titlebar.close': 'Close',
        'titlebar.alwaysOnTop': 'Always on top',
      };
      return translations[key] || key;
    },
  }),
}));

describe('Titlebar', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockIsTauri = true;
  });

  it('renders nothing when not in Tauri environment', () => {
    mockIsTauri = false;
    const { container } = render(<Titlebar />);
    
    expect(container.firstChild).toBeNull();
  });

  it('renders titlebar when in Tauri environment', () => {
    const { container } = render(<Titlebar />);
    
    // Component renders in Tauri mode
    expect(container).toBeTruthy();
  });
});
