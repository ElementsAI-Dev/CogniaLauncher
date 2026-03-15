import { fireEvent, render, screen } from '@testing-library/react';
import ColorPicker from './color-picker';

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

describe('ColorPicker', () => {
  it('renders localized format labels', () => {
    render(<ColorPicker />);

    expect(screen.getAllByText('toolbox.tools.colorPicker.formatHex').length).toBeGreaterThan(0);
    expect(screen.getByText('toolbox.tools.colorPicker.formatRgb')).toBeInTheDocument();
    expect(screen.getByText('toolbox.tools.colorPicker.formatHsl')).toBeInTheDocument();
    expect(screen.getByText('toolbox.tools.colorPicker.contrastValue')).toBeInTheDocument();
  });

  it('shows validation feedback for invalid hex input', () => {
    render(<ColorPicker />);

    fireEvent.change(screen.getByPlaceholderText('#3b82f6'), {
      target: { value: '#12z' },
    });

    expect(screen.getByText('toolbox.tools.colorPicker.invalidHex')).toBeInTheDocument();
  });
});
