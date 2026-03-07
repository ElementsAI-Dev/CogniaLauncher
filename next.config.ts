import type { NextConfig } from "next";

process.env.BASELINE_BROWSER_MAPPING_IGNORE_OLD_DATA ??= "true";
process.env.BROWSERSLIST_IGNORE_OLD_DATA ??= "true";

const isProd = process.env.NODE_ENV === "production";

const toOrigin = (value?: string) => {
  if (!value) return undefined;
  try {
    return new URL(value).origin.replace(/\/$/, "");
  } catch {
    return undefined;
  }
};

const getDevAssetPrefix = () => {
  const explicitOrigin = toOrigin(process.env.NEXT_DEV_ORIGIN);
  if (explicitOrigin) {
    return explicitOrigin;
  }

  const isTauriDevContext = Boolean(
    process.env.TAURI_DEV_HOST ||
    process.env.TAURI_DEV_PORT ||
    process.env.TAURI_ENV_PLATFORM,
  );

  if (!isTauriDevContext) {
    return undefined;
  }

  const host = (process.env.TAURI_DEV_HOST || "localhost")
    .replace(/^https?:\/\//, "")
    .replace(/\/+$/, "");
  const port =
    process.env.TAURI_DEV_PORT ||
    process.env.PORT ||
    process.env.npm_config_port ||
    "3000";

  return `http://${host}:${port}`;
};

// Enable static export for Tauri production builds.
// This makes `pnpm build` generate the `out/` directory that Tauri loads from `src-tauri/tauri.conf.json` (frontendDist: "../out").
const nextConfig: NextConfig = {
  output: "export",
  // Note: This feature is required to use the Next.js Image component in SSG mode.
  // See https://nextjs.org/docs/messages/export-image-api for different workarounds.
  images: {
    unoptimized: true,
  },
  // Configure assetPrefix or else the server won't properly resolve your assets.
  assetPrefix: isProd ? undefined : getDevAssetPrefix(),
  // Build-time environment variables for version display
  env: {
    NEXT_PUBLIC_TAURI_VERSION: "2.9.0",
    NEXT_PUBLIC_RUST_VERSION: "1.77.2",
    NEXT_PUBLIC_NEXTJS_VERSION: "16.0.10",
    NEXT_PUBLIC_REACT_VERSION: "19.2.0",
  },
};

export default nextConfig;
