'use client';

import { useCallback, type ComponentPropsWithoutRef } from 'react';
import { writeClipboard } from '@/lib/clipboard';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import rehypeSlug from 'rehype-slug';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Check, Copy } from 'lucide-react';
import { useState } from 'react';
import { handleAnchorClick } from '@/lib/docs/scroll';
import { resolveDocLink } from '@/lib/docs/resolve-link';
import { parseCallout, getCalloutIcon } from '@/lib/docs/remark-callout';

interface MarkdownRendererProps {
  content: string;
  className?: string;
  basePath?: string;
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    try {
      await writeClipboard(text);
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

function createHeading(Tag: 'h1' | 'h2' | 'h3' | 'h4') {
  function HeadingComponent({ children, id, ...props }: ComponentPropsWithoutRef<typeof Tag>) {
    return (
      <Tag id={id} className="group/heading" {...props}>
        {children}
        {id && (
          <a href={`#${id}`} className="docs-heading-anchor" aria-hidden="true" onClick={handleAnchorClick}>
            #
          </a>
        )}
      </Tag>
    );
  }
  HeadingComponent.displayName = `Docs${Tag.toUpperCase()}`;
  return HeadingComponent;
}

const headingComponents = {
  h1: createHeading('h1'),
  h2: createHeading('h2'),
  h3: createHeading('h3'),
  h4: createHeading('h4'),
};

export function MarkdownRenderer({ content, className, basePath }: MarkdownRendererProps) {
  return (
    <div className={cn('docs-prose', className)}>
      <Markdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeHighlight, rehypeSlug]}
        components={{
          ...headingComponents,
          pre: ({ children, ...props }: ComponentPropsWithoutRef<'pre'>) => {
            let textContent = '';
            let language = '';
            if (
              children &&
              typeof children === 'object' &&
              'props' in (children as React.ReactElement)
            ) {
              const codeEl = children as React.ReactElement<{ children?: React.ReactNode; className?: string }>;
              if (typeof codeEl.props.children === 'string') {
                textContent = codeEl.props.children;
              }
              const cls = codeEl.props.className ?? '';
              const langMatch = cls.match(/(?:language-|hljs language-)([\w-]+)/);
              if (langMatch) {
                language = langMatch[1];
              }
            }
            return (
              <div className="group/code relative">
                {language && (
                  <span className="docs-code-lang">{language}</span>
                )}
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
            const link = resolveDocLink(href, basePath);
            switch (link.type) {
              case 'anchor':
                return (
                  <a href={link.resolved} onClick={handleAnchorClick} {...props}>
                    {children}
                  </a>
                );
              case 'internal':
                return (
                  <Link href={link.resolved} {...props}>
                    {children}
                  </Link>
                );
              case 'external':
                return (
                  <a href={link.resolved} target="_blank" rel="noopener noreferrer" {...props}>
                    {children}
                  </a>
                );
              default:
                return (
                  <a href={link.resolved} {...props}>
                    {children}
                  </a>
                );
            }
          },
          blockquote: ({ children, ...props }: ComponentPropsWithoutRef<'blockquote'>) => {
            // Detect GitHub-style callouts: > [!NOTE] ...
            const childArray = Array.isArray(children) ? children : [children];
            let calloutType: ReturnType<typeof parseCallout> = null;

            // Check first text content for callout marker
            for (const child of childArray) {
              if (child && typeof child === 'object' && 'props' in (child as React.ReactElement)) {
                const el = child as React.ReactElement<{ children?: React.ReactNode }>;
                const inner = el.props.children;
                if (typeof inner === 'string') {
                  calloutType = parseCallout(inner);
                  break;
                }
                if (Array.isArray(inner)) {
                  const first = inner[0];
                  if (typeof first === 'string') {
                    calloutType = parseCallout(first);
                    break;
                  }
                }
              }
            }

            if (calloutType) {
              return (
                <div className={`docs-callout docs-callout-${calloutType.type}`} role="note">
                  <div className="docs-callout-title">
                    <span className="docs-callout-icon">{getCalloutIcon(calloutType.type)}</span>
                    <span>{calloutType.type.charAt(0).toUpperCase() + calloutType.type.slice(1)}</span>
                  </div>
                  <div className="docs-callout-content">{children}</div>
                </div>
              );
            }

            return <blockquote {...props}>{children}</blockquote>;
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
