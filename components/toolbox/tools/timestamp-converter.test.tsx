import { fireEvent, render, screen } from '@testing-library/react';
import TimestampConverter from './timestamp-converter';

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

describe('TimestampConverter', () => {
  it('renders output formats for a valid unix timestamp', () => {
    render(<TimestampConverter />);

    fireEvent.change(screen.getByPlaceholderText('1709136000'), {
      target: { value: '1700000000' },
    });

    expect(screen.getByText('toolbox.tools.timestampConverter.formatIso')).toBeInTheDocument();
    expect(screen.getByText('toolbox.tools.timestampConverter.formatUnixSeconds')).toBeInTheDocument();
  });

  it('shows validation feedback for invalid timestamp input', () => {
    render(<TimestampConverter />);

    fireEvent.change(screen.getByPlaceholderText('1709136000'), {
      target: { value: 'abc' },
    });

    expect(screen.getByText('toolbox.tools.timestampConverter.invalidTimestamp')).toBeInTheDocument();
  });
});
