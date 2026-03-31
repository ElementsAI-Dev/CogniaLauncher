import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import HashGenerator from './hash-generator';

const mockSupportsSubtleDigest = jest.fn(() => true);
const mockDigestWithSubtle = jest.fn(async () => Uint8Array.from([1, 2, 3]).buffer);
const mockIsTauri = jest.fn(() => false);
const mockToolboxHashFile = jest.fn();
const mockOpen = jest.fn();

jest.mock('@/components/providers/locale-provider', () => ({
  useLocale: () => ({
    t: (key: string) => key,
  }),
}));

jest.mock('@/components/ui/switch', () => ({
  Switch: ({
    checked,
    onCheckedChange,
  }: {
    checked: boolean;
    onCheckedChange: (checked: boolean) => void;
  }) => (
    <button type="button" aria-pressed={checked} onClick={() => onCheckedChange(!checked)}>
      switch
    </button>
  ),
}));

jest.mock('@/hooks/shared/use-clipboard', () => ({
  useCopyToClipboard: () => ({
    copied: false,
    error: null,
    copy: jest.fn(),
    paste: jest.fn().mockResolvedValue(''),
    clearError: jest.fn(),
  }),
}));

jest.mock('@/lib/toolbox/browser-api', () => ({
  supportsSubtleDigest: () => mockSupportsSubtleDigest(),
  digestWithSubtle: (...args: Parameters<typeof mockDigestWithSubtle>) => mockDigestWithSubtle(...args),
}));

jest.mock('@/lib/tauri', () => ({
  isTauri: () => mockIsTauri(),
  toolboxHashFile: (...args: Parameters<typeof mockToolboxHashFile>) => mockToolboxHashFile(...args),
}));

jest.mock('@tauri-apps/plugin-dialog', () => ({
  open: (...args: Parameters<typeof mockOpen>) => mockOpen(...args),
}));

describe('HashGenerator', () => {
  beforeEach(() => {
    mockSupportsSubtleDigest.mockReturnValue(true);
    mockDigestWithSubtle.mockResolvedValue(Uint8Array.from([1, 2, 3]).buffer);
    mockIsTauri.mockReturnValue(false);
    mockToolboxHashFile.mockReset();
    mockOpen.mockReset();
  });

  it('renders computed hash results after debounce', async () => {
    render(<HashGenerator />);

    expect(screen.getByText('toolbox.tools.hashGenerator.algorithms')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('toolbox.tools.hashGenerator.comparePlaceholder')).toBeInTheDocument();
  });

  it('shows degraded-environment feedback when subtle digest is unavailable', () => {
    mockSupportsSubtleDigest.mockReturnValue(false);

    render(<HashGenerator />);

    fireEvent.change(screen.getByPlaceholderText('toolbox.tools.hashGenerator.placeholder'), {
      target: { value: 'hello' },
    });

    expect(screen.getByText('toolbox.tools.hashGenerator.cryptoUnavailable')).toBeInTheDocument();
  });

  it('hashes a selected desktop file through the backend bridge', async () => {
    mockIsTauri.mockReturnValue(true);
    mockOpen.mockResolvedValue('D:\\demo.txt');
    mockToolboxHashFile.mockImplementation(async (_filePath: string, algorithm: string) => `${algorithm}-hash`);

    render(<HashGenerator />);

    fireEvent.click(screen.getByRole('button', { name: 'toolbox.tools.hashGenerator.hashFile' }));

    await waitFor(() => {
      expect(mockOpen).toHaveBeenCalled();
      expect(mockToolboxHashFile).toHaveBeenCalledWith('D:\\demo.txt', 'sha1');
      expect(mockToolboxHashFile).toHaveBeenCalledWith('D:\\demo.txt', 'sha256');
      expect(mockToolboxHashFile).toHaveBeenCalledWith('D:\\demo.txt', 'sha512');
    });

    expect(screen.getByText(/toolbox\.tools\.hashGenerator\.fileSelected/)).toBeInTheDocument();
  });
});
