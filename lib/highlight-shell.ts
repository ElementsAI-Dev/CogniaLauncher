import hljs from 'highlight.js/lib/core';
import bash from 'highlight.js/lib/languages/bash';
import powershell from 'highlight.js/lib/languages/powershell';
import dos from 'highlight.js/lib/languages/dos';

hljs.registerLanguage('bash', bash);
hljs.registerLanguage('powershell', powershell);
hljs.registerLanguage('dos', dos);

const SHELL_LANGUAGE_MAP: Record<string, string> = {
  bash: 'bash',
  zsh: 'bash',
  fish: 'bash',
  nushell: 'bash',
  powershell: 'powershell',
  cmd: 'dos',
};

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Highlight shell config content and return HTML string.
 * Falls back to plain escaped text if highlighting fails.
 */
export function highlightShellConfig(code: string, shell: string): string {
  const language = SHELL_LANGUAGE_MAP[shell.toLowerCase()] ?? 'bash';
  try {
    return hljs.highlight(code, { language }).value;
  } catch {
    return escapeHtml(code);
  }
}
