import { fireEvent, render, screen } from '@testing-library/react';
import JwtDecoder from './jwt-decoder';

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

function toBase64Url(value: object) {
  return Buffer.from(JSON.stringify(value)).toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

describe('JwtDecoder', () => {
  it('decodes a valid JWT into header and payload sections', () => {
    const token = [
      toBase64Url({ alg: 'HS256', typ: 'JWT' }),
      toBase64Url({ sub: 'user-1' }),
      'signature',
    ].join('.');

    render(<JwtDecoder />);

    fireEvent.change(screen.getByPlaceholderText('toolbox.tools.jwtDecoder.placeholder'), {
      target: { value: token },
    });
    fireEvent.click(screen.getByText('toolbox.tools.jwtDecoder.decode'));

    expect(screen.getAllByText('toolbox.tools.jwtDecoder.header').length).toBeGreaterThan(0);
    expect(screen.getAllByText('toolbox.tools.jwtDecoder.payload').length).toBeGreaterThan(0);
    expect(screen.getByText('user-1')).toBeInTheDocument();
  });

  it('shows validation feedback for invalid token input', () => {
    render(<JwtDecoder />);

    fireEvent.change(screen.getByPlaceholderText('toolbox.tools.jwtDecoder.placeholder'), {
      target: { value: 'not-a-token' },
    });
    fireEvent.click(screen.getByText('toolbox.tools.jwtDecoder.decode'));

    expect(screen.getByText('toolbox.tools.jwtDecoder.invalidToken')).toBeInTheDocument();
  });
});
