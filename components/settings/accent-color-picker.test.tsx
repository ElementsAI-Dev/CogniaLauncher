import { render, screen, fireEvent } from '@testing-library/react';
import { AccentColorPicker } from './accent-color-picker';

// Mock the appearance store
const mockSetAccentColor = jest.fn();
let mockAccentColor = 'blue';

jest.mock('@/lib/stores/appearance', () => ({
  useAppearanceStore: () => ({
    accentColor: mockAccentColor,
    setAccentColor: mockSetAccentColor,
  }),
}));

describe('AccentColorPicker', () => {
  beforeEach(() => {
    mockSetAccentColor.mockClear();
    mockAccentColor = 'blue';
  });

  it('renders all color options', () => {
    render(<AccentColorPicker />);
    
    const buttons = screen.getAllByRole('button');
    expect(buttons).toHaveLength(6); // zinc, blue, green, purple, orange, rose
  });

  it('renders with correct aria labels', () => {
    render(<AccentColorPicker />);
    
    expect(screen.getByLabelText('Select Zinc accent color')).toBeInTheDocument();
    expect(screen.getByLabelText('Select Blue accent color')).toBeInTheDocument();
    expect(screen.getByLabelText('Select Green accent color')).toBeInTheDocument();
    expect(screen.getByLabelText('Select Purple accent color')).toBeInTheDocument();
    expect(screen.getByLabelText('Select Orange accent color')).toBeInTheDocument();
    expect(screen.getByLabelText('Select Rose accent color')).toBeInTheDocument();
  });

  it('marks current accent color as pressed', () => {
    mockAccentColor = 'green';
    render(<AccentColorPicker />);
    
    const greenButton = screen.getByLabelText('Select Green accent color');
    expect(greenButton).toHaveAttribute('aria-pressed', 'true');
  });

  it('calls setAccentColor when a color is clicked', () => {
    render(<AccentColorPicker />);
    
    const purpleButton = screen.getByLabelText('Select Purple accent color');
    fireEvent.click(purpleButton);
    
    expect(mockSetAccentColor).toHaveBeenCalledWith('purple');
  });

  it('shows check icon for selected color', () => {
    mockAccentColor = 'rose';
    render(<AccentColorPicker />);
    
    const roseButton = screen.getByLabelText('Select Rose accent color');
    const checkIcon = roseButton.querySelector('svg');
    expect(checkIcon).toBeInTheDocument();
  });

  it('applies custom className', () => {
    render(<AccentColorPicker className="custom-class" />);
    
    const container = screen.getAllByRole('button')[0].parentElement;
    expect(container).toHaveClass('custom-class');
  });
});
