import { fireEvent, render, screen } from '@testing-library/react';
import JsonFormatter from './json-formatter';
import { TOOLBOX_LIMITS } from '@/lib/constants/toolbox-limits';

jest.mock('@/components/providers/locale-provider', () => ({
  useLocale: () => ({
    t: (key: string) => key,
  }),
}));

jest.mock('@/hooks/use-clipboard', () => ({
  useCopyToClipboard: () => ({
    copied: false,
    copy: jest.fn(),
    paste: jest.fn().mockResolvedValue(''),
  }),
}));

describe('JsonFormatter', () => {
  it('shows parse errors for invalid json', () => {
    render(<JsonFormatter />);

    fireEvent.change(screen.getByPlaceholderText('{"key": "value"}'), {
      target: { value: '{' },
    });
    fireEvent.click(screen.getByText('toolbox.tools.jsonFormatter.format'));

    expect(screen.getByText(/Line 1, Column 2/)).toBeInTheDocument();
  });

  it('shows guardrail error for oversized input', () => {
    render(<JsonFormatter />);
    fireEvent.change(screen.getByPlaceholderText('{"key": "value"}'), {
      target: { value: 'a'.repeat(TOOLBOX_LIMITS.jsonChars + 1) },
    });
    fireEvent.click(screen.getByText('toolbox.tools.jsonFormatter.format'));

    expect(screen.getByText('toolbox.tools.shared.inputTooLarge')).toBeInTheDocument();
  });
});
