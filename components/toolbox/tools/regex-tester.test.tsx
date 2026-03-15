import { fireEvent, render, screen } from '@testing-library/react';
import RegexTester from './regex-tester';
import { TOOLBOX_LIMITS } from '@/lib/constants/toolbox-limits';

jest.mock('@/components/providers/locale-provider', () => ({
  useLocale: () => ({
    t: (key: string) => key,
  }),
}));

describe('RegexTester', () => {
  it('finds matches for a valid pattern and test text', () => {
    render(<RegexTester />);

    fireEvent.change(screen.getByPlaceholderText('[a-z]+'), {
      target: { value: 'hello' },
    });
    fireEvent.change(screen.getByPlaceholderText('toolbox.tools.regexTester.testTextPlaceholder'), {
      target: { value: 'hello world' },
    });

    expect(screen.getByText('#1')).toBeInTheDocument();
  });

  it('shows guardrail feedback for oversized payloads', () => {
    render(<RegexTester />);

    fireEvent.change(screen.getByPlaceholderText('[a-z]+'), {
      target: { value: 'hello' },
    });
    fireEvent.change(screen.getByPlaceholderText('toolbox.tools.regexTester.testTextPlaceholder'), {
      target: { value: 'a'.repeat(TOOLBOX_LIMITS.regexChars + 1) },
    });

    expect(screen.getByText('toolbox.tools.shared.inputTooLarge')).toBeInTheDocument();
  });
});
