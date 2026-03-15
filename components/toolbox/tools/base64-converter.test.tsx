import { fireEvent, render, screen } from '@testing-library/react';
import Base64Converter from './base64-converter';
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

describe('Base64Converter', () => {
  it('renders localized encode/decode shell controls', () => {
    render(<Base64Converter />);

    expect(screen.getByText('toolbox.tools.base64Converter.directionEncode')).toBeInTheDocument();
    expect(screen.getAllByText('toolbox.tools.base64Converter.base64Output').length).toBeGreaterThan(0);
  });

  it('shows guardrail feedback for oversized input', () => {
    render(<Base64Converter />);

    fireEvent.change(screen.getAllByRole('textbox')[0], {
      target: { value: 'a'.repeat(TOOLBOX_LIMITS.converterChars + 1) },
    });

    expect(screen.getByText('toolbox.tools.shared.inputTooLarge')).toBeInTheDocument();
  });
});
