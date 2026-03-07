export const TOOLBOX_LIMITS = {
  jsonChars: 500_000,
  converterChars: 300_000,
  numberBaseChars: 4_096,
  regexChars: 200_000,
  regexMatches: 200,
  diffCharsPerInput: 200_000,
  diffLines: 4_000,
  markdownPreviewChars: 120_000,
  cronExpressionChars: 256,
  cronPreviewCount: 20,
  generatorCount: 200,
} as const;
