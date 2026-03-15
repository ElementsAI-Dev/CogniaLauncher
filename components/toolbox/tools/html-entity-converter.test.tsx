import { fireEvent, render, screen } from '@testing-library/react';
import HtmlEntityConverter from './html-entity-converter';
import { TOOLBOX_LIMITS } from '@/lib/constants/toolbox-limits';

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

describe('HtmlEntityConverter', () => {
  it('encodes HTML entities from text input', () => {
    render(<HtmlEntityConverter />);

    fireEvent.change(screen.getAllByRole('textbox')[0], {
      target: { value: '<div>' },
    });

    expect(screen.getByDisplayValue('&lt;div&gt;')).toBeInTheDocument();
  });

  it('shows guardrail feedback for oversized input', () => {
    render(<HtmlEntityConverter />);

    fireEvent.change(screen.getAllByRole('textbox')[0], {
      target: { value: 'a'.repeat(TOOLBOX_LIMITS.converterChars + 1) },
    });

    expect(screen.getByText('toolbox.tools.shared.inputTooLarge')).toBeInTheDocument();
  });
});
