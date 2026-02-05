import { render, waitFor } from '@testing-library/react';
import { LogFileViewer } from './log-file-viewer';
import { useLogStore } from '@/lib/stores/log';

const mockQueryLogFile = jest.fn();
const mockExportLogFile = jest.fn();

jest.mock('@/hooks/use-logs', () => ({
  useLogs: () => ({
    queryLogFile: mockQueryLogFile,
    exportLogFile: mockExportLogFile,
  }),
}));

jest.mock('@/components/providers/locale-provider', () => ({
  useLocale: () => ({
    t: (key: string) => key,
  }),
}));

describe('LogFileViewer', () => {
  beforeEach(() => {
    mockQueryLogFile.mockReset();
    mockExportLogFile.mockReset();
    useLogStore.setState({
      logs: [],
      maxLogs: 1000,
      filter: {
        levels: ['info', 'warn', 'error'],
        search: '',
        useRegex: false,
        startTime: null,
        endTime: null,
      },
      autoScroll: true,
      paused: false,
      drawerOpen: false,
      logFiles: [],
      selectedLogFile: null,
    });
  });

  it('calls queryLogFile when opened', async () => {
    mockQueryLogFile.mockResolvedValue({
      entries: [
        {
          timestamp: '2026-02-02T12:00:00Z',
          level: 'INFO',
          target: 'app',
          message: 'File entry message',
          lineNumber: 1,
        },
      ],
      totalCount: 1,
      hasMore: false,
    });

    render(
      <LogFileViewer
        open
        fileName="app.log"
        onOpenChange={() => undefined}
      />
    );

    await waitFor(() => {
      expect(mockQueryLogFile).toHaveBeenCalled();
    });
  });
});
