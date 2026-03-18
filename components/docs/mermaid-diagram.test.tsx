import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { MermaidDiagram } from './mermaid-diagram';

let mockResolvedTheme: string | undefined = 'light';
jest.mock('next-themes', () => ({
  useTheme: () => ({ resolvedTheme: mockResolvedTheme }),
}));

const mockMermaidInitialize = jest.fn();
const mockMermaidRender = jest.fn();
jest.mock('mermaid', () => ({
  __esModule: true,
  default: {
    initialize: (...args: unknown[]) => mockMermaidInitialize(...args),
    render: (...args: unknown[]) => mockMermaidRender(...args),
  },
}));

jest.mock('@/components/ui/alert', () => ({
  Alert: ({ children, ...props }: { children: React.ReactNode; [key: string]: unknown }) => (
    <div data-testid="alert" {...props}>
      {children}
    </div>
  ),
  AlertTitle: ({ children }: { children: React.ReactNode }) => <h3>{children}</h3>,
  AlertDescription: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

describe('MermaidDiagram', () => {
  beforeEach(() => {
    mockResolvedTheme = 'light';
    mockMermaidInitialize.mockReset();
    mockMermaidRender.mockReset();
    mockMermaidRender.mockResolvedValue({ svg: '<svg data-testid="mermaid-svg"><text>diagram</text></svg>' });
  });

  it('shows a loading status while rendering', () => {
    // Keep render pending so loading state is observable.
    mockMermaidRender.mockImplementation(
      () => new Promise(() => undefined),
    );

    render(<MermaidDiagram source={'graph TD\nA-->B'} />);

    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.getByText('Rendering diagram…')).toBeInTheDocument();
  });

  it('renders SVG on success', async () => {
    const { container } = render(<MermaidDiagram source={'graph TD\nA-->B'} />);

    await waitFor(() => {
      expect(mockMermaidRender).toHaveBeenCalled();
    });

    expect(container.querySelector('svg')).toBeInTheDocument();
    expect(screen.queryByText('Diagram unavailable')).not.toBeInTheDocument();
  });

  it('shows a recoverable fallback on render failure', async () => {
    mockMermaidRender.mockRejectedValueOnce(new Error('broken diagram'));

    render(<MermaidDiagram source={'graph TD\nA-->B'} />);

    await waitFor(() => {
      expect(screen.getByText('Diagram unavailable')).toBeInTheDocument();
    });

    expect(screen.getByText('Diagram source')).toBeInTheDocument();
    const code = screen.getByText((_, node) => node?.tagName === 'CODE' && !!node.textContent?.includes('graph TD'));
    expect(code).toHaveTextContent('graph TD');
    expect(code).toHaveTextContent('A-->B');
  });

  it('re-renders when theme changes', async () => {
    const { rerender } = render(<MermaidDiagram source={'graph TD\nA-->B'} />);

    await waitFor(() => {
      expect(mockMermaidInitialize).toHaveBeenCalledWith(expect.objectContaining({ theme: 'default' }));
    });

    mockResolvedTheme = 'dark';
    rerender(<MermaidDiagram source={'graph TD\nA-->B'} />);

    await waitFor(() => {
      expect(mockMermaidInitialize).toHaveBeenCalledWith(expect.objectContaining({ theme: 'dark' }));
    });

    expect(mockMermaidRender).toHaveBeenCalled();
  });
});
