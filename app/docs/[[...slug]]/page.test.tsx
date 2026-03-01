import { render, screen } from '@testing-library/react';
import DocsPage, { generateStaticParams } from './page';

const mockGetDocContentBilingual = jest.fn();
const mockGetAllDocSlugs = jest.fn();
const mockGetDocBasePath = jest.fn();
const mockNotFound = jest.fn();

const mockBuildSearchIndex = jest.fn();

jest.mock('@/lib/docs/content', () => ({
  getDocContentBilingual: (...args: unknown[]) => mockGetDocContentBilingual(...args),
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
  DocsPageClient: ({ contentEn, contentZh, slug, basePath, searchIndex }: { contentEn: string | null; contentZh: string | null; slug?: string[]; basePath?: string; searchIndex?: unknown[] }) => (
    <div data-testid="docs-client">
      <span data-testid="content-en">{contentEn ?? ''}</span>
      <span data-testid="content-zh">{contentZh ?? ''}</span>
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
    mockGetDocContentBilingual.mockReturnValue({ en: '# Hello World', zh: '# 你好世界' });
    mockGetDocBasePath.mockReturnValue('architecture');

    const el = await DocsPage({ params: Promise.resolve({ slug: ['architecture', 'frontend'] }) });
    render(el);

    expect(screen.getByTestId('content-en')).toHaveTextContent('# Hello World');
    expect(screen.getByTestId('content-zh')).toHaveTextContent('# 你好世界');
    expect(screen.getByTestId('basePath')).toHaveTextContent('architecture');
  });

  it('passes searchIndex to DocsPageClient', async () => {
    const mockIndex = [{ slug: 'test', headingsZh: [], headingsEn: [], excerptZh: '', excerptEn: '' }];
    mockGetDocContentBilingual.mockReturnValue({ en: '# Test', zh: '# 测试' });
    mockGetDocBasePath.mockReturnValue(undefined);
    mockBuildSearchIndex.mockReturnValue(mockIndex);

    const el = await DocsPage({ params: Promise.resolve({ slug: [] }) });
    render(el);

    expect(screen.getByTestId('search-index-count')).toHaveTextContent('1');
  });

  it('calls notFound() when both languages are null', async () => {
    mockGetDocContentBilingual.mockReturnValue({ en: null, zh: null });

    await expect(
      DocsPage({ params: Promise.resolve({ slug: ['nonexistent'] }) })
    ).rejects.toThrow('NEXT_NOT_FOUND');
    expect(mockNotFound).toHaveBeenCalled();
  });
});
