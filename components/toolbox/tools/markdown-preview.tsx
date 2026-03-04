'use client';

import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import { Button } from '@/components/ui/button';
import { ToolActionRow, ToolTextArea, ToolValidationMessage } from '@/components/toolbox/tool-layout';
import { useLocale } from '@/components/providers/locale-provider';
import { useToolPreferences } from '@/hooks/use-tool-preferences';
import { TOOLBOX_LIMITS } from '@/lib/constants/toolbox-limits';
import type { ToolComponentProps } from '@/types/toolbox';

const DEFAULT_MD = `# Hello Markdown

This is a **bold** and *italic* text.

## Code Block

\`\`\`javascript
function hello() {
  console.log("Hello, World!");
}
\`\`\`

## Table

| Feature | Status |
|---------|--------|
| GFM     | ✅     |
| Code    | ✅     |

## List

- Item 1
- Item 2
  - Nested item

> Blockquote text here
`;

const DEFAULT_PREFERENCES = {
  previewMode: 'split',
} as const;

export default function MarkdownPreview({ className }: ToolComponentProps) {
  const { t } = useLocale();
  const { preferences, setPreferences } = useToolPreferences('markdown-preview', DEFAULT_PREFERENCES);
  const [input, setInput] = useState(DEFAULT_MD);
  const truncated = input.length > TOOLBOX_LIMITS.markdownPreviewChars;
  const previewContent = truncated ? input.slice(0, TOOLBOX_LIMITS.markdownPreviewChars) : input;
  const previewMode = preferences.previewMode;

  return (
    <div className={className}>
      <div className="space-y-4">
        <ToolActionRow>
          <Button
            size="sm"
            variant={previewMode === 'split' ? 'default' : 'outline'}
            onClick={() => setPreferences({ previewMode: 'split' })}
          >
            {t('toolbox.tools.markdownPreview.modeSplit')}
          </Button>
          <Button
            size="sm"
            variant={previewMode === 'preview' ? 'default' : 'outline'}
            onClick={() => setPreferences({ previewMode: 'preview' })}
          >
            {t('toolbox.tools.markdownPreview.modePreview')}
          </Button>
        </ToolActionRow>

        {truncated && (
          <ToolValidationMessage
            tone="info"
            message={t('toolbox.tools.markdownPreview.previewTruncated', {
              limit: TOOLBOX_LIMITS.markdownPreviewChars.toLocaleString(),
            })}
          />
        )}

        <div className={previewMode === 'split' ? 'grid gap-4 md:grid-cols-2 h-[500px]' : 'space-y-4'}>
          {previewMode === 'split' && (
            <div className="flex flex-col">
              <ToolTextArea
                label={t('toolbox.tools.markdownPreview.editor')}
                value={input}
                onChange={setInput}
                placeholder="# Write markdown here..."
                showClear
                rows={20}
                className="flex-1"
              />
            </div>
          )}
          {previewMode === 'preview' && (
            <ToolTextArea
              label={t('toolbox.tools.markdownPreview.editor')}
              value={input}
              onChange={setInput}
              placeholder="# Write markdown here..."
              showClear
              rows={12}
            />
          )}
          <div className="flex flex-col">
            <span className="text-sm font-medium mb-2">{t('toolbox.tools.markdownPreview.preview')}</span>
            <div className="flex-1 rounded-md border p-4 overflow-auto prose prose-sm dark:prose-invert max-w-none">
              <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeHighlight]}>
                {previewContent}
              </ReactMarkdown>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
