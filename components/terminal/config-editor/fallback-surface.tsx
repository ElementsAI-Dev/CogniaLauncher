'use client';

import { Textarea } from '@/components/ui/textarea';
import type { TerminalConfigEditorSurfaceProps } from './types';

export function TerminalConfigEditorFallback({
  value,
  onChange,
}: TerminalConfigEditorSurfaceProps) {
  return (
    <Textarea
      data-testid="terminal-config-editor-fallback"
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="min-h-[260px] font-mono text-xs"
      spellCheck={false}
    />
  );
}
