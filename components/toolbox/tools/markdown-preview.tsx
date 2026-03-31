'use client';

import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import { Button } from '@/components/ui/button';
import {
  ToolActionRow,
  ToolTextArea,
  ToolValidationMessage,
  ToolSection,
} from '@/components/toolbox/tool-layout';
import { useLocale } from '@/components/providers/locale-provider';
import { useCopyToClipboard } from '@/hooks/shared/use-clipboard';
import { useToolPreferences } from '@/hooks/toolbox/use-tool-preferences';
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
  const { copied, copy, error: clipboardError } = useCopyToClipboard();
  const truncated = input.length > TOOLBOX_LIMITS.markdownPreviewChars;
  const previewContent = truncated ? input.slice(0, TOOLBOX_LIMITS.markdownPreviewChars) : input;
  const previewMode = preferences.previewMode;

  const wordCount = input.trim() ? input.trim().split(/\s+/).length : 0;
  const charCount = input.length;

  const appendAtEnd = (snippet: string) => {
    setInput((prev) => `${prev}${prev.endsWith('\n') ? '' : '\n'}${snippet}`);
  };

  const exportHtml = () => {
    const html = `<article>\n${previewContent}\n</article>`;
    void copy(html);
  };

  return (
    <div className={className}>
      <div className="space-y-4">
        <ToolSection title={t('toolbox.tools.markdownPreview.name')} description={t('toolbox.tools.markdownPreview.desc')}>
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
            <Button size="sm" variant="outline" onClick={() => appendAtEnd('**bold**')}>
              **B**
            </Button>
            <Button size="sm" variant="outline" onClick={() => appendAtEnd('*italic*')}>
              *I*
            </Button>
            <Button size="sm" variant="outline" onClick={() => appendAtEnd('## Heading')}>
              H2
            </Button>
            <Button size="sm" variant="outline" onClick={() => appendAtEnd('- item')}>
              List
            </Button>
            <Button size="sm" variant="outline" onClick={() => appendAtEnd('[link](https://example.com)')}>
              Link
            </Button>
            <Button size="sm" variant="outline" onClick={exportHtml}>
              {copied ? t('toolbox.actions.copied') : t('toolbox.tools.markdownPreview.exportHtml')}
            </Button>
          </ToolActionRow>

          <p className="mt-2 text-xs text-muted-foreground">
            {t('toolbox.tools.markdownPreview.stats', {
              words: wordCount,
              chars: charCount,
            })}
          </p>
        </ToolSection>

        {truncated && (
          <ToolValidationMessage
            tone="info"
            message={t('toolbox.tools.markdownPreview.previewTruncated', {
              limit: TOOLBOX_LIMITS.markdownPreviewChars.toLocaleString(),
            })}
          />
        )}

        <div className={previewMode === 'split' ? 'grid gap-4 md:grid-cols-2 min-h-130' : 'space-y-4'}>
          {previewMode === 'split' && (
            <ToolSection title={t('toolbox.tools.markdownPreview.editor')} className="h-full">
              <ToolTextArea
                label={t('toolbox.tools.markdownPreview.editor')}
                value={input}
                onChange={setInput}
                placeholder={t('toolbox.tools.markdownPreview.editorPlaceholder')}
                showClear
                rows={20}
                className="h-full"
                maxLength={TOOLBOX_LIMITS.markdownPreviewChars}
              />
            </ToolSection>
          )}
          {previewMode === 'preview' && (
            <ToolSection title={t('toolbox.tools.markdownPreview.editor')}>
              <ToolTextArea
                label={t('toolbox.tools.markdownPreview.editor')}
                value={input}
                onChange={setInput}
                placeholder={t('toolbox.tools.markdownPreview.editorPlaceholder')}
                showClear
                rows={12}
                maxLength={TOOLBOX_LIMITS.markdownPreviewChars}
              />
            </ToolSection>
          )}

          <ToolSection title={t('toolbox.tools.markdownPreview.preview')}>
            <div className="rounded-md border p-4 overflow-auto min-h-105 prose prose-sm dark:prose-invert max-w-none">
              <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeHighlight]}>
                {previewContent}
              </ReactMarkdown>
            </div>
          </ToolSection>
        </div>
        {clipboardError && <ToolValidationMessage message={t('toolbox.actions.copyFailed')} />}
      </div>
    </div>
  );
}
