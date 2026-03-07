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

    expect(screen.getByText('toolbox.tools.cronParser.presets.everyMinute')).toBeInTheDocument();
    expect(screen.getByText('toolbox.tools.cronParser.fields.minute')).toBeInTheDocument();
  });

  it('shows guardrail error for oversized expressions', () => {
    render(<CronParser />);

    fireEvent.change(screen.getByPlaceholderText('* * * * *'), {
      target: { value: '*'.repeat(TOOLBOX_LIMITS.cronExpressionChars + 1) },
    });
    fireEvent.click(screen.getByText('toolbox.tools.cronParser.parse'));

    expect(screen.getByText('toolbox.tools.shared.inputTooLarge')).toBeInTheDocument();
  });

  it('shows bounded feedback when preview count exceeds limit', () => {
    render(<CronParser />);

    fireEvent.change(screen.getByLabelText('toolbox.tools.cronParser.previewCount'), {
      target: { value: String(TOOLBOX_LIMITS.cronPreviewCount + 5) },
    });

    expect(screen.getByText('toolbox.tools.cronParser.previewCountBounded')).toBeInTheDocument();
  });
});
