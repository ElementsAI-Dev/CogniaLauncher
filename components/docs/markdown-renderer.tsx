'use client';

import { useCallback, type ComponentPropsWithoutRef } from 'react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import rehypeSlug from 'rehype-slug';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Check, Copy } from 'lucide-react';
import { useState } from 'react';

interface MarkdownRendererProps {
  content: string;
  className?: string;
  basePath?: string;
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for non-secure contexts
      const textarea = document.createElement('textarea');
      textarea.value = text;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [text]);

  return (
    <Button
      variant="ghost"
      size="icon"
      className="absolute right-2 top-2 h-7 w-7 opacity-0 transition-opacity group-hover/code:opacity-100"
      onClick={handleCopy}
      aria-label={copied ? 'Copied' : 'Copy code'}
    >
      {copied ? (
        <Check className="h-3.5 w-3.5 text-green-500" />
      ) : (
        <Copy className="h-3.5 w-3.5" />
      )}
    </Button>
  );
}

export function MarkdownRenderer({ content, className, basePath }: MarkdownRendererProps) {
  return (
    <div className={cn('docs-prose', className)}>
      <Markdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeHighlight, rehypeSlug]}
        components={{
          h1: ({ children, id, ...props }: ComponentPropsWithoutRef<'h1'>) => (
            <h1 id={id} className="group/heading" {...props}>
              {children}
              {id && (
                <a href={`#${id}`} className="docs-heading-anchor" aria-hidden="true">
                  #
                </a>
              )}
            </h1>
          ),
          h2: ({ children, id, ...props }: ComponentPropsWithoutRef<'h2'>) => (
            <h2 id={id} className="group/heading" {...props}>
              {children}
              {id && (
                <a href={`#${id}`} className="docs-heading-anchor" aria-hidden="true">
                  #
                </a>
              )}
            </h2>
          ),
          h3: ({ children, id, ...props }: ComponentPropsWithoutRef<'h3'>) => (
            <h3 id={id} className="group/heading" {...props}>
              {children}
              {id && (
                <a href={`#${id}`} className="docs-heading-anchor" aria-hidden="true">
                  #
                </a>
              )}
            </h3>
          ),
          h4: ({ children, id, ...props }: ComponentPropsWithoutRef<'h4'>) => (
            <h4 id={id} className="group/heading" {...props}>
              {children}
              {id && (
                <a href={`#${id}`} className="docs-heading-anchor" aria-hidden="true">
                  #
                </a>
              )}
            </h4>
          ),
          pre: ({ children, ...props }: ComponentPropsWithoutRef<'pre'>) => {
            let textContent = '';
            if (
              children &&
              typeof children === 'object' &&
              'props' in (children as React.ReactElement)
            ) {
              const codeEl = children as React.ReactElement<{ children?: React.ReactNode }>;
              if (typeof codeEl.props.children === 'string') {
                textContent = codeEl.props.children;
              }
            }
            return (
              <div className="group/code relative">
                <pre {...props}>{children}</pre>
                {textContent && <CopyButton text={textContent} />}
              </div>
            );
          },
          table: ({ children, ...props }: ComponentPropsWithoutRef<'table'>) => (
            <div className="docs-table-wrapper">
              <table {...props}>{children}</table>
            </div>
          ),
          a: ({ href, children, ...props }: ComponentPropsWithoutRef<'a'>) => {
            if (!href) {
              return <a {...props}>{children}</a>;
            }
            if (href.startsWith('#')) {
              return (
                <a href={href} {...props}>
                  {children}
                </a>
              );
            }
            if (href.endsWith('.md') || href.startsWith('../') || href.startsWith('./')) {
              let resolved = href.replace(/\.md$/, '');
              if (resolved.startsWith('../')) {
                // Go up one directory from basePath, then append rest
                const parentDir = basePath?.split('/').slice(0, -1).join('/') ?? '';
                resolved = resolved.replace(/^\.\.\//, '');
                resolved = parentDir ? `${parentDir}/${resolved}` : resolved;
              } else if (resolved.startsWith('./')) {
                resolved = resolved.replace(/^\.\//, '');
                resolved = basePath ? `${basePath}/${resolved}` : resolved;
              } else if (!resolved.includes('/') && basePath) {
                // Bare filename like "configuration" — resolve relative to basePath
                resolved = `${basePath}/${resolved}`;
              }
              return (
                <Link href={`/docs/${resolved}`} {...props}>
                  {children}
                </Link>
              );
            }
            if (href.startsWith('http://') || href.startsWith('https://')) {
              return (
                <a href={href} target="_blank" rel="noopener noreferrer" {...props}>
                  {children}
                </a>
              );
            }
            return (
              <a href={href} {...props}>
                {children}
              </a>
            );
          },
          img: ({ alt, ...props }: ComponentPropsWithoutRef<'img'>) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img alt={alt || ''} className="docs-img" {...props} />
          ),
        }}
      >
        {content}
      </Markdown>
    </div>
  );
}
