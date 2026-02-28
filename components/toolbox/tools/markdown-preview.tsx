'use client';

import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import { ToolTextArea } from '@/components/toolbox/tool-layout';
import { useLocale } from '@/components/providers/locale-provider';
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

export default function MarkdownPreview({ className }: ToolComponentProps) {
  const { t } = useLocale();
  const [input, setInput] = useState(DEFAULT_MD);

  return (
    <div className={className}>
      <div className="grid gap-4 md:grid-cols-2 h-[500px]">
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
        <div className="flex flex-col">
          <span className="text-sm font-medium mb-2">{t('toolbox.tools.markdownPreview.preview')}</span>
          <div className="flex-1 rounded-md border p-4 overflow-auto prose prose-sm dark:prose-invert max-w-none">
            <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeHighlight]}>
              {input}
            </ReactMarkdown>
          </div>
        </div>
      </div>
    </div>
  );
}
