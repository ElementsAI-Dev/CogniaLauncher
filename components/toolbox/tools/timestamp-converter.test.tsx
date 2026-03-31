import { fireEvent, render, screen } from '@testing-library/react';
import TimestampConverter from './timestamp-converter';
import { useToolboxStore } from '@/lib/stores/toolbox';

jest.mock('@/components/providers/locale-provider', () => ({
  useLocale: () => ({
    t: (key: string) => key,
  }),
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

describe('TimestampConverter', () => {
  beforeEach(() => {
    useToolboxStore.setState({ toolPreferences: {} });
  });

  it('renders output formats for a valid unix timestamp', () => {
    render(<TimestampConverter />);

    fireEvent.change(screen.getByPlaceholderText('1709136000'), {
      target: { value: '1700000000' },
    });

    expect(screen.getAllByText('toolbox.tools.timestampConverter.formatIso').length).toBeGreaterThan(0);
    expect(screen.getAllByText('toolbox.tools.timestampConverter.formatUnixSeconds').length).toBeGreaterThan(0);
  });

  it('shows validation feedback for invalid timestamp input', () => {
    render(<TimestampConverter />);

    fireEvent.change(screen.getByPlaceholderText('1709136000'), {
      target: { value: 'abc' },
    });

    expect(screen.getByText('toolbox.tools.timestampConverter.invalidTimestamp')).toBeInTheDocument();
  });

  it('persists preferred timezone and primary format across renders', () => {
    const { unmount } = render(<TimestampConverter />);

    fireEvent.click(screen.getByRole('button', { name: 'toolbox.tools.timestampConverter.timezoneUtc' }));
    fireEvent.click(screen.getByRole('button', { name: 'toolbox.tools.timestampConverter.formatLocal' }));

    expect(useToolboxStore.getState().toolPreferences['timestamp-converter']).toEqual(
      expect.objectContaining({ timezone: 'utc', primaryFormat: 'local' }),
    );

    unmount();
    render(<TimestampConverter />);

    expect(
      screen.getByRole('button', { name: 'toolbox.tools.timestampConverter.timezoneUtc' }),
    ).toHaveAttribute('aria-pressed', 'true');
    expect(
      screen.getByRole('button', { name: 'toolbox.tools.timestampConverter.formatLocal' }),
    ).toHaveAttribute('aria-pressed', 'true');
  });
});
