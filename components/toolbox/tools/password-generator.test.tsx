import { fireEvent, render, screen } from '@testing-library/react';
import PasswordGenerator from './password-generator';
import { TOOLBOX_LIMITS } from '@/lib/constants/toolbox-limits';

const mockFillRandomValues = jest.fn((buffer: Uint32Array) => {
  buffer.fill(1);
  return true;
});

jest.mock('@/components/providers/locale-provider', () => ({
  useLocale: () => ({
    t: (key: string) => key,
  }),
}));

jest.mock('@/hooks/shared/use-clipboard', () => ({
  useCopyToClipboard: () => ({
    copied: false,
    copy: jest.fn(),
    paste: jest.fn().mockResolvedValue(''),
  }),
}));

jest.mock('@/lib/toolbox/browser-api', () => ({
  fillRandomValues: (buffer: Uint32Array) => mockFillRandomValues(buffer),
}));

describe('PasswordGenerator', () => {
  beforeEach(() => {
    mockFillRandomValues.mockImplementation((buffer: Uint32Array) => {
      buffer.fill(1);
      return true;
    });
  });

  it('generates batch output when requested', () => {
    render(<PasswordGenerator />);

    fireEvent.change(screen.getByLabelText('toolbox.tools.passwordGenerator.count'), {
      target: { value: '2' },
    });
    fireEvent.click(screen.getByText('toolbox.tools.passwordGenerator.generateAll'));

    expect(screen.getByText('toolbox.tools.passwordGenerator.batchOutput')).toBeInTheDocument();
  });

  it('clamps requested count to the guardrail limit', () => {
    render(<PasswordGenerator />);

    fireEvent.change(screen.getByLabelText('toolbox.tools.passwordGenerator.count'), {
      target: { value: String(TOOLBOX_LIMITS.generatorCount + 1) },
    });

    expect(screen.getByLabelText('toolbox.tools.passwordGenerator.count')).toHaveValue(
      TOOLBOX_LIMITS.generatorCount,
    );
  });

  it('shows crypto fallback messaging when random generation is unavailable', () => {
    mockFillRandomValues.mockReturnValue(false);

    render(<PasswordGenerator />);

    fireEvent.click(screen.getByText('toolbox.tools.passwordGenerator.generate'));

    expect(screen.getByText('toolbox.tools.passwordGenerator.cryptoUnavailable')).toBeInTheDocument();
  });
});
