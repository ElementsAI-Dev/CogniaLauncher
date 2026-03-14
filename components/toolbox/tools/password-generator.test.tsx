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
  it('clamps requested count to the guardrail limit', () => {
    render(<PasswordGenerator />);

    fireEvent.change(screen.getByLabelText('toolbox.tools.passwordGenerator.count'), {
      target: { value: String(TOOLBOX_LIMITS.generatorCount + 1) },
    });

    expect(screen.getByLabelText('toolbox.tools.passwordGenerator.count')).toHaveValue(
      TOOLBOX_LIMITS.generatorCount,
    );
  });
});
