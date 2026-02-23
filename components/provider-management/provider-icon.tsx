"use client";

import Image from "next/image";
import { useTheme } from "next-themes";
import { cn } from "@/lib/utils";

/**
 * Mapping from provider ID to SVG filename.
 * Most providers map to their own ID; shared icons are mapped here.
 */
const PROVIDER_ICON_FILES: Record<string, string> = {
  npm: "npm",
  pnpm: "pnpm",
  yarn: "yarn",
  bun: "bun",
  deno: "deno",
  pip: "pip",
  uv: "uv",
  poetry: "poetry",
  conda: "conda",
  pipx: "pipx",
  cargo: "cargo",
  rustup: "rustup",
  composer: "composer",
  bundler: "bundler",
  gem: "gem",
  dotnet: "dotnet",
  docker: "docker",
  podman: "podman",
  github: "github",
  gitlab: "gitlab",
  chocolatey: "chocolatey",
  brew: "brew",
  apt: "apt",
  dnf: "dnf",
  pacman: "pacman",
  zypper: "zypper",
  apk: "apk",
  flatpak: "flatpak",
  snap: "snap",
  nvm: "nvm",
  fnm: "fnm",
  pyenv: "pyenv",
  goenv: "goenv",
  rbenv: "rbenv",
  phpbrew: "phpbrew",
  nix: "nix",
  conan: "conan",
  xmake: "xmake",
  "sdkman-kotlin": "sdkman-kotlin",
  sdkman: "sdkman",
  volta: "volta",
  psgallery: "psgallery",
  wsl: "wsl",
  asdf: "asdf",
  mise: "mise",
  macports: "macports",
  scoop: "scoop",
  winget: "winget",
  vcpkg: "vcpkg",
  go: "goenv",
  "system-node": "nvm",
  "system-python": "pyenv",
  "system-go": "goenv",
  "system-rust": "rustup",
  "system-ruby": "rbenv",
  "system-java": "sdkman",
  "system-kotlin": "sdkman-kotlin",
  "system-php": "phpbrew",
  "system-dotnet": "dotnet",
  "system-deno": "deno",
  "system-bun": "bun",
};

const PLATFORM_ICON_FILES: Record<string, string> = {
  windows: "windows",
  linux: "linux",
  macos: "macos",
  darwin: "darwin",
};

const LANGUAGE_ICON_FILES: Record<string, string> = {
  node: "node",
  python: "python",
  go: "go",
  rust: "rust",
  ruby: "ruby",
  java: "java",
  kotlin: "kotlin",
  php: "php",
  dotnet: "dotnet",
  deno: "deno",
  bun: "bun",
  c: "c",
  cpp: "cpp",
  swift: "swift",
  scala: "scala",
  groovy: "groovy",
  perl: "perl",
  r: "r",
  elixir: "elixir",
  erlang: "erlang",
  lua: "lua",
  zig: "zig",
  julia: "julia",
  dart: "dart",
  typescript: "typescript",
  haskell: "haskell",
  clojure: "clojure",
  crystal: "crystal",
  nim: "nim",
  ocaml: "ocaml",
  fortran: "fortran",
};

interface IconProps {
  size?: number;
  className?: string;
}

interface ProviderIconProps extends IconProps {
  providerId: string;
}

interface PlatformIconProps extends IconProps {
  platform: string;
}

interface LanguageIconProps extends IconProps {
  languageId: string;
}

function useIconTheme(): "light" | "dark" {
  const { resolvedTheme } = useTheme();
  return resolvedTheme === "dark" ? "dark" : "light";
}

function FallbackIcon({
  label,
  size = 24,
  className,
}: {
  label: string;
  size?: number;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center justify-center rounded bg-muted text-muted-foreground font-bold text-xs",
        className,
      )}
      style={{ width: size, height: size, fontSize: size * 0.45 }}
      aria-hidden="true"
    >
      {label.charAt(0).toUpperCase()}
    </span>
  );
}

export function ProviderIcon({
  providerId,
  size = 24,
  className,
}: ProviderIconProps) {
  const theme = useIconTheme();
  const file = PROVIDER_ICON_FILES[providerId];

  if (!file) {
    return <FallbackIcon label={providerId} size={size} className={className} />;
  }

  return (
    <Image
      src={`/icons/providers/${theme}/${file}.svg`}
      alt={providerId}
      width={size}
      height={size}
      className={cn("inline-block flex-shrink-0", className)}
      aria-hidden="true"
      unoptimized
    />
  );
}

export function PlatformIcon({
  platform,
  size = 20,
  className,
}: PlatformIconProps) {
  const theme = useIconTheme();
  const file = PLATFORM_ICON_FILES[platform.toLowerCase()];

  if (!file) {
    return <FallbackIcon label={platform} size={size} className={className} />;
  }

  return (
    <Image
      src={`/icons/platforms/${theme}/${file}.svg`}
      alt={platform}
      width={size}
      height={size}
      className={cn("inline-block flex-shrink-0", className)}
      aria-hidden="true"
      unoptimized
    />
  );
}

export function LanguageIcon({
  languageId,
  size = 24,
  className,
}: LanguageIconProps) {
  const theme = useIconTheme();
  const file = LANGUAGE_ICON_FILES[languageId];

  if (!file) {
    return (
      <FallbackIcon label={languageId} size={size} className={className} />
    );
  }

  return (
    <Image
      src={`/icons/languages/${theme}/${file}.svg`}
      alt={languageId}
      width={size}
      height={size}
      className={cn("inline-block flex-shrink-0", className)}
      aria-hidden="true"
      unoptimized
    />
  );
}

export function CacheProviderIcon({
  provider,
  size = 24,
  className,
}: {
  provider: string;
  size?: number;
  className?: string;
}) {
  const theme = useIconTheme();

  const CACHE_PROVIDER_MAP: Record<string, string> = {
    npm: "npm",
    pnpm: "pnpm",
    yarn: "yarn",
    pip: "pip",
    uv: "uv",
    cargo: "cargo",
    go: "goenv",
    bundler: "bundler",
    brew: "brew",
    dotnet: "dotnet",
    composer: "composer",
    poetry: "poetry",
    conda: "conda",
    deno: "deno",
    bun: "bun",
    gradle: "sdkman",
    maven: "sdkman",
    gem: "gem",
    rustup: "rustup",
    docker: "docker",
    vcpkg: "vcpkg",
    conan: "conan",
    xmake: "xmake",
    podman: "podman",
    flatpak: "flatpak",
    snap: "snap",
    chocolatey: "chocolatey",
    scoop: "scoop",
    winget: "winget",
    nix: "nix",
  };

  const file = CACHE_PROVIDER_MAP[provider];

  if (!file) {
    return <FallbackIcon label={provider} size={size} className={className} />;
  }

  return (
    <Image
      src={`/icons/providers/${theme}/${file}.svg`}
      alt={provider}
      width={size}
      height={size}
      className={cn("inline-block flex-shrink-0", className)}
      aria-hidden="true"
      unoptimized
    />
  );
}
