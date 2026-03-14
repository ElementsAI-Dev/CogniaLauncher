import type { ReactNode } from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { BuiltInToolRenderer } from './built-in-tool-renderer';

const mockSetToolLifecycle = jest.fn();
const mockClearToolLifecycle = jest.fn();
const mockIsTauri = jest.fn(() => true);
const mockGetToolById = jest.fn();

jest.mock('@/components/providers/locale-provider', () => ({
  useLocale: () => ({
    t: (key: string) => key,
  }),
}));

jest.mock('@/lib/stores/toolbox', () => ({
  useToolboxStore: (
    selector: (state: {
      setToolLifecycle: typeof mockSetToolLifecycle;
      clearToolLifecycle: typeof mockClearToolLifecycle;
    }) => unknown,
  ) =>
    selector({
      setToolLifecycle: mockSetToolLifecycle,
      clearToolLifecycle: mockClearToolLifecycle,
    }),
}));

jest.mock('@/components/environments/environment-error-boundary', () => ({
  EnvironmentErrorBoundary: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

jest.mock('@/lib/constants/toolbox', () => ({
  getToolById: (toolId: string) => mockGetToolById(toolId),
}));

jest.mock('@/lib/tauri', () => ({
  isTauri: () => mockIsTauri(),
}));

describe('BuiltInToolRenderer', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockIsTauri.mockReturnValue(true);
  });

  it('shows desktop-required fallback for built-in tools that require Tauri', () => {
    mockIsTauri.mockReturnValue(false);
    mockGetToolById.mockReturnValue({
      id: 'desktop-only-tool',
      requiresTauri: true,
      component: jest.fn().mockResolvedValue({ default: () => <div>desktop-only</div> }),
    });

    render(<BuiltInToolRenderer builtInId="desktop-only-tool" />);

    expect(screen.getByText('toolbox.runtime.desktopRequiredDescription')).toBeInTheDocument();
  });

  it('shows explicit empty fallback when built-in tool cannot be resolved', async () => {
    mockGetToolById.mockReturnValue(undefined);

    render(<BuiltInToolRenderer builtInId="missing-tool" />);

    await waitFor(() => {
      expect(screen.getByText('toolbox.runtime.emptyDescription')).toBeInTheDocument();
    });
  });

  it('clears lifecycle state when unmounted', () => {
    mockIsTauri.mockReturnValue(false);
    mockGetToolById.mockReturnValue({
      id: 'json-formatter',
      requiresTauri: true,
      component: jest.fn().mockResolvedValue({ default: () => <div>json formatter</div> }),
    });

    const { unmount } = render(<BuiltInToolRenderer builtInId="json-formatter" />);
    unmount();

    expect(mockClearToolLifecycle).toHaveBeenCalledWith('builtin:json-formatter');
  });
});
