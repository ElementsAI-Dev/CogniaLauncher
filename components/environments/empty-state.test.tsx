import { render, screen, fireEvent } from '@testing-library/react';
import { EmptyState } from './empty-state';

describe('EmptyState', () => {
  const mockOnAddEnvironment = jest.fn();
  const mockT = (key: string) => {
    const translations: Record<string, string> = {
      'environments.emptyState.title': 'No Environments Configured',
      'environments.noEnvironments': 'Get started by adding your first development environment',
      'environments.addEnvironment': 'Add Environment',
      'environments.emptyState.feature1Title': 'Version Management',
      'environments.emptyState.feature1Desc': 'Install and switch between versions easily',
      'environments.emptyState.feature2Title': 'Multiple Languages',
      'environments.emptyState.feature2Desc': 'Support for Node.js, Python, Go, Rust & more',
      'environments.emptyState.feature3Title': 'Auto Detection',
      'environments.emptyState.feature3Desc': 'Automatically detect project versions',
    };
    return translations[key] || key;
  };

  const defaultProps = {
    onAddEnvironment: mockOnAddEnvironment,
    t: mockT,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders empty state title', () => {
    render(<EmptyState {...defaultProps} />);
    expect(screen.getByText('No Environments Configured')).toBeInTheDocument();
  });

  it('renders empty state description', () => {
    render(<EmptyState {...defaultProps} />);
    expect(screen.getByText('Get started by adding your first development environment')).toBeInTheDocument();
  });

  it('renders add environment button', () => {
    render(<EmptyState {...defaultProps} />);
    expect(screen.getByText('Add Environment')).toBeInTheDocument();
  });

  it('calls onAddEnvironment when button is clicked', () => {
    render(<EmptyState {...defaultProps} />);
    const addButton = screen.getByText('Add Environment');
    fireEvent.click(addButton);
    expect(mockOnAddEnvironment).toHaveBeenCalledTimes(1);
  });

  it('renders feature cards', () => {
    render(<EmptyState {...defaultProps} />);
    expect(screen.getByText('Version Management')).toBeInTheDocument();
    expect(screen.getByText('Multiple Languages')).toBeInTheDocument();
    expect(screen.getByText('Auto Detection')).toBeInTheDocument();
  });

  it('renders feature descriptions', () => {
    render(<EmptyState {...defaultProps} />);
    expect(screen.getByText('Install and switch between versions easily')).toBeInTheDocument();
    expect(screen.getByText('Support for Node.js, Python, Go, Rust & more')).toBeInTheDocument();
    expect(screen.getByText('Automatically detect project versions')).toBeInTheDocument();
  });

  it('renders illustration icons', () => {
    render(<EmptyState {...defaultProps} />);
    // Check that the main illustration container exists
    const card = screen.getByText('No Environments Configured').closest('.border-dashed');
    expect(card).toBeInTheDocument();
  });

  it('has correct structure with card component', () => {
    const { container } = render(<EmptyState {...defaultProps} />);
    // Check for dashed border card
    expect(container.querySelector('.border-dashed')).toBeInTheDocument();
  });

  it('renders three feature cards', () => {
    render(<EmptyState {...defaultProps} />);
    const featureTitles = [
      screen.getByText('Version Management'),
      screen.getByText('Multiple Languages'),
      screen.getByText('Auto Detection'),
    ];
    expect(featureTitles).toHaveLength(3);
  });
});
