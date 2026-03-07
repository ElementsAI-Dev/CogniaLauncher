import { getTerminalEditorLanguage } from '@/lib/constants/terminal';
import type { ShellType, TerminalEditorLanguage } from '@/types/tauri';

const KEYWORDS: Record<Exclude<TerminalEditorLanguage, 'plaintext'>, Set<string>> = {
  bash: new Set([
    'if',
    'then',
    'else',
    'elif',
    'fi',
    'for',
    'do',
    'done',
    'while',
    'in',
    'case',
    'esac',
    'function',
    'select',
    'until',
  ]),
  powershell: new Set([
    'if',
    'else',
    'elseif',
    'switch',
    'foreach',
    'for',
    'while',
    'function',
    'param',
    'return',
    'try',
    'catch',
    'finally',
  ]),
  dos: new Set([
    'if',
    'else',
    'for',
    'in',
    'do',
    'goto',
    'call',
    'shift',
    'setlocal',
    'endlocal',
  ]),
};

const BUILT_INS: Record<Exclude<TerminalEditorLanguage, 'plaintext'>, Set<string>> = {
  bash: new Set([
    'alias',
    'cd',
    'echo',
    'eval',
    'exec',
    'export',
    'printf',
    'pwd',
    'read',
    'set',
    'source',
    'test',
    'trap',
    'unset',
  ]),
  powershell: new Set([
    'get-childitem',
    'get-content',
    'get-item',
    'get-process',
    'set-content',
    'set-executionpolicy',
    'set-item',
    'test-path',
    'write-host',
    'write-output',
  ]),
  dos: new Set([
    'cd',
    'cls',
    'dir',
    'echo',
    'md',
    'mkdir',
    'rd',
    'rmdir',
    'set',
    'type',
  ]),
};

const LITERALS = new Set(['true', 'false', '$true', '$false', '$null', 'on', 'off']);

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function wrapToken(className: string, value: string): string {
  return `<span class="${className}">${escapeHtml(value)}</span>`;
}

function asEditorLanguage(shellOrLanguage: string): TerminalEditorLanguage {
  const normalized = shellOrLanguage.toLowerCase();
  if (
    normalized === 'bash'
    || normalized === 'powershell'
    || normalized === 'dos'
    || normalized === 'plaintext'
  ) {
    return normalized;
  }
  return getTerminalEditorLanguage(normalized as ShellType);
}

function classifyToken(token: string, language: Exclude<TerminalEditorLanguage, 'plaintext'>): string | null {
  const normalized = token.toLowerCase();
  if (KEYWORDS[language].has(normalized)) {
    return 'hljs-keyword';
  }
  if (BUILT_INS[language].has(normalized)) {
    return 'hljs-built_in';
  }
  if (LITERALS.has(normalized)) {
    return 'hljs-literal';
  }
  if (/^\d+(\.\d+)?$/.test(token)) {
    return 'hljs-number';
  }
  return null;
}

function findHashCommentStart(line: string): number {
  let quote: '"' | "'" | null = null;

  for (let index = 0; index < line.length; index += 1) {
    const current = line[index];
    const previous = index > 0 ? line[index - 1] : null;

    if (quote) {
      if (current === quote && previous !== '\\') {
        quote = null;
      }
      continue;
    }

    if (current === '"' || current === "'") {
      quote = current;
      continue;
    }

    if (current === '#') {
      return index;
    }
  }

  return -1;
}

function highlightVariable(
  source: string,
  index: number,
  language: Exclude<TerminalEditorLanguage, 'plaintext'>,
): { nextIndex: number; html: string } | null {
  if ((language === 'bash' || language === 'powershell') && source[index] === '$') {
    if (source[index + 1] === '{') {
      const closingIndex = source.indexOf('}', index + 2);
      if (closingIndex > index + 2) {
        return {
          nextIndex: closingIndex + 1,
          html: wrapToken('hljs-variable', source.slice(index, closingIndex + 1)),
        };
      }
    }

    let cursor = index + 1;
    while (cursor < source.length && /[\w:?-]/.test(source[cursor])) {
      cursor += 1;
    }

    if (cursor > index + 1) {
      return {
        nextIndex: cursor,
        html: wrapToken('hljs-variable', source.slice(index, cursor)),
      };
    }
  }

  if (language === 'dos' && source[index] === '%') {
    const closingIndex = source.indexOf('%', index + 1);
    if (closingIndex > index + 1) {
      return {
        nextIndex: closingIndex + 1,
        html: wrapToken('hljs-variable', source.slice(index, closingIndex + 1)),
      };
    }
  }

  return null;
}

function highlightString(source: string, index: number): { nextIndex: number; html: string } | null {
  const quote = source[index];
  if (quote !== '"' && quote !== "'") {
    return null;
  }

  let cursor = index + 1;
  while (cursor < source.length) {
    if (source[cursor] === quote && source[cursor - 1] !== '\\') {
      cursor += 1;
      break;
    }
    cursor += 1;
  }

  return {
    nextIndex: cursor,
    html: wrapToken('hljs-string', source.slice(index, cursor)),
  };
}

function highlightCodeSegment(
  segment: string,
  language: Exclude<TerminalEditorLanguage, 'plaintext'>,
): string {
  let output = '';
  let index = 0;

  while (index < segment.length) {
    const stringToken = highlightString(segment, index);
    if (stringToken) {
      output += stringToken.html;
      index = stringToken.nextIndex;
      continue;
    }

    const variableToken = highlightVariable(segment, index, language);
    if (variableToken) {
      output += variableToken.html;
      index = variableToken.nextIndex;
      continue;
    }

    const current = segment[index];
    if (/[\w.-]/.test(current)) {
      let cursor = index + 1;
      while (cursor < segment.length && /[\w.-]/.test(segment[cursor])) {
        cursor += 1;
      }

      const token = segment.slice(index, cursor);
      const className = classifyToken(token, language);
      output += className ? wrapToken(className, token) : escapeHtml(token);
      index = cursor;
      continue;
    }

    output += escapeHtml(current);
    index += 1;
  }

  return output;
}

function highlightLine(
  line: string,
  language: Exclude<TerminalEditorLanguage, 'plaintext'>,
): string {
  if (language === 'dos') {
    const trimmed = line.trimStart();
    if (/^rem\b/i.test(trimmed) || trimmed.startsWith('::')) {
      return wrapToken('hljs-comment', line);
    }
  }

  const commentStart =
    language === 'dos'
      ? -1
      : findHashCommentStart(line);

  if (commentStart >= 0) {
    return (
      highlightCodeSegment(line.slice(0, commentStart), language)
      + wrapToken('hljs-comment', line.slice(commentStart))
    );
  }

  return highlightCodeSegment(line, language);
}

/**
 * Highlight shell config content and return HTML string.
 * Falls back to plain escaped text if the shell is unsupported.
 */
export function highlightShellConfig(code: string, shell: string): string {
  const language = asEditorLanguage(shell);
  if (language === 'plaintext') {
    return escapeHtml(code);
  }

  return code
    .split('\n')
    .map((line) => highlightLine(line, language))
    .join('\n');
}
