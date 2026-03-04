import { fireEvent, render, screen } from '@testing-library/react';
import PasswordGenerator from './password-generator';
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

describe('PasswordGenerator', () => {
  it('shows error when requested count exceeds guardrail', () => {
    render(<PasswordGenerator />);

    fireEvent.change(screen.getByLabelText('toolbox.tools.passwordGenerator.count'), {
      target: { value: String(TOOLBOX_LIMITS.generatorCount + 1) },
    });
    fireEvent.click(screen.getByText('toolbox.tools.passwordGenerator.generate'));

    expect(screen.getByText('toolbox.tools.shared.countTooLarge')).toBeInTheDocument();
  });
});

