import { fireEvent, render, screen } from '@testing-library/react';
import LoremGenerator from './lorem-generator';
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

describe('LoremGenerator', () => {
  it('renders generated text output by default', () => {
    render(<LoremGenerator />);

    expect(screen.getByText('toolbox.tools.loremGenerator.generatedText')).toBeInTheDocument();
    expect(screen.getByText(/toolbox\.tools\.loremGenerator\.words/)).toBeInTheDocument();
  });

  it('shows guardrail feedback for oversized requested counts', () => {
    render(<LoremGenerator />);

    fireEvent.change(screen.getByDisplayValue('3'), {
      target: { value: String(TOOLBOX_LIMITS.generatorCount + 1) },
    });

    expect(screen.getByText('toolbox.tools.shared.countTooLarge')).toBeInTheDocument();
  });
});
