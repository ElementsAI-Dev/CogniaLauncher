/**
 * Fix missing icons that Simple Icons CDN doesn't have.
 * Creates high-quality custom SVGs for: xmake, volta, psgallery, asdf, mise, winget, windows platform
 */

import { writeFileSync, mkdirSync } from "fs";
import { join } from "path";

const root = join(import.meta.dirname, "..", "public", "icons");

const CUSTOM_ICONS = {
  // Windows logo (4-pane window)
  windows: {
    light: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="#0078D4" d="M0 3.449L9.75 2.1v9.451H0m10.949-9.602L24 0v11.4H10.949M0 12.6h9.75v9.451L0 20.699M10.949 12.6H24V24l-12.9-1.801"/></svg>`,
    dark: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="#4CC2FF" d="M0 3.449L9.75 2.1v9.451H0m10.949-9.602L24 0v11.4H10.949M0 12.6h9.75v9.451L0 20.699M10.949 12.6H24V24l-12.9-1.801"/></svg>`,
  },
  // WinGet - Windows package icon
  winget: {
    light: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><rect width="24" height="24" rx="4" fill="#0078D4"/><path fill="white" d="M6 4h5v5H6zM13 4h5v5h-5zM6 11h5v5H6zM13 11h5v5h-5z" opacity="0.9"/><path fill="white" d="M8 17l4 3 4-3" stroke="white" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
    dark: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><rect width="24" height="24" rx="4" fill="#4CC2FF"/><path fill="white" d="M6 4h5v5H6zM13 4h5v5h-5zM6 11h5v5H6zM13 11h5v5h-5z" opacity="0.9"/><path fill="white" d="M8 17l4 3 4-3" stroke="white" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  },
  // PowerShell - PS icon
  psgallery: {
    light: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><rect width="24" height="24" rx="4" fill="#012456"/><path d="M5.5 7l6 5-6 5" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"/><line x1="13" y1="17" x2="19" y2="17" stroke="white" stroke-width="2" stroke-linecap="round"/></svg>`,
    dark: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><rect width="24" height="24" rx="4" fill="#5391FE"/><path d="M5.5 7l6 5-6 5" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"/><line x1="13" y1="17" x2="19" y2="17" stroke="white" stroke-width="2" stroke-linecap="round"/></svg>`,
  },
  // Volta - lightning bolt
  volta: {
    light: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="#FFA940" d="M13 2L4.5 14h5L7 22l11-13h-5.5z"/></svg>`,
    dark: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="#FFD080" d="M13 2L4.5 14h5L7 22l11-13h-5.5z"/></svg>`,
  },
  // Xmake - X with gear
  xmake: {
    light: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><rect width="24" height="24" rx="4" fill="#22A079"/><path d="M7 7l10 10M17 7L7 17" stroke="white" stroke-width="2.5" stroke-linecap="round"/></svg>`,
    dark: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><rect width="24" height="24" rx="4" fill="#34D399"/><path d="M7 7l10 10M17 7L7 17" stroke="white" stroke-width="2.5" stroke-linecap="round"/></svg>`,
  },
  // asdf - wrench/tool icon
  asdf: {
    light: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><rect width="24" height="24" rx="4" fill="#4B0082"/><text x="12" y="16.5" text-anchor="middle" font-size="10" font-family="monospace" font-weight="bold" fill="white">asdf</text></svg>`,
    dark: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><rect width="24" height="24" rx="4" fill="#9B59B6"/><text x="12" y="16.5" text-anchor="middle" font-size="10" font-family="monospace" font-weight="bold" fill="white">asdf</text></svg>`,
  },
  // mise - gear/cog
  mise: {
    light: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><rect width="24" height="24" rx="4" fill="#7C3AED"/><path d="M12 8a4 4 0 100 8 4 4 0 000-8z" fill="none" stroke="white" stroke-width="1.5"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.93 4.93l2.12 2.12M16.95 16.95l2.12 2.12M4.93 19.07l2.12-2.12M16.95 7.05l2.12-2.12" stroke="white" stroke-width="1.5" stroke-linecap="round"/></svg>`,
    dark: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><rect width="24" height="24" rx="4" fill="#A78BFA"/><path d="M12 8a4 4 0 100 8 4 4 0 000-8z" fill="none" stroke="white" stroke-width="1.5"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.93 4.93l2.12 2.12M16.95 16.95l2.12 2.12M4.93 19.07l2.12-2.12M16.95 7.05l2.12-2.12" stroke="white" stroke-width="1.5" stroke-linecap="round"/></svg>`,
  },
};

function save(category, id, theme, svg) {
  const dir = join(root, category, theme);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, `${id}.svg`), svg);
}

// Save provider icons
for (const [id, { light, dark }] of Object.entries(CUSTOM_ICONS)) {
  if (id === "windows") {
    // Platform icon
    save("platforms", "windows", "light", light);
    save("platforms", "windows", "dark", dark);
  } else {
    save("providers", id, "light", light);
    save("providers", id, "dark", dark);
  }
  console.log(`✅ ${id}`);
}

console.log("\n✅ All missing icons created!");
