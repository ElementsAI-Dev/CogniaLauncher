// Mock github-slugger (ESM-only package) with a CJS-compatible implementation
jest.mock('github-slugger', () => {
  const regex = /[^\p{L}\p{M}\p{N}\p{Pc} -]/gu;
  class GithubSlugger {
    occurrences = new Map<string, number>();
    slug(value: string) {
      const result = value.toLowerCase().replace(regex, '').replace(/ /g, '-');
      const count = this.occurrences.get(result) ?? 0;
      this.occurrences.set(result, count + 1);
      if (count > 0) return `${result}-${count}`;
      return result;
    }
    reset() {
      this.occurrences.clear();
    }
  }
  return { __esModule: true, default: GithubSlugger };
});

import { render, screen, fireEvent, act } from '@testing-library/react';
import { extractHeadings, DocsToc } from './docs-toc';

jest.mock('@/components/providers/locale-provider', () => ({
  useLocale: () => ({
    t: (key: string) => {
      const translations: Record<string, string> = {
        'docs.toc': 'Table of Contents',
      };
      return translations[key] || key;
    },
    locale: 'en',
  }),
}));

jest.mock('@/components/ui/scroll-area', () => ({
  ScrollArea: ({ children }: { children: React.ReactNode }) => <div data-testid="scroll-area">{children}</div>,
}));

jest.mock('@/components/ui/collapsible', () => ({
  Collapsible: ({ children, open, onOpenChange }: { children: React.ReactNode; open: boolean; onOpenChange: (v: boolean) => void }) => (
    <div data-testid="collapsible" data-open={open} onClick={() => onOpenChange(!open)}>{children}</div>
  ),
  CollapsibleTrigger: ({ children, ...props }: { children: React.ReactNode }) => (
    <button data-testid="collapsible-trigger" {...props}>{children}</button>
  ),
  CollapsibleContent: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="collapsible-content">{children}</div>
  ),
}));

// Mock IntersectionObserver
const mockObserve = jest.fn();
const mockDisconnect = jest.fn();
let observerCallback: (entries: Partial<IntersectionObserverEntry>[]) => void;

beforeEach(() => {
  mockObserve.mockClear();
  mockDisconnect.mockClear();

  global.IntersectionObserver = jest.fn((callback) => {
    observerCallback = callback as (entries: Partial<IntersectionObserverEntry>[]) => void;
    return {
      observe: mockObserve,
      unobserve: jest.fn(),
      disconnect: mockDisconnect,
      root: null,
      rootMargin: '',
      thresholds: [],
      takeRecords: () => [],
    };
  }) as unknown as typeof IntersectionObserver;
});

describe('extractHeadings', () => {
  it('extracts h2 and h3 headings', () => {
    const md = '## Hello\n### World\n#### Ignored';
    const result = extractHeadings(md);
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ id: 'hello', text: 'Hello', level: 2 });
    expect(result[1]).toEqual({ id: 'world', text: 'World', level: 3 });
  });

  it('strips bold markers', () => {
    const md = '## **Bold** heading';
    const result = extractHeadings(md);
    expect(result[0].text).toBe('Bold heading');
    expect(result[0].id).toBe('bold-heading');
  });

  it('strips inline code', () => {
    const md = '## `next.config.ts` 配置';
    const result = extractHeadings(md);
    expect(result[0].text).toBe('next.config.ts 配置');
  });

  it('strips markdown links', () => {
    const md = '## [安装指南](installation.md)';
    const result = extractHeadings(md);
    expect(result[0].text).toBe('安装指南');
  });

  it('handles CJK headings', () => {
    const md = '## 核心功能\n### 版本安装\n## Provider 系统';
    const result = extractHeadings(md);
    expect(result).toHaveLength(3);
    expect(result[0].id).toBe('核心功能');
    expect(result[1].id).toBe('版本安装');
    expect(result[2].id).toBe('provider-系统');
  });

  it('handles duplicate headings with github-slugger deduplication', () => {
    const md = '## 概览\n## 概览\n## 概览';
    const result = extractHeadings(md);
    expect(result).toHaveLength(3);
    expect(result[0].id).toBe('概览');
    expect(result[1].id).toBe('概览-1');
    expect(result[2].id).toBe('概览-2');
  });

  it('skips headings inside fenced code blocks', () => {
    const md = '## Real heading\n```\n## Fake heading\n```\n## Another real';
    const result = extractHeadings(md);
    expect(result).toHaveLength(2);
    expect(result[0].text).toBe('Real heading');
    expect(result[1].text).toBe('Another real');
  });

  it('skips headings inside code blocks with language', () => {
    const md = '## Before\n```typescript\n## Inside code\n```\n## After';
    const result = extractHeadings(md);
    expect(result).toHaveLength(2);
    expect(result[0].text).toBe('Before');
    expect(result[1].text).toBe('After');
  });

  it('handles special characters like CI/CD', () => {
    const md = '## CI/CD';
    const result = extractHeadings(md);
    expect(result[0].text).toBe('CI/CD');
    expect(result[0].id).toBe('cicd');
  });

  it('handles mixed English and Chinese', () => {
    const md = '## Zustand Stores\n### CSS 变量\n## React Hooks';
    const result = extractHeadings(md);
    expect(result[0].id).toBe('zustand-stores');
    expect(result[1].id).toBe('css-变量');
    expect(result[2].id).toBe('react-hooks');
  });

  it('returns empty array for content with no headings', () => {
    const md = 'Just a paragraph\n\nAnother paragraph';
    expect(extractHeadings(md)).toEqual([]);
  });

  it('ignores h1 headings', () => {
    const md = '# Title\n## Subtitle';
    const result = extractHeadings(md);
    expect(result).toHaveLength(1);
    expect(result[0].text).toBe('Subtitle');
  });

  it('resets slugger between calls (no cross-call dedup)', () => {
    const md = '## Test';
    const r1 = extractHeadings(md);
    const r2 = extractHeadings(md);
    expect(r1[0].id).toBe('test');
    expect(r2[0].id).toBe('test');
  });
});

describe('DocsToc', () => {
  const contentWithHeadings = '## Introduction\n### Getting Started\n## API Reference';
  const contentNoHeadings = 'Just a paragraph\n\nAnother paragraph';

  it('returns null when content has no headings', () => {
    const { container } = render(<DocsToc content={contentNoHeadings} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders desktop TOC with heading title', () => {
    render(<DocsToc content={contentWithHeadings} />);
    const tocTitles = screen.getAllByText('Table of Contents');
    expect(tocTitles.length).toBeGreaterThanOrEqual(1);
  });

  it('renders heading links for each extracted heading', () => {
    render(<DocsToc content={contentWithHeadings} />);
    expect(screen.getAllByText('Introduction')).toHaveLength(2); // desktop + mobile
    expect(screen.getAllByText('Getting Started')).toHaveLength(2);
    expect(screen.getAllByText('API Reference')).toHaveLength(2);
  });

  it('renders heading links with correct href', () => {
    render(<DocsToc content={contentWithHeadings} mode="desktop" />);
    const introLink = screen.getByText('Introduction').closest('a');
    expect(introLink).toHaveAttribute('href', '#introduction');
  });

  it('applies pl-3 class for h3 headings (indented)', () => {
    render(<DocsToc content={contentWithHeadings} mode="desktop" />);
    const gsLink = screen.getByText('Getting Started').closest('a');
    expect(gsLink?.className).toContain('pl-3');
  });

  it('does not apply pl-3 class for h2 headings', () => {
    render(<DocsToc content={contentWithHeadings} mode="desktop" />);
    const introLink = screen.getByText('Introduction').closest('a');
    expect(introLink?.className).not.toContain('pl-3');
  });

  it('renders only desktop TOC when mode=desktop', () => {
    const { container } = render(<DocsToc content={contentWithHeadings} mode="desktop" />);
    expect(container.querySelector('aside')).toBeInTheDocument();
    expect(container.querySelector('.xl\\:hidden')).not.toBeInTheDocument();
  });

  it('renders only mobile TOC when mode=mobile', () => {
    const { container } = render(<DocsToc content={contentWithHeadings} mode="mobile" />);
    expect(container.querySelector('aside')).not.toBeInTheDocument();
    expect(container.querySelector('.xl\\:hidden')).toBeInTheDocument();
  });

  it('renders both desktop and mobile when mode=both (default)', () => {
    const { container } = render(<DocsToc content={contentWithHeadings} />);
    expect(container.querySelector('aside')).toBeInTheDocument();
    expect(container.querySelector('.xl\\:hidden')).toBeInTheDocument();
  });

  it('renders mobile collapsible trigger', () => {
    render(<DocsToc content={contentWithHeadings} mode="mobile" />);
    const trigger = screen.getByTestId('collapsible-trigger');
    expect(trigger).toBeInTheDocument();
  });

  it('applies custom className to desktop aside', () => {
    const { container } = render(<DocsToc content={contentWithHeadings} mode="desktop" className="my-custom" />);
    const aside = container.querySelector('aside');
    expect(aside?.className).toContain('my-custom');
  });

  it('handles heading click with scrollIntoView', () => {
    const scrollMock = jest.fn();
    const replaceStateMock = jest.fn();
    const origReplace = history.replaceState;
    history.replaceState = replaceStateMock;

    const el = document.createElement('div');
    el.id = 'introduction';
    el.scrollIntoView = scrollMock;
    document.body.appendChild(el);

    render(<DocsToc content={contentWithHeadings} mode="desktop" />);
    const link = screen.getByText('Introduction').closest('a')!;
    fireEvent.click(link);

    expect(scrollMock).toHaveBeenCalledWith({ behavior: 'smooth', block: 'start' });
    expect(replaceStateMock).toHaveBeenCalledWith(null, '', '#introduction');

    document.body.removeChild(el);
    history.replaceState = origReplace;
  });

  it('sets activeId on heading click (active style applied)', () => {
    const el = document.createElement('div');
    el.id = 'introduction';
    el.scrollIntoView = jest.fn();
    document.body.appendChild(el);

    render(<DocsToc content={contentWithHeadings} mode="desktop" />);
    const link = screen.getByText('Introduction').closest('a')!;
    fireEvent.click(link);

    // After click, the link should have active class
    expect(link.className).toContain('text-primary');

    document.body.removeChild(el);
  });

  it('sets up IntersectionObserver for desktop mode', () => {
    // Create DOM elements for headings
    const ids = ['introduction', 'getting-started', 'api-reference'];
    const elements = ids.map((id) => {
      const el = document.createElement('div');
      el.id = id;
      document.body.appendChild(el);
      return el;
    });

    render(<DocsToc content={contentWithHeadings} mode="desktop" />);
    expect(mockObserve).toHaveBeenCalledTimes(3);

    elements.forEach((el) => document.body.removeChild(el));
  });

  it('does not set up IntersectionObserver for mobile mode', () => {
    render(<DocsToc content={contentWithHeadings} mode="mobile" />);
    expect(mockObserve).not.toHaveBeenCalled();
  });

  it('updates activeId when IntersectionObserver fires', () => {
    const el = document.createElement('div');
    el.id = 'api-reference';
    document.body.appendChild(el);

    render(<DocsToc content={contentWithHeadings} mode="desktop" />);

    // Simulate observer callback wrapped in act for state update
    act(() => {
      observerCallback([{ isIntersecting: true, target: el }]);
    });

    // The API Reference link should now be active
    const link = screen.getByText('API Reference').closest('a');
    expect(link?.className).toContain('text-primary');

    document.body.removeChild(el);
  });

  it('disconnects IntersectionObserver on unmount', () => {
    const { unmount } = render(<DocsToc content={contentWithHeadings} mode="desktop" />);
    unmount();
    expect(mockDisconnect).toHaveBeenCalled();
  });
});
