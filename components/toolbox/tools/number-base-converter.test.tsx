import { fireEvent, render, screen } from '@testing-library/react';
import NumberBaseConverter from './number-base-converter';
import { TOOLBOX_LIMITS } from '@/lib/constants/toolbox-limits';
import { useToolboxStore } from '@/lib/stores/toolbox';

jest.mock('@/components/providers/locale-provider', () => ({
  useLocale: () => ({
    t: (key: string) => key,
  }),
}));

describe('NumberBaseConverter', () => {
  beforeEach(() => {
    useToolboxStore.setState({ toolPreferences: {} });
  });

  it('renders localized base labels', () => {
    render(<NumberBaseConverter />);

    expect(screen.getAllByText('toolbox.tools.numberBaseConverter.baseBinary').length).toBeGreaterThan(0);
    expect(screen.getAllByText('toolbox.tools.numberBaseConverter.baseOctal').length).toBeGreaterThan(0);
    expect(screen.getAllByText('toolbox.tools.numberBaseConverter.baseDecimal').length).toBeGreaterThan(0);
    expect(screen.getAllByText('toolbox.tools.numberBaseConverter.baseHexadecimal').length).toBeGreaterThan(0);
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

  it('persists the preferred source and target base pair across renders', () => {
    const { unmount } = render(<NumberBaseConverter />);

    fireEvent.click(
      screen.getByRole('button', {
        name: 'toolbox.tools.numberBaseConverter.sourceBase: toolbox.tools.numberBaseConverter.baseOctal',
      }),
    );
    fireEvent.click(
      screen.getByRole('button', {
        name: 'toolbox.tools.numberBaseConverter.targetBase: toolbox.tools.numberBaseConverter.baseHexadecimal',
      }),
    );

    expect(useToolboxStore.getState().toolPreferences['number-base-converter']).toEqual(
      expect.objectContaining({ sourceBase: 8, targetBase: 16 }),
    );

    unmount();
    render(<NumberBaseConverter />);

    expect(
      screen.getByRole('button', {
        name: 'toolbox.tools.numberBaseConverter.sourceBase: toolbox.tools.numberBaseConverter.baseOctal',
      }),
    ).toHaveAttribute('aria-pressed', 'true');
    expect(
      screen.getByRole('button', {
        name: 'toolbox.tools.numberBaseConverter.targetBase: toolbox.tools.numberBaseConverter.baseHexadecimal',
      }),
    ).toHaveAttribute('aria-pressed', 'true');
  });
});
