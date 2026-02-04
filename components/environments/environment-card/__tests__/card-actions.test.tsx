import { render, screen, fireEvent } from '@testing-library/react';
import { CardActions } from '../card-actions';

describe('CardActions', () => {
  const mockOnBrowseVersions = jest.fn();
  const mockOnViewDetails = jest.fn();
  const mockT = (key: string) => {
    const translations: Record<string, string> = {
      'environments.browseVersions': 'Browse Versions',
      'environments.viewDetails': 'View Details',
    };
    return translations[key] || key;
  };

  const defaultProps = {
    onBrowseVersions: mockOnBrowseVersions,
    onViewDetails: mockOnViewDetails,
    t: mockT,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders browse versions button', () => {
    render(<CardActions {...defaultProps} />);
    expect(screen.getByText('Browse Versions')).toBeInTheDocument();
  });

  it('renders view details button', () => {
    render(<CardActions {...defaultProps} />);
    expect(screen.getByText('View Details')).toBeInTheDocument();
  });

  it('calls onBrowseVersions when browse versions button is clicked', () => {
    render(<CardActions {...defaultProps} />);
    fireEvent.click(screen.getByText('Browse Versions'));
    expect(mockOnBrowseVersions).toHaveBeenCalledTimes(1);
  });

  it('calls onViewDetails when view details button is clicked', () => {
    render(<CardActions {...defaultProps} />);
    fireEvent.click(screen.getByText('View Details'));
    expect(mockOnViewDetails).toHaveBeenCalledTimes(1);
  });

  it('renders buttons with outline variant', () => {
    render(<CardActions {...defaultProps} />);
    const buttons = screen.getAllByRole('button');
    expect(buttons).toHaveLength(2);
  });

  it('renders buttons in a flex container', () => {
    const { container } = render(<CardActions {...defaultProps} />);
    const flexContainer = container.querySelector('.flex.gap-2');
    expect(flexContainer).toBeInTheDocument();
  });
});
