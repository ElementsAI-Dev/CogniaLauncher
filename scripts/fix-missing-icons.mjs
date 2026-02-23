/**
 * Fix missing icons that Simple Icons CDN doesn't have.
 * Creates high-quality custom SVGs for providers not available on Simple Icons.
 * Icons: xmake, volta, psgallery, asdf, mise, winget, scoop, windows platform
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
  // WinGet - Windows package icon with gradient
  winget: {
    light: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><defs><linearGradient id="wingetGrad" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" style="stop-color:#0091EA"/><stop offset="100%" style="stop-color:#0057B8"/></linearGradient></defs><rect width="24" height="24" rx="5" fill="url(#wingetGrad)"/><path fill="white" opacity="0.95" d="M5.5 4.5h5.5v5.5H5.5zM13 4.5h5.5v5.5H13zM5.5 12h5.5v5.5H5.5zM13 12h5.5v5.5H13z"/><path d="M8 19l4 2.5 4-2.5" stroke="white" stroke-width="1.6" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
    dark: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><defs><linearGradient id="wingetGrad" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" style="stop-color:#60CFFF"/><stop offset="100%" style="stop-color:#3BA6E8"/></linearGradient></defs><rect width="24" height="24" rx="5" fill="url(#wingetGrad)"/><path fill="white" opacity="0.95" d="M5.5 4.5h5.5v5.5H5.5zM13 4.5h5.5v5.5H13zM5.5 12h5.5v5.5H5.5zM13 12h5.5v5.5H13z"/><path d="M8 19l4 2.5 4-2.5" stroke="white" stroke-width="1.6" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  },
  // PowerShell Gallery - PS terminal icon with gradient
  psgallery: {
    light: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><defs><linearGradient id="psGrad" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" style="stop-color:#0D4F8B"/><stop offset="100%" style="stop-color:#012456"/></linearGradient></defs><rect width="24" height="24" rx="5" fill="url(#psGrad)"/><path d="M5 7.5l6.5 4.5-6.5 4.5" stroke="white" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" fill="none"/><line x1="13" y1="17" x2="19.5" y2="17" stroke="white" stroke-width="2.2" stroke-linecap="round"/></svg>`,
    dark: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><defs><linearGradient id="psGrad" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" style="stop-color:#6BA8FF"/><stop offset="100%" style="stop-color:#5391FE"/></linearGradient></defs><rect width="24" height="24" rx="5" fill="url(#psGrad)"/><path d="M5 7.5l6.5 4.5-6.5 4.5" stroke="white" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" fill="none"/><line x1="13" y1="17" x2="19.5" y2="17" stroke="white" stroke-width="2.2" stroke-linecap="round"/></svg>`,
  },
  // Volta - gradient lightning bolt
  volta: {
    light: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><defs><linearGradient id="voltaGrad" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" style="stop-color:#FFB627"/><stop offset="100%" style="stop-color:#FF8C00"/></linearGradient></defs><path fill="url(#voltaGrad)" d="M13.5 1L3.5 13.5h5.5l-2 9.5L19.5 10H14l3-9z"/><path fill="#FFFFFF" opacity="0.3" d="M13.5 1L14 10h5.5L7 23l2-9.5H3.5L13.5 1z" clip-path="inset(0 50% 0 0)"/></svg>`,
    dark: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><defs><linearGradient id="voltaGrad" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" style="stop-color:#FFD060"/><stop offset="100%" style="stop-color:#FFA940"/></linearGradient></defs><path fill="url(#voltaGrad)" d="M13.5 1L3.5 13.5h5.5l-2 9.5L19.5 10H14l3-9z"/><path fill="#FFFFFF" opacity="0.2" d="M13.5 1L14 10h5.5L7 23l2-9.5H3.5L13.5 1z" clip-path="inset(0 50% 0 0)"/></svg>`,
  },
  // Xmake - chevron-based X with gradient
  xmake: {
    light: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><defs><linearGradient id="xGrad" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" style="stop-color:#2DD4A0"/><stop offset="100%" style="stop-color:#14906C"/></linearGradient></defs><rect width="24" height="24" rx="5" fill="url(#xGrad)"/><path d="M7.5 6.5l4.5 5.5-4.5 5.5" stroke="white" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" fill="none"/><path d="M16.5 6.5l-4.5 5.5 4.5 5.5" stroke="white" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" fill="none" opacity="0.6"/></svg>`,
    dark: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><defs><linearGradient id="xGrad" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" style="stop-color:#5EEABA"/><stop offset="100%" style="stop-color:#34D399"/></linearGradient></defs><rect width="24" height="24" rx="5" fill="url(#xGrad)"/><path d="M7.5 6.5l4.5 5.5-4.5 5.5" stroke="white" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" fill="none"/><path d="M16.5 6.5l-4.5 5.5 4.5 5.5" stroke="white" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" fill="none" opacity="0.6"/></svg>`,
  },
  // asdf - stylized lettermark on purple gradient
  asdf: {
    light: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><defs><linearGradient id="asdfGrad" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" style="stop-color:#6B21A8"/><stop offset="100%" style="stop-color:#4B0082"/></linearGradient></defs><rect width="24" height="24" rx="5" fill="url(#asdfGrad)"/><g fill="none" stroke="white" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4.5 16.5l2.5-9 2.5 9" /><line x1="5.5" y1="13.5" x2="8.5" y2="13.5"/><path d="M11 16.5v-3.5c0-1.1.9-2 2-2s2 .9 2 2v3.5"/><path d="M16.5 16.5v-9"/><line x1="16.5" y1="11" x2="19.5" y2="11"/></g></svg>`,
    dark: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><defs><linearGradient id="asdfGrad" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" style="stop-color:#A855F7"/><stop offset="100%" style="stop-color:#7C3AED"/></linearGradient></defs><rect width="24" height="24" rx="5" fill="url(#asdfGrad)"/><g fill="none" stroke="white" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4.5 16.5l2.5-9 2.5 9" /><line x1="5.5" y1="13.5" x2="8.5" y2="13.5"/><path d="M11 16.5v-3.5c0-1.1.9-2 2-2s2 .9 2 2v3.5"/><path d="M16.5 16.5v-9"/><line x1="16.5" y1="11" x2="19.5" y2="11"/></g></svg>`,
  },
  // mise - terminal window with gradient border (based on official logo)
  mise: {
    light: `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="miseGrad" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" style="stop-color:#00d9ff"/><stop offset="50%" style="stop-color:#52e892"/><stop offset="100%" style="stop-color:#ff9100"/></linearGradient></defs><rect x="1" y="3" width="22" height="18" rx="3" fill="#1a1a1a" stroke="url(#miseGrad)" stroke-width="1.5"/><rect x="1.75" y="3.75" width="20.5" height="5" rx="2" fill="#2a2a2a"/><circle cx="5" cy="6.25" r="1" fill="#ff5252"/><circle cx="8" cy="6.25" r="1" fill="#ffbd2e"/><circle cx="11" cy="6.25" r="1" fill="#52e892"/><text x="4" y="15.5" font-family="monospace" font-size="5" font-weight="bold" fill="#52e892">&gt;_</text><rect x="11" y="13" width="9" height="1" fill="#00d9ff" opacity="0.8"/><rect x="4" y="17" width="6" height="1" fill="#52e892" opacity="0.6"/><rect x="11" y="17" width="5" height="1" fill="#ff9100" opacity="0.6"/></svg>`,
    dark: `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="miseGrad" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" style="stop-color:#4DE8FF"/><stop offset="50%" style="stop-color:#7AFFA8"/><stop offset="100%" style="stop-color:#FFB74D"/></linearGradient></defs><rect x="1" y="3" width="22" height="18" rx="3" fill="#1a1a1a" stroke="url(#miseGrad)" stroke-width="1.5"/><rect x="1.75" y="3.75" width="20.5" height="5" rx="2" fill="#2a2a2a"/><circle cx="5" cy="6.25" r="1" fill="#ff5252"/><circle cx="8" cy="6.25" r="1" fill="#ffbd2e"/><circle cx="11" cy="6.25" r="1" fill="#52e892"/><text x="4" y="15.5" font-family="monospace" font-size="5" font-weight="bold" fill="#7AFFA8">&gt;_</text><rect x="11" y="13" width="9" height="1" fill="#4DE8FF" opacity="0.9"/><rect x="4" y="17" width="6" height="1" fill="#7AFFA8" opacity="0.7"/><rect x="11" y="17" width="5" height="1" fill="#FFB74D" opacity="0.7"/></svg>`,
  },
  // Scoop - bucket/scoop shape with gradient
  scoop: {
    light: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><defs><linearGradient id="scoopGrad" x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0%" style="stop-color:#5BA4CF"/><stop offset="100%" style="stop-color:#2D6DA3"/></linearGradient></defs><path d="M11 2.5c-.3 0-.5.1-.7.3L6.5 8H4.5C3.7 8 3 8.7 3 9.5v1C3 11.3 3.7 12 4.5 12h.3l1.5 8.2c.2.9 1 1.5 1.9 1.5h7.6c.9 0 1.7-.7 1.9-1.5L19.2 12h.3c.8 0 1.5-.7 1.5-1.5v-1c0-.8-.7-1.5-1.5-1.5h-2l-3.8-5.2c-.2-.2-.4-.3-.7-.3h-2z" fill="url(#scoopGrad)"/><path d="M8.5 14h7l-.7 4H9.2L8.5 14z" fill="white" opacity="0.3"/><rect x="4" y="9" width="16" height="2" rx="0.5" fill="white" opacity="0.2"/></svg>`,
    dark: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><defs><linearGradient id="scoopGrad" x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0%" style="stop-color:#7EC8E3"/><stop offset="100%" style="stop-color:#5BA4CF"/></linearGradient></defs><path d="M11 2.5c-.3 0-.5.1-.7.3L6.5 8H4.5C3.7 8 3 8.7 3 9.5v1C3 11.3 3.7 12 4.5 12h.3l1.5 8.2c.2.9 1 1.5 1.9 1.5h7.6c.9 0 1.7-.7 1.9-1.5L19.2 12h.3c.8 0 1.5-.7 1.5-1.5v-1c0-.8-.7-1.5-1.5-1.5h-2l-3.8-5.2c-.2-.2-.4-.3-.7-.3h-2z" fill="url(#scoopGrad)"/><path d="M8.5 14h7l-.7 4H9.2L8.5 14z" fill="white" opacity="0.25"/><rect x="4" y="9" width="16" height="2" rx="0.5" fill="white" opacity="0.15"/></svg>`,
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
