import { render, screen } from '@testing-library/react';
import { ToolActionRow, ToolValidationMessage } from './tool-layout';

jest.mock('@/components/providers/locale-provider', () => ({
  useLocale: () => ({
    t: (key: string) => key,
  }),
}));

jest.mock('@/hooks/shared/use-clipboard', () => ({
  useCopyToClipboard: () => ({
    copied: false,
    copy: jest.fn(),
    paste: jest.fn().mockResolvedValue('pasted'),
  }),
}));

describe('tool-layout shared primitives', () => {
  it('renders action row children and right slot', () => {
    render(
      <ToolActionRow rightSlot={<span>right-slot</span>}>
        <button type="button">left-action</button>
      </ToolActionRow>,
    );

    expect(screen.getByText('left-action')).toBeInTheDocument();
    expect(screen.getByText('right-slot')).toBeInTheDocument();
  });

  it('renders validation error message', () => {
    render(<ToolValidationMessage message="error-message" />);
    expect(screen.getByText('error-message')).toBeInTheDocument();
  });

  it('renders validation info message', () => {
    render(<ToolValidationMessage message="info-message" tone="info" />);
    expect(screen.getByText('info-message')).toBeInTheDocument();
  });
});

