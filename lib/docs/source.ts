export const DOCS_GITHUB_REPO_URL = 'https://github.com/AstroAir/CogniaLauncher';
export const DOCS_GITHUB_DEFAULT_BRANCH = 'master';

export function getDocsEditUrl(sourcePath: string): string {
  return `${DOCS_GITHUB_REPO_URL}/edit/${DOCS_GITHUB_DEFAULT_BRANCH}/${sourcePath}`;
}
