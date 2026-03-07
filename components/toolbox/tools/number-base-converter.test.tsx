import { fireEvent, render, screen } from '@testing-library/react';
import NumberBaseConverter from './number-base-converter';
import { TOOLBOX_LIMITS } from '@/lib/constants/toolbox-limits';

jest.mock('@/components/providers/locale-provider', () => ({
  useLocale: () => ({
    t: (key: string) => key,
  }),
}));

describe('NumberBaseConverter', () => {
  it('renders localized base labels', () => {
    render(<NumberBaseConverter />);

    expect(screen.getByText('toolbox.tools.numberBaseConverter.baseBinary')).toBeInTheDocument();
    expect(screen.getByText('toolbox.tools.numberBaseConverter.baseOctal')).toBeInTheDocument();
    expect(screen.getByText('toolbox.tools.numberBaseConverter.baseDecimal')).toBeInTheDocument();
    expect(screen.getByText('toolbox.tools.numberBaseConverter.baseHexadecimal')).toBeInTheDocument();
  });

  it('converts hexadecimal input to decimal correctly', () => {
    render(<NumberBaseConverter />);

    fireEvent.change(screen.getByLabelText('toolbox.tools.numberBaseConverter.baseHexadecimal'), {
      target: { value: '0xff' },
    });

    expect(screen.getByLabelText('toolbox.tools.numberBaseConverter.baseDecimal')).toHaveValue('255');
  });

  it('shows guardrail error for oversized number payloads', () => {
    render(<NumberBaseConverter />);

    fireEvent.change(screen.getByLabelText('toolbox.tools.numberBaseConverter.baseDecimal'), {
      target: { value: '1'.repeat(TOOLBOX_LIMITS.numberBaseChars + 1) },
    });

    expect(screen.getByText('toolbox.tools.shared.inputTooLarge')).toBeInTheDocument();
  });
});
