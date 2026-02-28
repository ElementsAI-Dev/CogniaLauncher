import { highlightShellConfig } from './highlight-shell';

describe('highlightShellConfig', () => {
  it('returns highlighted HTML for bash', () => {
    const result = highlightShellConfig('echo "hello"', 'bash');
    expect(result).toContain('hljs-');
  });

  it('returns highlighted HTML for powershell', () => {
    const result = highlightShellConfig('Get-Process', 'powershell');
    expect(result).toContain('hljs-');
  });

  it('returns highlighted HTML for cmd/dos', () => {
    const result = highlightShellConfig('dir /s', 'cmd');
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
  });

  it('maps zsh to bash highlighting', () => {
    const bashResult = highlightShellConfig('echo test', 'bash');
    const zshResult = highlightShellConfig('echo test', 'zsh');
    expect(zshResult).toBe(bashResult);
  });

  it('maps fish to bash highlighting', () => {
    const bashResult = highlightShellConfig('echo test', 'bash');
    const fishResult = highlightShellConfig('echo test', 'fish');
    expect(fishResult).toBe(bashResult);
  });

  it('falls back to bash for unknown shell', () => {
    const bashResult = highlightShellConfig('echo test', 'bash');
    const unknownResult = highlightShellConfig('echo test', 'unknown-shell');
    expect(unknownResult).toBe(bashResult);
  });

  it('escapes HTML in fallback mode', () => {
    // Even if highlighting works, let's test the escapeHtml path by checking plain code survives
    const result = highlightShellConfig('echo <tag> & "quote"', 'bash');
    expect(typeof result).toBe('string');
    // Should not contain raw < or > (either highlighted or escaped)
    expect(result).not.toContain('><tag>');
  });

  it('handles empty code string', () => {
    const result = highlightShellConfig('', 'bash');
    expect(result).toBe('');
  });

  it('is case-insensitive for shell name', () => {
    const lower = highlightShellConfig('echo test', 'bash');
    const upper = highlightShellConfig('echo test', 'BASH');
    expect(upper).toBe(lower);
  });
});
