import { fireEvent, render, screen } from '@testing-library/react';
import CronParser from './cron-parser';
import { TOOLBOX_LIMITS } from '@/lib/constants/toolbox-limits';

jest.mock('@/components/providers/locale-provider', () => ({
  useLocale: () => ({
    t: (key: string) => key,
  }),
}));

describe('CronParser', () => {
  it('renders localized preset and field labels', () => {
    render(<CronParser />);

    expect(screen.getByText('Every minute')).toBeInTheDocument();
    expect(screen.getAllByText('toolbox.tools.cronParser.fields.minute').length).toBeGreaterThan(0);
  });

  it('shows guardrail error for oversized expressions', () => {
    render(<CronParser />);

    fireEvent.change(screen.getByPlaceholderText('* * * * *'), {
      target: { value: '*'.repeat(TOOLBOX_LIMITS.cronExpressionChars + 1) },
    });
    expect(screen.getByText('toolbox.tools.shared.inputTooLarge')).toBeInTheDocument();
  });

  it('shows bounded feedback when preview count exceeds limit', async () => {
    render(<CronParser />);

    const previewCountInput = await screen.findByLabelText('toolbox.tools.cronParser.previewCount');
    fireEvent.change(previewCountInput, {
      target: { value: String(TOOLBOX_LIMITS.cronPreviewCount + 5) },
    });

    expect(screen.getByText('toolbox.tools.cronParser.previewCountBounded')).toBeInTheDocument();
  });
});
