import { defineTool, getToolById, getToolsByCategory, getCategoryMeta, TOOL_REGISTRY, TOOL_CATEGORIES } from './toolbox';

describe('defineTool', () => {
  it('returns a tool with isNew computed property', () => {
    const tool = defineTool({
      id: 'test-tool',
      nameKey: 'test',
      descriptionKey: 'test desc',
      icon: 'Wrench',
      category: 'formatters',
      keywords: ['test'],
      component: () => Promise.resolve({} as never),
      createdAt: new Date(),
    });
    expect(tool.id).toBe('test-tool');
    expect(typeof tool.isNew).toBe('boolean');
    expect(tool.isNew).toBe(true); // just created
  });

  it('isNew returns false for old tools', () => {
    const tool = defineTool({
      id: 'old-tool',
      nameKey: 'old',
      descriptionKey: 'old desc',
      icon: 'Wrench',
      category: 'formatters',
      keywords: [],
      component: () => Promise.resolve({} as never),
      createdAt: new Date('2020-01-01'),
    });
    expect(tool.isNew).toBe(false);
  });

  it('isNew returns false when no createdAt', () => {
    const tool = defineTool({
      id: 'no-date',
      nameKey: 'no-date',
      descriptionKey: 'desc',
      icon: 'Wrench',
      category: 'formatters',
      keywords: [],
      component: () => Promise.resolve({} as never),
    });
    expect(tool.isNew).toBe(false);
  });
});

describe('TOOL_REGISTRY', () => {
  it('is a non-empty array', () => {
    expect(TOOL_REGISTRY.length).toBeGreaterThan(0);
  });

  it('has unique IDs', () => {
    const ids = TOOL_REGISTRY.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('each tool has required fields', () => {
    TOOL_REGISTRY.forEach((tool) => {
      expect(tool.id).toBeTruthy();
      expect(tool.nameKey).toBeTruthy();
      expect(tool.descriptionKey).toBeTruthy();
      expect(tool.icon).toBeTruthy();
      expect(tool.category).toBeTruthy();
      expect(tool.component).toBeDefined();
    });
  });
});

describe('TOOL_CATEGORIES', () => {
  it('is a non-empty array', () => {
    expect(TOOL_CATEGORIES.length).toBeGreaterThan(0);
  });

  it('has unique IDs', () => {
    const ids = TOOL_CATEGORIES.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('each category has required fields', () => {
    TOOL_CATEGORIES.forEach((cat) => {
      expect(cat.id).toBeTruthy();
      expect(cat.nameKey).toBeTruthy();
      expect(cat.descriptionKey).toBeTruthy();
      expect(cat.icon).toBeTruthy();
      expect(cat.color).toBeTruthy();
    });
  });
});

describe('getToolById', () => {
  it('finds existing tool', () => {
    const tool = getToolById('json-formatter');
    expect(tool).toBeDefined();
    expect(tool!.id).toBe('json-formatter');
  });

  it('returns undefined for non-existent tool', () => {
    expect(getToolById('nonexistent')).toBeUndefined();
  });
});

describe('getToolsByCategory', () => {
  it('returns a Map', () => {
    const map = getToolsByCategory();
    expect(map).toBeInstanceOf(Map);
    expect(map.size).toBeGreaterThan(0);
  });

  it('groups tools correctly', () => {
    const map = getToolsByCategory();
    map.forEach((tools) => {
      const categories = new Set(tools.map((t) => t.category));
      expect(categories.size).toBe(1);
    });
  });
});

describe('getCategoryMeta', () => {
  it('finds existing category', () => {
    const meta = getCategoryMeta('formatters');
    expect(meta).toBeDefined();
    expect(meta!.id).toBe('formatters');
  });

  it('returns undefined for non-existent category', () => {
    expect(getCategoryMeta('nonexistent' as never)).toBeUndefined();
  });
});
