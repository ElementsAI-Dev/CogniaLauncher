import { fireEvent, render, screen } from '@testing-library/react';
import HashGenerator from './hash-generator';

const mockSupportsSubtleDigest = jest.fn(() => true);
const mockDigestWithSubtle = jest.fn(async () => Uint8Array.from([1, 2, 3]).buffer);

jest.mock('@/components/providers/locale-provider', () => ({
  useLocale: () => ({
    t: (key: string) => key,
  }),
}));

jest.mock('@/hooks/use-clipboard', () => ({
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

describe('HashGenerator', () => {
  beforeEach(() => {
    mockSupportsSubtleDigest.mockReturnValue(true);
    mockDigestWithSubtle.mockResolvedValue(Uint8Array.from([1, 2, 3]).buffer);
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
});
