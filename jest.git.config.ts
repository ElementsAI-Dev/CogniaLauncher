import type { Config } from "jest";
import {
  baseJestConfig,
  createProjectJestConfig,
  createScopedCoverageReporters,
} from "./jest.shared.mts";

const gitConfig: Config = {
  ...baseJestConfig,
  collectCoverageFrom: [
    "components/git/git-submodules-card.tsx",
    "components/git/git-worktrees-card.tsx",
    "components/git/git-gitignore-card.tsx",
    "components/git/git-hooks-card.tsx",
    "components/git/git-lfs-card.tsx",
    "components/git/git-local-config-card.tsx",
    "components/git/git-repo-stats-card.tsx",
    "components/git/git-sparse-checkout-card.tsx",
    "components/git/git-remote-prune-card.tsx",
    "components/git/git-signature-verify-card.tsx",
    "components/git/git-interactive-rebase-card.tsx",
    "components/git/git-rebase-squash-card.tsx",
    "components/git/git-bisect-card.tsx",
    "components/git/git-archive-card.tsx",
    "components/git/git-patch-card.tsx",
    "lib/git/operation-orchestrator.ts",
  ],
  coverageDirectory: "coverage/git",
  coverageThreshold: {
    global: {
      branches: 90,
      functions: 90,
      lines: 90,
      statements: 90,
    },
  },
  reporters: createScopedCoverageReporters("git"),
};

export default createProjectJestConfig(gitConfig);
