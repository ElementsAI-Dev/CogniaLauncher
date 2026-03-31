import { fireEvent, render, screen } from '@testing-library/react';
import UrlEncoder from './url-encoder';
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

describe('UrlEncoder', () => {
  it('encodes text into URL-safe output', () => {
    render(<UrlEncoder />);

    fireEvent.change(screen.getAllByRole('textbox')[0], {
      target: { value: 'Hello World' },
    });

    expect(screen.getByDisplayValue('Hello%20World')).toBeInTheDocument();
  });

  it('shows guardrail feedback for oversized input', () => {
    render(<UrlEncoder />);

    fireEvent.change(screen.getAllByRole('textbox')[0], {
      target: { value: 'a'.repeat(TOOLBOX_LIMITS.converterChars + 1) },
    });

    expect(screen.getByText('toolbox.tools.shared.inputTooLarge')).toBeInTheDocument();
  });
});
