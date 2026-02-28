import type {
  ToolDefinition,
  ToolDefinitionWithMeta,
  ToolCategory,
  ToolCategoryMeta,
} from '@/types/toolbox';

// ============================================================================
// defineTool Factory (inspired by IT-Tools)
// ============================================================================

const NEW_TOOL_THRESHOLD_DAYS = 30;

export function defineTool(tool: ToolDefinition): ToolDefinitionWithMeta {
  return Object.defineProperty({ ...tool }, 'isNew', {
    get() {
      if (!tool.createdAt) return false;
      return Date.now() - tool.createdAt.getTime() < NEW_TOOL_THRESHOLD_DAYS * 86_400_000;
    },
    enumerable: true,
  }) as ToolDefinitionWithMeta;
}

// ============================================================================
// Category Definitions (inspired by DevToys PredefinedCommonToolGroupNames)
// ============================================================================

export const TOOL_CATEGORIES: ToolCategoryMeta[] = [
  { id: 'converters', nameKey: 'toolbox.categories.converters', descriptionKey: 'toolbox.categories.convertersDesc', icon: 'ArrowLeftRight', color: 'bg-blue-500/10 text-blue-600 dark:text-blue-400' },
  { id: 'encoders', nameKey: 'toolbox.categories.encoders', descriptionKey: 'toolbox.categories.encodersDesc', icon: 'Lock', color: 'bg-purple-500/10 text-purple-600 dark:text-purple-400' },
  { id: 'formatters', nameKey: 'toolbox.categories.formatters', descriptionKey: 'toolbox.categories.formattersDesc', icon: 'Code', color: 'bg-green-500/10 text-green-600 dark:text-green-400' },
  { id: 'generators', nameKey: 'toolbox.categories.generators', descriptionKey: 'toolbox.categories.generatorsDesc', icon: 'Wand2', color: 'bg-orange-500/10 text-orange-600 dark:text-orange-400' },
  { id: 'text', nameKey: 'toolbox.categories.text', descriptionKey: 'toolbox.categories.textDesc', icon: 'Type', color: 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400' },
  { id: 'network', nameKey: 'toolbox.categories.network', descriptionKey: 'toolbox.categories.networkDesc', icon: 'Globe', color: 'bg-pink-500/10 text-pink-600 dark:text-pink-400' },
  { id: 'graphics', nameKey: 'toolbox.categories.graphics', descriptionKey: 'toolbox.categories.graphicsDesc', icon: 'Palette', color: 'bg-rose-500/10 text-rose-600 dark:text-rose-400' },
  { id: 'developer', nameKey: 'toolbox.categories.developer', descriptionKey: 'toolbox.categories.developerDesc', icon: 'Terminal', color: 'bg-amber-500/10 text-amber-600 dark:text-amber-400' },
  { id: 'system', nameKey: 'toolbox.categories.system', descriptionKey: 'toolbox.categories.systemDesc', icon: 'Monitor', color: 'bg-slate-500/10 text-slate-600 dark:text-slate-400' },
];

// ============================================================================
// Tool Registry (inspired by IT-Tools src/tools/index.ts)
// ============================================================================

export const TOOL_REGISTRY: ToolDefinitionWithMeta[] = [
  // --- Formatters ---
  defineTool({
    id: 'json-formatter',
    nameKey: 'toolbox.tools.jsonFormatter.name',
    descriptionKey: 'toolbox.tools.jsonFormatter.desc',
    icon: 'Braces',
    category: 'formatters',
    keywords: ['json', 'format', 'beautify', 'minify', 'pretty', 'indent', 'validate'],
    component: () => import('@/components/toolbox/tools/json-formatter'),
    createdAt: new Date('2026-02-28'),
  }),

  // --- Encoders ---
  defineTool({
    id: 'base64-converter',
    nameKey: 'toolbox.tools.base64Converter.name',
    descriptionKey: 'toolbox.tools.base64Converter.desc',
    icon: 'FileCode',
    category: 'encoders',
    keywords: ['base64', 'encode', 'decode', 'binary', 'text'],
    component: () => import('@/components/toolbox/tools/base64-converter'),
    createdAt: new Date('2026-02-28'),
  }),
  defineTool({
    id: 'url-encoder',
    nameKey: 'toolbox.tools.urlEncoder.name',
    descriptionKey: 'toolbox.tools.urlEncoder.desc',
    icon: 'Link',
    category: 'encoders',
    keywords: ['url', 'encode', 'decode', 'uri', 'percent', 'query', 'parameter'],
    component: () => import('@/components/toolbox/tools/url-encoder'),
    createdAt: new Date('2026-02-28'),
  }),
  defineTool({
    id: 'jwt-decoder',
    nameKey: 'toolbox.tools.jwtDecoder.name',
    descriptionKey: 'toolbox.tools.jwtDecoder.desc',
    icon: 'KeyRound',
    category: 'encoders',
    keywords: ['jwt', 'json', 'web', 'token', 'decode', 'header', 'payload', 'claim'],
    component: () => import('@/components/toolbox/tools/jwt-decoder'),
    createdAt: new Date('2026-02-28'),
  }),
  defineTool({
    id: 'html-entity-converter',
    nameKey: 'toolbox.tools.htmlEntityConverter.name',
    descriptionKey: 'toolbox.tools.htmlEntityConverter.desc',
    icon: 'Code2',
    category: 'encoders',
    keywords: ['html', 'entity', 'encode', 'decode', 'escape', 'unescape', 'amp', 'lt', 'gt'],
    component: () => import('@/components/toolbox/tools/html-entity-converter'),
    createdAt: new Date('2026-02-28'),
  }),

  // --- Generators ---
  defineTool({
    id: 'uuid-generator',
    nameKey: 'toolbox.tools.uuidGenerator.name',
    descriptionKey: 'toolbox.tools.uuidGenerator.desc',
    icon: 'Fingerprint',
    category: 'generators',
    keywords: ['uuid', 'guid', 'random', 'unique', 'id', 'generate', 'v4'],
    component: () => import('@/components/toolbox/tools/uuid-generator'),
    createdAt: new Date('2026-02-28'),
  }),
  defineTool({
    id: 'hash-generator',
    nameKey: 'toolbox.tools.hashGenerator.name',
    descriptionKey: 'toolbox.tools.hashGenerator.desc',
    icon: 'Hash',
    category: 'generators',
    keywords: ['hash', 'md5', 'sha', 'sha256', 'sha512', 'digest', 'checksum'],
    component: () => import('@/components/toolbox/tools/hash-generator'),
    createdAt: new Date('2026-02-28'),
  }),
  defineTool({
    id: 'password-generator',
    nameKey: 'toolbox.tools.passwordGenerator.name',
    descriptionKey: 'toolbox.tools.passwordGenerator.desc',
    icon: 'Shield',
    category: 'generators',
    keywords: ['password', 'generate', 'random', 'secure', 'strong', 'passphrase'],
    component: () => import('@/components/toolbox/tools/password-generator'),
    createdAt: new Date('2026-02-28'),
  }),
  defineTool({
    id: 'lorem-generator',
    nameKey: 'toolbox.tools.loremGenerator.name',
    descriptionKey: 'toolbox.tools.loremGenerator.desc',
    icon: 'TextQuote',
    category: 'generators',
    keywords: ['lorem', 'ipsum', 'placeholder', 'text', 'dummy', 'paragraph'],
    component: () => import('@/components/toolbox/tools/lorem-generator'),
    createdAt: new Date('2026-02-28'),
  }),

  // --- Converters ---
  defineTool({
    id: 'number-base-converter',
    nameKey: 'toolbox.tools.numberBaseConverter.name',
    descriptionKey: 'toolbox.tools.numberBaseConverter.desc',
    icon: 'Binary',
    category: 'converters',
    keywords: ['binary', 'octal', 'decimal', 'hex', 'hexadecimal', 'base', 'convert', 'radix'],
    component: () => import('@/components/toolbox/tools/number-base-converter'),
    createdAt: new Date('2026-02-28'),
  }),

  // --- Text ---
  defineTool({
    id: 'regex-tester',
    nameKey: 'toolbox.tools.regexTester.name',
    descriptionKey: 'toolbox.tools.regexTester.desc',
    icon: 'Regex',
    category: 'text',
    keywords: ['regex', 'regular', 'expression', 'match', 'test', 'pattern', 'replace'],
    component: () => import('@/components/toolbox/tools/regex-tester'),
    createdAt: new Date('2026-02-28'),
  }),
  defineTool({
    id: 'text-diff',
    nameKey: 'toolbox.tools.textDiff.name',
    descriptionKey: 'toolbox.tools.textDiff.desc',
    icon: 'Diff',
    category: 'text',
    keywords: ['diff', 'compare', 'text', 'difference', 'merge', 'patch'],
    component: () => import('@/components/toolbox/tools/text-diff'),
    createdAt: new Date('2026-02-28'),
  }),
  defineTool({
    id: 'markdown-preview',
    nameKey: 'toolbox.tools.markdownPreview.name',
    descriptionKey: 'toolbox.tools.markdownPreview.desc',
    icon: 'FileText',
    category: 'text',
    keywords: ['markdown', 'md', 'preview', 'render', 'github', 'gfm'],
    component: () => import('@/components/toolbox/tools/markdown-preview'),
    createdAt: new Date('2026-02-28'),
  }),

  // --- Graphics ---
  defineTool({
    id: 'color-picker',
    nameKey: 'toolbox.tools.colorPicker.name',
    descriptionKey: 'toolbox.tools.colorPicker.desc',
    icon: 'Palette',
    category: 'graphics',
    keywords: ['color', 'colour', 'hex', 'rgb', 'hsl', 'pick', 'convert', 'palette'],
    component: () => import('@/components/toolbox/tools/color-picker'),
    createdAt: new Date('2026-02-28'),
  }),

  // --- Developer ---
  defineTool({
    id: 'timestamp-converter',
    nameKey: 'toolbox.tools.timestampConverter.name',
    descriptionKey: 'toolbox.tools.timestampConverter.desc',
    icon: 'Clock',
    category: 'developer',
    keywords: ['timestamp', 'unix', 'epoch', 'date', 'time', 'convert', 'iso', 'utc'],
    component: () => import('@/components/toolbox/tools/timestamp-converter'),
    createdAt: new Date('2026-02-28'),
  }),
  defineTool({
    id: 'cron-parser',
    nameKey: 'toolbox.tools.cronParser.name',
    descriptionKey: 'toolbox.tools.cronParser.desc',
    icon: 'Timer',
    category: 'developer',
    keywords: ['cron', 'schedule', 'expression', 'parse', 'job', 'task', 'interval'],
    component: () => import('@/components/toolbox/tools/cron-parser'),
    createdAt: new Date('2026-02-28'),
  }),
];

// ============================================================================
// Helpers
// ============================================================================

export function getToolById(id: string): ToolDefinitionWithMeta | undefined {
  return TOOL_REGISTRY.find((t) => t.id === id);
}

export function getToolsByCategory(): Map<ToolCategory, ToolDefinitionWithMeta[]> {
  const map = new Map<ToolCategory, ToolDefinitionWithMeta[]>();
  for (const tool of TOOL_REGISTRY) {
    const list = map.get(tool.category) ?? [];
    list.push(tool);
    map.set(tool.category, list);
  }
  return map;
}

export function getCategoryMeta(id: ToolCategory): ToolCategoryMeta | undefined {
  return TOOL_CATEGORIES.find((c) => c.id === id);
}
