import { render, screen } from '@testing-library/react';
import DocsPage, { generateMetadata, generateStaticParams } from './page';

const mockGetDocsRouteData = jest.fn();
const mockGetAllDocSlugs = jest.fn();
const mockExtractDocExcerpt = jest.fn();
const mockNotFound = jest.fn();

jest.mock('@/lib/docs/content', () => ({
  getDocsRouteData: (...args: unknown[]) => mockGetDocsRouteData(...args),
  getAllDocSlugs: () => mockGetAllDocSlugs(),
  extractDocExcerpt: (...args: unknown[]) => mockExtractDocExcerpt(...args),
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
    mockExtractDocExcerpt.mockImplementation((content: string) => content.split('\n').find((line) => line.trim() && !line.startsWith('#')) ?? '');
  });

  it('generateStaticParams returns all doc slugs', () => {
    mockGetAllDocSlugs.mockReturnValue([[], ['architecture', 'frontend']]);
    const params = generateStaticParams();
    expect(params).toEqual([
      { slug: [] },
      { slug: ['architecture', 'frontend'] },
    ]);
  });

  it('renders DocsPageClient for valid slug', async () => {
    mockGetDocsRouteData.mockReturnValue({
      docEn: {
        locale: 'en',
        content: '# Hello World',
        sourcePath: 'docs/en/architecture/frontend.md',
        lastModified: '2026-01-15T12:00:00.000Z',
      },
      docZh: {
        locale: 'zh',
        content: '# 你好世界',
        sourcePath: 'docs/zh/architecture/frontend.md',
        lastModified: '2026-01-16T12:00:00.000Z',
      },
      renderedDoc: {
        locale: 'en',
        content: '# Hello World',
        sourcePath: 'docs/en/architecture/frontend.md',
        lastModified: '2026-01-15T12:00:00.000Z',
      },
      basePath: 'architecture',
      searchIndex: [],
    });

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
    mockGetDocsRouteData.mockReturnValue({
      docEn: { locale: 'en', content: '# Test', sourcePath: 'docs/en/index.md', lastModified: '2026-01-15T12:00:00.000Z' },
      docZh: { locale: 'zh', content: '# 测试', sourcePath: 'docs/zh/index.md', lastModified: '2026-01-15T12:00:00.000Z' },
      renderedDoc: { locale: 'en', content: '# Test', sourcePath: 'docs/en/index.md', lastModified: '2026-01-15T12:00:00.000Z' },
      basePath: undefined,
      searchIndex: mockIndex,
    });

    const el = await DocsPage({ params: Promise.resolve({ slug: [] }) });
    render(el);

    expect(screen.getByTestId('search-index-count')).toHaveTextContent('1');
  });

  it('calls notFound() when both languages are null', async () => {
    mockGetDocsRouteData.mockReturnValue({
      docEn: null,
      docZh: null,
      renderedDoc: null,
      basePath: undefined,
      searchIndex: [],
    });

    await expect(
      DocsPage({ params: Promise.resolve({ slug: ['nonexistent'] }) })
    ).rejects.toThrow('NEXT_NOT_FOUND');
    expect(mockNotFound).toHaveBeenCalled();
  });

  it('generateMetadata returns title and description from the rendered doc', async () => {
    mockGetDocsRouteData.mockReturnValue({
      docEn: {
        locale: 'en',
        content: '# Frontend\n\nFrontend architecture details for the docs viewer.',
        sourcePath: 'docs/en/architecture/frontend.md',
        lastModified: '2026-01-15T12:00:00.000Z',
      },
      docZh: {
        locale: 'zh',
        content: '# 前端架构\n\n文档查看器的前端说明。',
        sourcePath: 'docs/zh/architecture/frontend.md',
        lastModified: '2026-01-16T12:00:00.000Z',
      },
      renderedDoc: {
        locale: 'en',
        content: '# Frontend\n\nFrontend architecture details for the docs viewer.',
        sourcePath: 'docs/en/architecture/frontend.md',
        lastModified: '2026-01-15T12:00:00.000Z',
      },
      basePath: 'architecture',
      searchIndex: [],
    });

    const metadata = await generateMetadata({ params: Promise.resolve({ slug: ['architecture', 'frontend'] }) });

    expect(metadata).toEqual(expect.objectContaining({
      title: 'Frontend | CogniaLauncher Docs',
      description: expect.stringContaining('Frontend architecture details'),
    }));
  });

  it('generateMetadata falls back to the rendered zh doc when en is missing', async () => {
    mockGetDocsRouteData.mockReturnValue({
      docEn: null,
      docZh: {
        locale: 'zh',
        content: '# 日志系统\n\n日志页面目前只有中文文档。',
        sourcePath: 'docs/zh/guide/logs.md',
        lastModified: '2026-01-16T12:00:00.000Z',
      },
      renderedDoc: {
        locale: 'zh',
        content: '# 日志系统\n\n日志页面目前只有中文文档。',
        sourcePath: 'docs/zh/guide/logs.md',
        lastModified: '2026-01-16T12:00:00.000Z',
      },
      basePath: 'guide',
      searchIndex: [],
    });

    const metadata = await generateMetadata({ params: Promise.resolve({ slug: ['guide', 'logs'] }) });

    expect(metadata).toEqual(expect.objectContaining({
      title: 'Logs | CogniaLauncher Docs',
      description: expect.stringContaining('日志页面目前只有中文文档'),
    }));
  });

  it('generateMetadata keeps the root docs title for the index page', async () => {
    mockGetDocsRouteData.mockReturnValue({
      docEn: {
        locale: 'en',
        content: '# Docs Home\n\nWelcome to the docs.',
        sourcePath: 'docs/en/index.md',
        lastModified: '2026-01-15T12:00:00.000Z',
      },
      docZh: {
        locale: 'zh',
        content: '# 文档首页\n\n欢迎来到文档。',
        sourcePath: 'docs/zh/index.md',
        lastModified: '2026-01-15T12:00:00.000Z',
      },
      renderedDoc: {
        locale: 'en',
        content: '# Docs Home\n\nWelcome to the docs.',
        sourcePath: 'docs/en/index.md',
        lastModified: '2026-01-15T12:00:00.000Z',
      },
      basePath: undefined,
      searchIndex: [],
    });

    const metadata = await generateMetadata({ params: Promise.resolve({ slug: [] }) });

    expect(metadata).toEqual(expect.objectContaining({
      title: 'CogniaLauncher Docs',
      description: expect.stringContaining('Welcome to the docs.'),
    }));
  });

  it('generateMetadata falls back to the generic docs description when no doc is resolved', async () => {
    mockGetDocsRouteData.mockReturnValue({
      docEn: null,
      docZh: null,
      renderedDoc: null,
      basePath: undefined,
      searchIndex: [],
    });

    const metadata = await generateMetadata({ params: Promise.resolve({ slug: ['missing'] }) });

    expect(metadata).toEqual(expect.objectContaining({
      title: 'CogniaLauncher Docs',
      description: 'Documentation for CogniaLauncher',
    }));
  });
});
