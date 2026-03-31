import { fireEvent, render, screen } from '@testing-library/react';
import TextDiff from './text-diff';
import { TOOLBOX_LIMITS } from '@/lib/constants/toolbox-limits';

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

describe('TextDiff', () => {
  it('renders added and removed lines for different inputs', () => {
    render(<TextDiff />);

    fireEvent.change(screen.getByPlaceholderText('toolbox.tools.textDiff.originalPlaceholder'), {
      target: { value: 'alpha\nbeta' },
    });
    fireEvent.change(screen.getByPlaceholderText('toolbox.tools.textDiff.modifiedPlaceholder'), {
      target: { value: 'alpha\ngamma' },
    });

    expect(screen.getByText('+1 toolbox.tools.textDiff.added')).toBeInTheDocument();
    expect(screen.getByText('-1 toolbox.tools.textDiff.removed')).toBeInTheDocument();
  });

  it('shows guardrail feedback for oversized input', () => {
    render(<TextDiff />);

    fireEvent.change(screen.getByPlaceholderText('toolbox.tools.textDiff.originalPlaceholder'), {
      target: { value: 'a'.repeat(TOOLBOX_LIMITS.diffCharsPerInput + 1) },
    });

    expect(screen.getByText('toolbox.tools.shared.inputTooLarge')).toBeInTheDocument();
  });
});
