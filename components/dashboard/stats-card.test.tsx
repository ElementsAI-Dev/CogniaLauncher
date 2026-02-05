import { render, screen, fireEvent } from '@testing-library/react';
import { StatsCard, StatsCardSkeleton } from './stats-card';

// Mock next/navigation
const mockPush = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}));

describe('StatsCard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders title and value', () => {
    render(<StatsCard title="Test Title" value={42} />);
    
    expect(screen.getByText('Test Title')).toBeInTheDocument();
    expect(screen.getByText('42')).toBeInTheDocument();
  });

  it('renders description when provided', () => {
    render(<StatsCard title="Title" value={10} description="Test description" />);
    
    expect(screen.getByText('Test description')).toBeInTheDocument();
  });

  it('renders icon when provided', () => {
    render(
      <StatsCard 
        title="Title" 
        value={10} 
        icon={<span data-testid="test-icon">Icon</span>} 
      />
    );
    
    expect(screen.getByTestId('test-icon')).toBeInTheDocument();
  });

  it('navigates when href is provided and clicked', () => {
    render(<StatsCard title="Title" value={10} href="/test-route" />);
    
    const card = screen.getByRole('button');
    fireEvent.click(card);
    
    expect(mockPush).toHaveBeenCalledWith('/test-route');
  });

  it('calls onClick handler when provided', () => {
    const handleClick = jest.fn();
    render(<StatsCard title="Title" value={10} onClick={handleClick} />);
    
    const card = screen.getByRole('button');
    fireEvent.click(card);
    
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('has correct ARIA attributes when clickable', () => {
    render(<StatsCard title="Title" value={10} href="/test" />);
    
    const card = screen.getByRole('button');
    expect(card).toHaveAttribute('tabIndex', '0');
  });

  it('does not have button role when not clickable', () => {
    render(<StatsCard title="Title" value={10} />);
    
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('handles keyboard navigation (Enter key)', () => {
    render(<StatsCard title="Title" value={10} href="/test-route" />);
    
    const card = screen.getByRole('button');
    fireEvent.keyDown(card, { key: 'Enter' });
    
    expect(mockPush).toHaveBeenCalledWith('/test-route');
  });

  it('handles keyboard navigation (Space key)', () => {
    render(<StatsCard title="Title" value={10} href="/test-route" />);
    
    const card = screen.getByRole('button');
    fireEvent.keyDown(card, { key: ' ' });
    
    expect(mockPush).toHaveBeenCalledWith('/test-route');
  });

  it('renders loading skeleton when loading is true', () => {
    const { container } = render(<StatsCard title="Title" value={10} loading={true} />);
    
    // Skeleton should be rendered instead of actual content
    expect(screen.queryByText('Title')).not.toBeInTheDocument();
    expect(container.querySelector('.animate-pulse')).toBeInTheDocument();
  });

  it('renders trend indicator when provided', () => {
    render(
      <StatsCard 
        title="Title" 
        value={10} 
        trend={{ direction: 'up', label: '+5' }} 
      />
    );
    
    expect(screen.getByText('↑')).toBeInTheDocument();
    expect(screen.getByText('+5')).toBeInTheDocument();
  });

  it('renders trend indicator with correct color for down direction', () => {
    render(
      <StatsCard 
        title="Title" 
        value={10} 
        trend={{ direction: 'down' }} 
      />
    );
    
    const trendIndicator = screen.getByText('↓');
    expect(trendIndicator).toHaveClass('text-red-500');
  });
});

describe('StatsCardSkeleton', () => {
  it('renders skeleton elements', () => {
    const { container } = render(<StatsCardSkeleton />);
    
    // Should have skeleton elements
    expect(container.querySelectorAll('.animate-pulse').length).toBeGreaterThan(0);
  });

  it('accepts custom className', () => {
    const { container } = render(<StatsCardSkeleton className="custom-class" />);
    
    expect(container.firstChild).toHaveClass('custom-class');
  });
});
