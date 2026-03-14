'use client';

import { useEffect, useId, useMemo, useState } from 'react';
import { useTheme } from 'next-themes';
import { AlertTriangle, LoaderCircle } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

interface MermaidDiagramProps {
  source: string;
}

type MermaidStatus = 'loading' | 'success' | 'error';

export function MermaidDiagram({ source }: MermaidDiagramProps) {
  const { resolvedTheme } = useTheme();
  const reactId = useId();
  const baseId = useMemo(
    () => `docs-mermaid-${reactId.replace(/[^a-zA-Z0-9_-]/g, '')}`,
    [reactId]
  );
  const [status, setStatus] = useState<MermaidStatus>('loading');
  const [svg, setSvg] = useState('');

  useEffect(() => {
    let cancelled = false;

    async function renderDiagram() {
      setStatus('loading');
      setSvg('');

      try {
        const mermaidModule = await import('mermaid');
        const mermaid = mermaidModule.default;
        const theme = resolvedTheme === 'dark' ? 'dark' : 'default';

        mermaid.initialize({
          startOnLoad: false,
          securityLevel: 'loose',
          suppressErrorRendering: true,
          theme,
        });

        const { svg: renderedSvg } = await mermaid.render(`${baseId}-${theme}`, source);
        if (cancelled) {
          return;
        }

        setSvg(renderedSvg);
        setStatus('success');
      } catch {
        if (cancelled) {
          return;
        }

        setStatus('error');
      }
    }

    void renderDiagram();

    return () => {
      cancelled = true;
    };
  }, [baseId, resolvedTheme, source]);

  return (
    <div className="docs-mermaid" data-testid="mermaid-diagram">
      {status === 'loading' ? (
        <div className="docs-mermaid-loading" role="status" aria-live="polite">
          <LoaderCircle className="h-4 w-4 animate-spin" />
          <span>Rendering diagram…</span>
        </div>
      ) : null}

      {status === 'success' ? (
        <div className="docs-mermaid-scroll">
          <div className="docs-mermaid-diagram" dangerouslySetInnerHTML={{ __html: svg }} />
        </div>
      ) : null}

      {status === 'error' ? (
        <>
          <Alert className="docs-mermaid-fallback mx-4 mt-4" variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Diagram unavailable</AlertTitle>
            <AlertDescription>
              This Mermaid diagram could not be rendered. The source is still available below.
            </AlertDescription>
          </Alert>
          <details className="docs-details docs-mermaid-source mx-4 mb-4" open>
            <summary className="docs-summary">Diagram source</summary>
            <pre>
              <code>{source}</code>
            </pre>
          </details>
        </>
      ) : null}
    </div>
  );
}
