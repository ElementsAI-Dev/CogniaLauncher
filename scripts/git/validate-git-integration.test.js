let validator;

beforeAll(async () => {
  validator = await import('./validate-git-integration.mjs');
});

function buildMatrixRow(command, wrapper, hook) {
  return [
    '| Rust Command(s) | `lib/tauri.ts` Wrapper | Hook API | UI Entry |',
    '|---|---|---|---|',
    `| ${command} | ${wrapper} | ${hook} | \`GitCard\` |`,
  ].join('\n');
}

describe('git integration validator', () => {
  it('passes when backend, wrapper, hooks, and matrix are aligned', () => {
    const result = validator.validateGitIntegrationSources({
      commandSource: `
#[tauri::command]
pub async fn git_alpha() -> Result<String, String> { Ok(String::new()) }
#[tauri::command]
pub async fn git_beta() -> Result<String, String> { Ok(String::new()) }
      `,
      wrapperSource: `
export const gitAlpha = () => invoke<string>("git_alpha");
export const gitBeta = () => invoke<string>("git_beta");
      `,
      hookSources: [
        {
          interfaceName: 'UseGitReturn',
          content: `
export interface UseGitReturn {
  alpha: () => Promise<string>;
}
          `,
        },
        {
          interfaceName: 'UseGitAdvancedReturn',
          content: `
export interface UseGitAdvancedReturn {
  beta: () => Promise<string>;
}
          `,
        },
      ],
      matrixEnSource: buildMatrixRow(
        '`git_alpha`, `git_beta`',
        '`gitAlpha`, `gitBeta`',
        '`useGit.alpha`, `useGitAdvanced.beta`',
      ),
      matrixZhSource: buildMatrixRow(
        '`git_alpha`, `git_beta`',
        '`gitAlpha`, `gitBeta`',
        '`useGit.alpha`, `useGitAdvanced.beta`',
      ),
    });

    expect(result.errors).toEqual([]);
  });

  it('reports backend commands that have no wrapper mapping', () => {
    const result = validator.validateGitIntegrationSources({
      commandSource: `
#[tauri::command]
pub async fn git_alpha() -> Result<String, String> { Ok(String::new()) }
#[tauri::command]
pub async fn git_missing_wrapper() -> Result<String, String> { Ok(String::new()) }
      `,
      wrapperSource: `
export const gitAlpha = () => invoke<string>("git_alpha");
      `,
      hookSources: [
        {
          interfaceName: 'UseGitReturn',
          content: `
export interface UseGitReturn {
  alpha: () => Promise<string>;
}
          `,
        },
      ],
      matrixEnSource: buildMatrixRow('`git_alpha`', '`gitAlpha`', '`useGit.alpha`'),
      matrixZhSource: buildMatrixRow('`git_alpha`', '`gitAlpha`', '`useGit.alpha`'),
    });

    expect(result.errors).toEqual(
      expect.arrayContaining([
        expect.stringContaining(
          'Backend command `git_missing_wrapper` has no wrapper in lib/tauri.ts.',
        ),
      ]),
    );
  });

  it('reports stale matrix symbols for unknown wrappers and hooks', () => {
    const result = validator.validateGitIntegrationSources({
      commandSource: `
#[tauri::command]
pub async fn git_alpha() -> Result<String, String> { Ok(String::new()) }
      `,
      wrapperSource: `
export const gitAlpha = () => invoke<string>("git_alpha");
      `,
      hookSources: [
        {
          interfaceName: 'UseGitReturn',
          content: `
export interface UseGitReturn {
  alpha: () => Promise<string>;
}
          `,
        },
      ],
      matrixEnSource: buildMatrixRow(
        '`git_alpha`',
        '`gitAlpha`, `gitGhost`',
        '`useGit.alpha`, `useGit.ghostMethod`',
      ),
      matrixZhSource: buildMatrixRow(
        '`git_alpha`',
        '`gitAlpha`, `gitGhost`',
        '`useGit.alpha`, `useGit.ghostMethod`',
      ),
    });

    expect(result.errors).toEqual(
      expect.arrayContaining([
        expect.stringContaining('EN matrix references unknown wrapper symbol `gitGhost`'),
        expect.stringContaining(
          'EN matrix references unknown hook API symbol `ghostMethod`',
        ),
      ]),
    );
  });

  it('reports EN/ZH matrix parity drift', () => {
    const result = validator.validateGitIntegrationSources({
      commandSource: `
#[tauri::command]
pub async fn git_alpha() -> Result<String, String> { Ok(String::new()) }
      `,
      wrapperSource: `
export const gitAlpha = () => invoke<string>("git_alpha");
      `,
      hookSources: [
        {
          interfaceName: 'UseGitReturn',
          content: `
export interface UseGitReturn {
  alpha: () => Promise<string>;
}
          `,
        },
      ],
      matrixEnSource: buildMatrixRow('`git_alpha`', '`gitAlpha`', '`useGit.alpha`'),
      matrixZhSource: buildMatrixRow('`git_alpha`', '`gitAlpha`', ''),
    });

    expect(result.errors).toEqual(
      expect.arrayContaining([
        expect.stringContaining(
          'ZH matrix is missing hook API symbol `alpha` that exists in EN matrix.',
        ),
      ]),
    );
  });
});

