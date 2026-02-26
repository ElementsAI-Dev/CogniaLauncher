import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { GitActivityHeatmap } from './git-activity-heatmap';

jest.mock('@/components/providers/locale-provider', () => ({
  useLocale: () => ({ t: (key: string) => key }),
}));

describe('GitActivityHeatmap', () => {
  const mockActivity = [
    { date: '2025-01-15', commitCount: 5 },
    { date: '2025-01-14', commitCount: 2 },
  ];
  const mockOnGetActivity = jest.fn().mockResolvedValue(mockActivity);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders activity title', () => {
    render(<GitActivityHeatmap onGetActivity={mockOnGetActivity} />);
    expect(screen.getByText('git.activity.title')).toBeInTheDocument();
  });

  it('shows hint before loading', () => {
    render(<GitActivityHeatmap onGetActivity={mockOnGetActivity} />);
    expect(screen.getByText('git.activity.hint')).toBeInTheDocument();
  });

  it('shows load button initially', () => {
    render(<GitActivityHeatmap onGetActivity={mockOnGetActivity} />);
    expect(screen.getByText('git.activity.load')).toBeInTheDocument();
  });

  it('calls onGetActivity when load button clicked', async () => {
    render(<GitActivityHeatmap onGetActivity={mockOnGetActivity} />);
    fireEvent.click(screen.getByText('git.activity.load'));
    await waitFor(() => {
      expect(mockOnGetActivity).toHaveBeenCalledWith(180);
    });
  });

  it('shows less/more labels after loading', async () => {
    render(<GitActivityHeatmap onGetActivity={mockOnGetActivity} />);
    fireEvent.click(screen.getByText('git.activity.load'));
    await waitFor(() => {
      expect(screen.getByText('git.activity.less')).toBeInTheDocument();
      expect(screen.getByText('git.activity.more')).toBeInTheDocument();
    });
  });

  it('hides load button after data is loaded', async () => {
    render(<GitActivityHeatmap onGetActivity={mockOnGetActivity} />);
    fireEvent.click(screen.getByText('git.activity.load'));
    await waitFor(() => {
      expect(screen.queryByText('git.activity.load')).not.toBeInTheDocument();
    });
  });
});
