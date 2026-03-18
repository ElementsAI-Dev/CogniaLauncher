import { render, screen } from '@testing-library/react';
import DocsPage, { generateStaticParams } from './page';

const mockGetDocContentBilingual = jest.fn();
const mockGetDocPageDataBilingual = jest.fn();
const mockGetAllDocSlugs = jest.fn();
const mockGetDocBasePath = jest.fn();
const mockNotFound = jest.fn();

const mockBuildSearchIndex = jest.fn();

jest.mock('@/lib/docs/content', () => ({
  getDocContentBilingual: (...args: unknown[]) => mockGetDocContentBilingual(...args),
  getDocPageDataBilingual: (...args: unknown[]) => mockGetDocPageDataBilingual(...args),
  getAllDocSlugs: () => mockGetAllDocSlugs(),
  getDocBasePath: (...args: unknown[]) => mockGetDocBasePath(...args),
  buildSearchIndex: () => mockBuildSearchIndex(),
}));

jest.mock('next/navigation', () => ({
  notFound: () => {
    mockNotFound();
    throw new Error('NEXT_NOT_FOUND');
  },
}));

jest.mock('./docs-page-client', () => ({
  DocsPageClient: ({ docEn, docZh, slug, basePath, searchIndex }: {
    docEn: { content: string; sourcePath: string; lastModified: string | null } | null;
    docZh: { content: string; sourcePath: string; lastModified: string | null } | null;
    slug?: string[];
    basePath?: string;
    searchIndex?: unknown[];
  }) => (
    <div data-testid="docs-client">
      <span data-testid="content-en">{docEn?.content ?? ''}</span>
      <span data-testid="content-zh">{docZh?.content ?? ''}</span>
      <span data-testid="source-en">{docEn?.sourcePath ?? ''}</span>
      <span data-testid="source-zh">{docZh?.sourcePath ?? ''}</span>
      <span data-testid="slug">{JSON.stringify(slug)}</span>
      <span data-testid="basePath">{basePath ?? ''}</span>
      <span data-testid="search-index-count">{searchIndex?.length ?? 0}</span>
    </div>
  ),
}));

describe('DocsPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('generateStaticParams returns all doc slugs', () => {
    mockGetAllDocSlugs.mockReturnValue([['index'], ['architecture', 'frontend']]);
    const params = generateStaticParams();
    expect(params).toEqual([
      { slug: ['index'] },
      { slug: ['architecture', 'frontend'] },
    ]);
  });

  it('renders DocsPageClient for valid slug', async () => {
    mockGetDocPageDataBilingual.mockReturnValue({
      en: {
        locale: 'en',
        content: '# Hello World',
        sourcePath: 'docs/en/architecture/frontend.md',
        lastModified: '2026-01-15T12:00:00.000Z',
      },
      zh: {
        locale: 'zh',
        content: '# 你好世界',
        sourcePath: 'docs/zh/architecture/frontend.md',
        lastModified: '2026-01-16T12:00:00.000Z',
      },
    });
    mockGetDocBasePath.mockReturnValue('architecture');

    const el = await DocsPage({ params: Promise.resolve({ slug: ['architecture', 'frontend'] }) });
    render(el);

    expect(screen.getByTestId('content-en')).toHaveTextContent('# Hello World');
    expect(screen.getByTestId('content-zh')).toHaveTextContent('# 你好世界');
    expect(screen.getByTestId('source-en')).toHaveTextContent('docs/en/architecture/frontend.md');
    expect(screen.getByTestId('source-zh')).toHaveTextContent('docs/zh/architecture/frontend.md');
    expect(screen.getByTestId('basePath')).toHaveTextContent('architecture');
  });

  it('passes searchIndex to DocsPageClient', async () => {
    const mockIndex = [{ slug: 'test', headingsZh: [], headingsEn: [], excerptZh: '', excerptEn: '' }];
    mockGetDocPageDataBilingual.mockReturnValue({
      en: { locale: 'en', content: '# Test', sourcePath: 'docs/en/index.md', lastModified: '2026-01-15T12:00:00.000Z' },
      zh: { locale: 'zh', content: '# 测试', sourcePath: 'docs/zh/index.md', lastModified: '2026-01-15T12:00:00.000Z' },
    });
    mockGetDocBasePath.mockReturnValue(undefined);
    mockBuildSearchIndex.mockReturnValue(mockIndex);

    const el = await DocsPage({ params: Promise.resolve({ slug: [] }) });
    render(el);

    expect(screen.getByTestId('search-index-count')).toHaveTextContent('1');
  });

  it('calls notFound() when both languages are null', async () => {
    mockGetDocPageDataBilingual.mockReturnValue({ en: null, zh: null });

    await expect(
      DocsPage({ params: Promise.resolve({ slug: ['nonexistent'] }) })
    ).rejects.toThrow('NEXT_NOT_FOUND');
    expect(mockNotFound).toHaveBeenCalled();
  });
});
