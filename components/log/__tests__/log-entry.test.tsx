import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LogEntry } from '../log-entry';
import type { LogEntry as LogEntryType } from '@/lib/stores/log';

// Mock locale provider
jest.mock('@/components/providers/locale-provider', () => ({
  useLocale: () => ({
    t: (key: string) => {
      const translations: Record<string, string> = {
        'common.copy': 'Copy',
      };
      return translations[key] || key;
    },
  }),
}));

// Mock clipboard API
const mockWriteText = jest.fn(() => Promise.resolve());
Object.assign(navigator, {
  clipboard: {
    writeText: mockWriteText,
  },
});

describe('LogEntry', () => {
  const mockEntry: LogEntryType = {
    id: 'test-id-1',
    timestamp: new Date('2026-02-02T12:00:00Z').getTime(),
    level: 'info',
    message: 'Test log message',
    target: 'app',
  };

  beforeEach(() => {
    mockWriteText.mockClear();
  });

  it('renders log entry with message', () => {
    render(<LogEntry entry={mockEntry} />);
    expect(screen.getByText('Test log message')).toBeInTheDocument();
  });

  it('displays formatted timestamp', () => {
    render(<LogEntry entry={mockEntry} />);
    // Should have a time element with formatted timestamp
    const timeElement = screen.getByText(/12:00:00/);
    expect(timeElement).toBeInTheDocument();
  });

  it('displays level badge', () => {
    render(<LogEntry entry={mockEntry} />);
    expect(screen.getByText('INFO')).toBeInTheDocument();
  });

  it('displays target when provided', () => {
    render(<LogEntry entry={mockEntry} />);
    expect(screen.getByText('[app]')).toBeInTheDocument();
  });

  it('renders without target when not provided', () => {
    const entryWithoutTarget = { ...mockEntry, target: undefined };
    render(<LogEntry entry={entryWithoutTarget} />);
    expect(screen.queryByText(/\[.*\]/)).not.toBeInTheDocument();
  });

  describe('log levels', () => {
    it('renders trace level with correct styling', () => {
      const traceEntry = { ...mockEntry, level: 'trace' as const };
      render(<LogEntry entry={traceEntry} />);
      expect(screen.getByText('TRACE')).toBeInTheDocument();
    });

    it('renders debug level with correct styling', () => {
      const debugEntry = { ...mockEntry, level: 'debug' as const };
      render(<LogEntry entry={debugEntry} />);
      expect(screen.getByText('DEBUG')).toBeInTheDocument();
    });

    it('renders info level with correct styling', () => {
      render(<LogEntry entry={mockEntry} />);
      expect(screen.getByText('INFO')).toBeInTheDocument();
    });

    it('renders warn level with correct styling', () => {
      const warnEntry = { ...mockEntry, level: 'warn' as const };
      render(<LogEntry entry={warnEntry} />);
      expect(screen.getByText('WARN')).toBeInTheDocument();
    });

    it('renders error level with correct styling', () => {
      const errorEntry = { ...mockEntry, level: 'error' as const };
      render(<LogEntry entry={errorEntry} />);
      expect(screen.getByText('ERROR')).toBeInTheDocument();
    });
  });

  describe('copy functionality', () => {
    it('shows copy button on hover', async () => {
      const user = userEvent.setup();
      render(<LogEntry entry={mockEntry} />);

      const entryElement = screen.getByText('Test log message').closest('div');
      if (entryElement) {
        await user.hover(entryElement);
      }

      // Copy button should be in the DOM
      const copyButton = screen.queryByRole('button');
      expect(copyButton).toBeInTheDocument();
    });

    it('copies log message to clipboard when clicked', async () => {
      const user = userEvent.setup();
      render(<LogEntry entry={mockEntry} />);

      const copyButton = screen.getByRole('button');
      await user.click(copyButton);

      expect(mockWriteText).toHaveBeenCalledWith('Test log message');
    });
  });

  it('handles long messages gracefully', () => {
    const longMessage = 'A'.repeat(1000);
    const entryWithLongMessage = { ...mockEntry, message: longMessage };
    render(<LogEntry entry={entryWithLongMessage} />);
    expect(screen.getByText(longMessage)).toBeInTheDocument();
  });

  it('handles multiline messages', () => {
    const multilineMessage = 'Line 1\nLine 2\nLine 3';
    const entryWithMultiline = { ...mockEntry, message: multilineMessage };
    render(<LogEntry entry={entryWithMultiline} />);
    expect(screen.getByText(multilineMessage)).toBeInTheDocument();
  });
});
