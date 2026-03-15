import { fireEvent, render, screen } from '@testing-library/react';
import UuidGenerator from './uuid-generator';

const mockGenerateRandomUuid = jest.fn(() => '11111111-1111-4111-8111-111111111111');

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
  generateRandomUuid: () => mockGenerateRandomUuid(),
}));

describe('UuidGenerator', () => {
  beforeEach(() => {
    mockGenerateRandomUuid.mockReturnValue('11111111-1111-4111-8111-111111111111');
  });

  it('renders the generated UUID using the shared browser API helper', () => {
    render(<UuidGenerator />);

    expect(screen.getByText('11111111-1111-4111-8111-111111111111')).toBeInTheDocument();
  });

  it('shows degraded-environment feedback when UUID generation is unavailable', () => {
    mockGenerateRandomUuid.mockReturnValue(null);

    render(<UuidGenerator />);

    fireEvent.click(screen.getAllByText('toolbox.tools.uuidGenerator.generate').at(-1) as HTMLElement);

    expect(screen.getByText('toolbox.tools.shared.webCryptoUnavailable')).toBeInTheDocument();
  });
});
