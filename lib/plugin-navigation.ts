export function isInternalNavigationPath(path: string): boolean {
  return path.startsWith('/') && !path.startsWith('//');
}
