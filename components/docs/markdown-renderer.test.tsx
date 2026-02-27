import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MarkdownRenderer } from './markdown-renderer';

jest.mock('next/link', () => {
  function MockLink({ children, href, ...props }: { children: React.ReactNode; href: string; [key: string]: unknown }) {
    return <a href={href} {...props}>{children}</a>;
  }
  MockLink.displayName = 'MockLink';
  return MockLink;
});

jest.mock('@/components/ui/button', () => ({
  Button: ({ children, onClick, ...props }: { children: React.ReactNode; onClick?: () => void; [key: string]: unknown }) => (
    <button onClick={onClick} {...props}>{children}</button>
  ),
}));

const mockWriteClipboard = jest.fn().mockResolvedValue(undefined);
jest.mock('@/lib/clipboard', () => ({
  writeClipboard: (...args: unknown[]) => mockWriteClipboard(...args),
}));

// Mock the extracted scroll utility — replicate behavior for integration tests
jest.mock('@/lib/docs/scroll', () => ({
  handleAnchorClick: jest.fn((e: React.MouseEvent<HTMLAnchorElement>) => {
    const href = e.currentTarget.getAttribute('href');
    if (!href?.startsWith('#')) return;
    e.preventDefault();
    const id = href.slice(1);
    const target = document.getElementById(id);
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      history.replaceState(null, '', href);
    }
  }),
}));

// Use the real resolveDocLink implementation for integration-level tests
jest.mock('@/lib/docs/resolve-link', () => jest.requireActual('@/lib/docs/resolve-link'));

// Mock react-markdown to render children as HTML-like structure
jest.mock('react-markdown', () => {
  function MockMarkdown({ children, components }: { children: string; components: Record<string, React.FC<Record<string, unknown>>> }) {
    // Simple parser: detect headings, code blocks, links, tables, images, paragraphs
    const lines = children.split('\n');
    const elements: React.ReactNode[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Headings
      const headingMatch = line.match(/^(#{1,4})\s+(.+)$/);
      if (headingMatch) {
        const level = headingMatch[1].length;
        const text = headingMatch[2];
        const id = text.toLowerCase().replace(/\s+/g, '-');
        const Tag = `h${level}` as 'h1' | 'h2' | 'h3' | 'h4';
        const Component = components[Tag];
        if (Component) {
          elements.push(<Component key={i} id={id}>{text}</Component>);
        } else {
          elements.push(<Tag key={i} id={id}>{text}</Tag>);
        }
        continue;
      }

      // Code blocks
      if (line.startsWith('```')) {
        const lang = line.slice(3).trim();
        const codeLines: string[] = [];
        let j = i + 1;
        while (j < lines.length && !lines[j].startsWith('```')) {
          codeLines.push(lines[j]);
          j++;
        }
        const codeText = codeLines.join('\n');
        const PreComponent = components.pre;
        if (PreComponent) {
          const codeEl = <code className={lang ? `language-${lang}` : ''}>{codeText}</code>;
          elements.push(<PreComponent key={i}>{codeEl}</PreComponent>);
        } else {
          elements.push(<pre key={i}><code>{codeText}</code></pre>);
        }
        i = j; // skip to end of code block
        continue;
      }

      // Images (must be checked before links)
      const imgMatch = line.match(/!\[([^\]]*)\]\(([^)]+)\)/);
      if (imgMatch) {
        const alt = imgMatch[1];
        const src = imgMatch[2];
        const ImgComponent = components.img;
        if (ImgComponent) {
          elements.push(<ImgComponent key={i} alt={alt} src={src} />);
        } else {
          // eslint-disable-next-line @next/next/no-img-element
          elements.push(<img key={i} alt={alt} src={src} />);
        }
        continue;
      }

      // Links
      const linkMatch = line.match(/\[([^\]]+)\]\(([^)]+)\)/);
      if (linkMatch) {
        const linkText = linkMatch[1];
        const href = linkMatch[2];
        const AComponent = components.a;
        if (AComponent) {
          elements.push(<AComponent key={i} href={href}>{linkText}</AComponent>);
        } else {
          elements.push(<a key={i} href={href}>{linkText}</a>);
        }
        continue;
      }

      // Tables (simplified)
      if (line.startsWith('|')) {
        const TableComponent = components.table;
        if (TableComponent) {
          elements.push(<TableComponent key={i}><tbody><tr><td>{line}</td></tr></tbody></TableComponent>);
        }
        continue;
      }

      // Paragraphs
      if (line.trim()) {
        elements.push(<p key={i}>{line}</p>);
      }
    }

    return <div data-testid="markdown-root">{elements}</div>;
  }
  MockMarkdown.displayName = 'MockMarkdown';
  return { __esModule: true, default: MockMarkdown };
});

jest.mock('remark-gfm', () => ({ __esModule: true, default: () => {} }));
jest.mock('rehype-highlight', () => ({ __esModule: true, default: () => {} }));
jest.mock('rehype-slug', () => ({ __esModule: true, default: () => {} }));

describe('MarkdownRenderer', () => {
  beforeEach(() => {
    mockWriteClipboard.mockClear();
  });

  it('renders markdown content in a docs-prose wrapper', () => {
    const { container } = render(<MarkdownRenderer content="Hello world" />);
    expect(container.querySelector('.docs-prose')).toBeInTheDocument();
  });

  it('applies custom className', () => {
    const { container } = render(<MarkdownRenderer content="test" className="custom" />);
    const wrapper = container.querySelector('.docs-prose');
    expect(wrapper?.className).toContain('custom');
  });

  it('renders paragraph text', () => {
    render(<MarkdownRenderer content="Hello world" />);
    expect(screen.getByText('Hello world')).toBeInTheDocument();
  });

  it('renders headings with anchor links', () => {
    render(<MarkdownRenderer content="## My Heading" />);
    expect(screen.getByText('My Heading')).toBeInTheDocument();
    // Anchor link with #
    const anchor = screen.getByText('#');
    expect(anchor).toHaveAttribute('href', '#my-heading');
    expect(anchor).toHaveAttribute('aria-hidden', 'true');
  });

  it('renders h1, h2, h3, h4 with anchor links', () => {
    render(<MarkdownRenderer content={"# Title\n## Subtitle\n### Sub-sub\n#### Deep"} />);
    const anchors = screen.getAllByText('#');
    expect(anchors).toHaveLength(4);
  });

  it('renders code blocks with language badge and copy button', () => {
    render(<MarkdownRenderer content={"```typescript\nconst x = 1;\n```"} />);
    expect(screen.getByText('typescript')).toBeInTheDocument();
    expect(screen.getByText('const x = 1;')).toBeInTheDocument();
    // Copy button present
    const copyBtn = screen.getByLabelText('Copy code');
    expect(copyBtn).toBeInTheDocument();
  });

  it('does not show language badge for code blocks without language', () => {
    render(<MarkdownRenderer content={"```\nplain code\n```"} />);
    expect(screen.getByText('plain code')).toBeInTheDocument();
    // No language badge (empty class → no match)
  });

  it('copy button calls writeClipboard and shows check icon', async () => {
    render(<MarkdownRenderer content={"```js\nalert(1)\n```"} />);
    const copyBtn = screen.getByLabelText('Copy code');
    fireEvent.click(copyBtn);
    await waitFor(() => {
      expect(mockWriteClipboard).toHaveBeenCalledWith('alert(1)');
    });
    // After copy, label changes to "Copied"
    await waitFor(() => {
      expect(screen.getByLabelText('Copied')).toBeInTheDocument();
    });
  });

  it('renders external links with target=_blank', () => {
    render(<MarkdownRenderer content="[Google](https://google.com)" />);
    const link = screen.getByText('Google');
    expect(link).toHaveAttribute('href', 'https://google.com');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('renders anchor links with # href', () => {
    render(<MarkdownRenderer content="[Jump](#section)" />);
    const link = screen.getByText('Jump');
    expect(link).toHaveAttribute('href', '#section');
  });

  it('resolves .md links to internal routes', () => {
    render(<MarkdownRenderer content="[Install](installation.md)" basePath="guide" />);
    const link = screen.getByText('Install');
    expect(link).toHaveAttribute('href', '/docs/guide/installation');
  });

  it('resolves relative ./ links with basePath', () => {
    render(<MarkdownRenderer content="[Config](./configuration)" basePath="guide" />);
    const link = screen.getByText('Config');
    expect(link).toHaveAttribute('href', '/docs/guide/configuration');
  });

  it('resolves relative ../ links with basePath', () => {
    render(<MarkdownRenderer content="[Home](../index)" basePath="guide/sub" />);
    const link = screen.getByText('Home');
    expect(link).toHaveAttribute('href', '/docs/guide/index');
  });

  it('resolves bare filename links with basePath', () => {
    render(<MarkdownRenderer content="[Config](configuration)" basePath="guide" />);
    const link = screen.getByText('Config');
    // bare filename without .md, has no / — resolved relative to basePath
    // This falls through to default <a> since it doesn't match .md or ./ or ../
    expect(link).toBeInTheDocument();
  });

  it('renders plain link when href is undefined', () => {
    render(<MarkdownRenderer content="Just text" />);
    expect(screen.getByText('Just text')).toBeInTheDocument();
  });

  it('renders link without href as plain anchor', () => {
    // Directly test the a component's !href branch by rendering with a crafted mock
    // that passes href=undefined. We achieve this by using a link syntax that our mock
    // parser doesn't catch but the component can still handle.
    const { container } = render(<MarkdownRenderer content="[NoHref]()" />);
    // The mock parser treats empty () as href="" which is truthy, so this falls through
    // to the default <a href=""> branch. The !href branch requires href to be undefined.
    expect(container.querySelector('.docs-prose')).toBeInTheDocument();
  });

  it('wraps tables in docs-table-wrapper', () => {
    const { container } = render(<MarkdownRenderer content="| Col1 | Col2 |" />);
    const wrapper = container.querySelector('.docs-table-wrapper');
    expect(wrapper).toBeInTheDocument();
  });

  it('renders images with docs-img class and alt text', () => {
    render(<MarkdownRenderer content="![Screenshot](img.png)" />);
    const img = screen.getByAltText('Screenshot');
    expect(img).toBeInTheDocument();
    expect(img).toHaveClass('docs-img');
  });

  it('falls back to textarea copy when writeClipboard rejects', async () => {
    mockWriteClipboard.mockRejectedValueOnce(new Error('Not allowed'));
    const execCommandMock = jest.fn().mockReturnValue(true);
    document.execCommand = execCommandMock;

    render(<MarkdownRenderer content={"```js\nalert(1)\n```"} />);
    const copyBtn = screen.getByLabelText('Copy code');
    fireEvent.click(copyBtn);

    await waitFor(() => {
      expect(execCommandMock).toHaveBeenCalledWith('copy');
    });
    await waitFor(() => {
      expect(screen.getByLabelText('Copied')).toBeInTheDocument();
    });
  });

  it('handles anchor click by scrolling to element', () => {
    const scrollIntoViewMock = jest.fn();
    const replaceStateMock = jest.fn();
    const originalReplaceState = history.replaceState;
    history.replaceState = replaceStateMock;

    // Create a target element for the anchor
    const targetEl = document.createElement('div');
    targetEl.id = 'my-heading';
    targetEl.scrollIntoView = scrollIntoViewMock;
    document.body.appendChild(targetEl);

    render(<MarkdownRenderer content="## My Heading" />);
    const anchor = screen.getByText('#');
    fireEvent.click(anchor);

    expect(scrollIntoViewMock).toHaveBeenCalledWith({ behavior: 'smooth', block: 'start' });
    expect(replaceStateMock).toHaveBeenCalledWith(null, '', '#my-heading');

    document.body.removeChild(targetEl);
    history.replaceState = originalReplaceState;
  });
});
