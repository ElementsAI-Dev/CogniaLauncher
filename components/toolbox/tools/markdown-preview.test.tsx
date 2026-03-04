import { fireEvent, render, screen } from '@testing-library/react';
import MarkdownPreview from './markdown-preview';
import { TOOLBOX_LIMITS } from '@/lib/constants/toolbox-limits';

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

jest.mock('react-markdown', () => ({
  __esModule: true,
  default: ({ children }: { children: string }) => <div>{children}</div>,
}));

jest.mock('remark-gfm', () => ({
  __esModule: true,
  default: () => undefined,
}));

jest.mock('rehype-highlight', () => ({
  __esModule: true,
  default: () => undefined,
}));

describe('MarkdownPreview', () => {
  it('shows truncation message for oversized markdown input', () => {
    render(<MarkdownPreview />);
    fireEvent.change(screen.getByPlaceholderText('# Write markdown here...'), {
      target: { value: '# Title\n' + 'a'.repeat(TOOLBOX_LIMITS.markdownPreviewChars + 100) },
    });

    expect(screen.getByText('toolbox.tools.markdownPreview.previewTruncated')).toBeInTheDocument();
  });
});
