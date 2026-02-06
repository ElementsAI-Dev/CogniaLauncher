/**
 * Provider category constants
 */

export const SYSTEM_PROVIDER_IDS = new Set([
  'apt', 'dnf', 'pacman', 'zypper', 'apk', 'brew', 'macports',
  'chocolatey', 'scoop', 'winget', 'flatpak', 'snap', 'wsl',
]);

export const PACKAGE_MANAGER_IDS = new Set([
  'npm', 'pnpm', 'yarn', 'pip', 'uv', 'cargo', 'vcpkg', 'docker', 'psgallery', 'github',
]);
