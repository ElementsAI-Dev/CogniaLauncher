import { render, screen } from '@testing-library/react';
import { ToolMobileCategoryNav } from './tool-mobile-category-nav';

jest.mock('@/components/providers/locale-provider', () => ({
  useLocale: () => ({ t: (key: string) => key }),
}));

jest.mock('@/components/ui/sheet', () => ({
  Sheet: ({ children }: { children: React.ReactNode }) => <div data-testid="sheet-root">{children}</div>,
  SheetTrigger: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  SheetContent: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div data-testid="sheet-content" className={className}>{children}</div>
  ),
  SheetHeader: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div className={className}>{children}</div>
  ),
  SheetTitle: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <h2 className={className}>{children}</h2>
  ),
}));

jest.mock('@/components/toolbox/tool-category-nav', () => ({
  ToolCategoryNavContent: () => <div data-testid="tool-category-nav-content" />,
}));

describe('ToolMobileCategoryNav', () => {
  const defaultProps = {
    selectedCategory: 'all' as const,
    onSelectCategory: jest.fn(),
    categoryToolCounts: new Map<string, number>(),
    totalToolCount: 0,
    favoritesCount: 0,
    recentCount: 0,
    mostUsedCount: 0,
    dynamicCategories: [],
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('uses a single internal scroll area in the mobile category sheet', () => {
    render(<ToolMobileCategoryNav {...defaultProps} />);

    const sheetContent = screen.getByTestId('sheet-content');
    const scrollArea = screen.getByTestId('tool-mobile-category-scroll-area');

    expect(sheetContent.className).toContain('overflow-hidden');
    expect(sheetContent.className).toContain('min-h-0');
    expect(sheetContent.className).toContain('flex-col');

    expect(scrollArea.className).toContain('min-h-0');
    expect(scrollArea.className).toContain('flex-1');
    expect(scrollArea.className).toContain('overflow-y-auto');
  });
});
