import { fireEvent, render, screen } from '@testing-library/react';
import ColorPicker from './color-picker';
import { useToolboxStore } from '@/lib/stores/toolbox';

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

describe('ColorPicker', () => {
  beforeEach(() => {
    useToolboxStore.setState({ toolPreferences: {} });
  });

  it('renders localized format labels', () => {
    render(<ColorPicker />);

    expect(screen.getAllByText('toolbox.tools.colorPicker.formatHex').length).toBeGreaterThan(0);
    expect(screen.getAllByText('toolbox.tools.colorPicker.formatRgb').length).toBeGreaterThan(0);
    expect(screen.getAllByText('toolbox.tools.colorPicker.formatHsl').length).toBeGreaterThan(0);
    expect(screen.getAllByText('toolbox.tools.colorPicker.contrastValue').length).toBeGreaterThan(0);
  });

  it('shows validation feedback for invalid hex input', () => {
    render(<ColorPicker />);

    fireEvent.change(screen.getByPlaceholderText('#3b82f6'), {
      target: { value: '#12z' },
    });

    expect(screen.getByText('toolbox.tools.colorPicker.invalidHex')).toBeInTheDocument();
  });

  it('persists the preferred color format across renders', () => {
    const { unmount } = render(<ColorPicker />);

    fireEvent.click(screen.getByRole('button', { name: 'toolbox.tools.colorPicker.formatHsl' }));

    expect(useToolboxStore.getState().toolPreferences['color-picker']).toEqual(
      expect.objectContaining({ preferredFormat: 'hsl' }),
    );

    unmount();
    render(<ColorPicker />);

    expect(screen.getByRole('button', { name: 'toolbox.tools.colorPicker.formatHsl' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });
});
