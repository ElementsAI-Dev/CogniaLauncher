/**
 * Download provider/platform/language SVG icons from Simple Icons CDN.
 * Usage: node scripts/download-icons.mjs
 */

import { writeFileSync, mkdirSync } from "fs";
import { join } from "path";

const BASE_URL = "https://cdn.simpleicons.org";

// Provider ID → { slug, lightColor (brand hex), darkColor (for dark theme) }
// lightColor: null means use default brand color from Simple Icons
// darkColor: hex color for dark theme version
const PROVIDER_MAP = {
  npm: { slug: "npm", darkColor: "CB3837" },
  pnpm: { slug: "pnpm", darkColor: "F69220" },
  yarn: { slug: "yarn", darkColor: "2C8EBB" },
  bun: { slug: "bun", darkColor: "FBF0DF" },
  deno: { slug: "deno", darkColor: "FFFFFF" },
  pip: { slug: "pypi", darkColor: "3775A9" },
  uv: { slug: "uv", darkColor: "DE5FE9" },
  poetry: { slug: "poetry", darkColor: "60A5FA" },
  conda: { slug: "anaconda", darkColor: "44A833" },
  pipx: { slug: "pypi", darkColor: "3775A9" },
  cargo: { slug: "rust", darkColor: "F74C00" },
  rustup: { slug: "rust", darkColor: "F74C00" },
  composer: { slug: "composer", darkColor: "885630" },
  bundler: { slug: "ruby", darkColor: "CC342D" },
  gem: { slug: "rubygems", darkColor: "E9573F" },
  dotnet: { slug: "dotnet", darkColor: "512BD4" },
  docker: { slug: "docker", darkColor: "2496ED" },
  podman: { slug: "podman", darkColor: "892CA0" },
  github: { slug: "github", darkColor: "FFFFFF" },
  chocolatey: { slug: "chocolatey", darkColor: "80B5E3" },
  brew: { slug: "homebrew", darkColor: "FBB040" },
  apt: { slug: "debian", darkColor: "A81D33" },
  dnf: { slug: "fedora", darkColor: "51A2DA" },
  pacman: { slug: "archlinux", darkColor: "1793D1" },
  zypper: { slug: "opensuse", darkColor: "73BA25" },
  apk: { slug: "alpinelinux", darkColor: "0D597F" },
  flatpak: { slug: "flatpak", darkColor: "4A90D9" },
  snap: { slug: "snapcraft", darkColor: "82BEA0" },
  nvm: { slug: "nodedotjs", darkColor: "5FA04E" },
  fnm: { slug: "nodedotjs", darkColor: "5FA04E" },
  pyenv: { slug: "python", darkColor: "3776AB" },
  goenv: { slug: "go", darkColor: "00ADD8" },
  rbenv: { slug: "ruby", darkColor: "CC342D" },
  phpbrew: { slug: "php", darkColor: "777BB4" },
  nix: { slug: "nixos", darkColor: "5277C3" },
  conan: { slug: "conan", darkColor: "6699CB" },
  xmake: { slug: "xmake", darkColor: "22A079" },
  "sdkman-kotlin": { slug: "kotlin", darkColor: "7F52FF" },
  sdkman: { slug: "openjdk", darkColor: "FFFFFF" },
  volta: { slug: "volta", darkColor: "FFA940" },
  psgallery: { slug: "powershell", darkColor: "5391FE" },
  wsl: { slug: "linux", darkColor: "FCC624" },
  asdf: { slug: "asdf", darkColor: "4B0082" },
  mise: { slug: "mise", darkColor: "4B0082" },
  macports: { slug: "macports", darkColor: "FFFFFF" },
  scoop: { slug: "scoop", darkColor: "FFFFFF" },
  winget: { slug: "windows", darkColor: "0078D4" },
  vcpkg: { slug: "cplusplus", darkColor: "00599C" },
};

const PLATFORM_MAP = {
  windows: { slug: "windows", darkColor: "0078D4" },
  linux: { slug: "linux", darkColor: "FCC624" },
  macos: { slug: "apple", darkColor: "FFFFFF" },
  darwin: { slug: "apple", darkColor: "FFFFFF" },
};

const LANGUAGE_MAP = {
  node: { slug: "nodedotjs", darkColor: "5FA04E" },
  python: { slug: "python", darkColor: "3776AB" },
  go: { slug: "go", darkColor: "00ADD8" },
  rust: { slug: "rust", darkColor: "F74C00" },
  ruby: { slug: "ruby", darkColor: "CC342D" },
  java: { slug: "openjdk", darkColor: "FFFFFF" },
  kotlin: { slug: "kotlin", darkColor: "7F52FF" },
  php: { slug: "php", darkColor: "777BB4" },
  dotnet: { slug: "dotnet", darkColor: "512BD4" },
  deno: { slug: "deno", darkColor: "FFFFFF" },
  bun: { slug: "bun", darkColor: "FBF0DF" },
};

// Custom SVGs for providers not in Simple Icons
const CUSTOM_SVGS = {
  scoop: {
    light: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#4682B4"><path d="M12 2C8.13 2 5 5.13 5 9c0 1.66.58 3.18 1.54 4.38L12 22l5.46-8.62C18.42 12.18 19 10.66 19 9c0-3.87-3.13-7-7-7zm0 2c2.76 0 5 2.24 5 5 0 1.12-.37 2.16-1 3H8c-.63-.84-1-1.88-1-3 0-2.76 2.24-5 5-5zm-3 10h6l-3 4.74L9 14z"/></svg>`,
    dark: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#87CEEB"><path d="M12 2C8.13 2 5 5.13 5 9c0 1.66.58 3.18 1.54 4.38L12 22l5.46-8.62C18.42 12.18 19 10.66 19 9c0-3.87-3.13-7-7-7zm0 2c2.76 0 5 2.24 5 5 0 1.12-.37 2.16-1 3H8c-.63-.84-1-1.88-1-3 0-2.76 2.24-5 5-5zm-3 10h6l-3 4.74L9 14z"/></svg>`,
  },
  macports: {
    light: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#1E3A5F"><path d="M12 2L4 6v4c0 5.55 3.84 10.74 8 12 4.16-1.26 8-6.45 8-12V6l-8-4zm0 2.18L18 7.3v2.7c0 4.83-3.4 9.36-6 10.55V4.18z"/><circle cx="12" cy="10" r="3"/></svg>`,
    dark: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#FFFFFF"><path d="M12 2L4 6v4c0 5.55 3.84 10.74 8 12 4.16-1.26 8-6.45 8-12V6l-8-4zm0 2.18L18 7.3v2.7c0 4.83-3.4 9.36-6 10.55V4.18z"/><circle cx="12" cy="10" r="3"/></svg>`,
  },
};

async function fetchSvg(slug, color) {
  const url = color ? `${BASE_URL}/${slug}/${color}` : `${BASE_URL}/${slug}`;
  try {
    const res = await fetch(url, {
      headers: { Accept: "image/svg+xml" },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) {
      console.warn(`  ⚠ ${slug} (${color || "default"}): HTTP ${res.status}`);
      return null;
    }
    return await res.text();
  } catch (e) {
    console.warn(`  ⚠ ${slug} (${color || "default"}): ${e.message}`);
    return null;
  }
}

// Fallback SVG with a letter
function fallbackSvg(name, color) {
  const letter = name.charAt(0).toUpperCase();
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><rect width="24" height="24" rx="4" fill="${color}"/><text x="12" y="17" text-anchor="middle" font-size="14" font-family="Arial,sans-serif" font-weight="bold" fill="white">${letter}</text></svg>`;
}

async function downloadIcons(map, dirBase, label) {
  const lightDir = join(dirBase, "light");
  const darkDir = join(dirBase, "dark");
  mkdirSync(lightDir, { recursive: true });
  mkdirSync(darkDir, { recursive: true });

  const entries = Object.entries(map);
  console.log(`\n📦 Downloading ${entries.length} ${label} icons...`);

  // Track slugs already downloaded to avoid duplicate fetches
  const cache = {};

  for (const [id, { slug, darkColor }] of entries) {
    process.stdout.write(`  ${id} (${slug})... `);

    // Check for custom SVG first
    if (CUSTOM_SVGS[id]) {
      writeFileSync(join(lightDir, `${id}.svg`), CUSTOM_SVGS[id].light);
      writeFileSync(join(darkDir, `${id}.svg`), CUSTOM_SVGS[id].dark);
      console.log("✅ (custom)");
      continue;
    }

    // Light version (brand color)
    const lightCacheKey = `${slug}_light`;
    let lightSvg = cache[lightCacheKey];
    if (!lightSvg) {
      lightSvg = await fetchSvg(slug);
      if (lightSvg) cache[lightCacheKey] = lightSvg;
    }

    // Dark version (custom color)
    const darkCacheKey = `${slug}_${darkColor}`;
    let darkSvg = cache[darkCacheKey];
    if (!darkSvg) {
      darkSvg = await fetchSvg(slug, darkColor);
      if (darkSvg) cache[darkCacheKey] = darkSvg;
    }

    if (lightSvg) {
      writeFileSync(join(lightDir, `${id}.svg`), lightSvg);
    } else {
      const fb = fallbackSvg(id, "#6B7280");
      writeFileSync(join(lightDir, `${id}.svg`), fb);
    }

    if (darkSvg) {
      writeFileSync(join(darkDir, `${id}.svg`), darkSvg);
    } else {
      const fb = fallbackSvg(id, "#9CA3AF");
      writeFileSync(join(darkDir, `${id}.svg`), fb);
    }

    console.log(lightSvg && darkSvg ? "✅" : "⚠ (fallback used)");

    // Small delay to avoid rate limiting
    await new Promise((r) => setTimeout(r, 100));
  }
}

async function main() {
  const root = join(import.meta.dirname, "..", "public", "icons");

  await downloadIcons(PROVIDER_MAP, join(root, "providers"), "provider");
  await downloadIcons(PLATFORM_MAP, join(root, "platforms"), "platform");
  await downloadIcons(LANGUAGE_MAP, join(root, "languages"), "language");

  console.log("\n✅ All icons downloaded!");
}

main().catch(console.error);
