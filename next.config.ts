import type { NextConfig } from "next";

const isProd = process.env.NODE_ENV === "production";

const internalHost = process.env.TAURI_DEV_HOST || "localhost";

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
  assetPrefix: isProd ? undefined : `http://${internalHost}:3000`,
  // Build-time environment variables for version display
  env: {
    NEXT_PUBLIC_TAURI_VERSION: "2.9.0",
    NEXT_PUBLIC_RUST_VERSION: "1.77.2",
    NEXT_PUBLIC_NEXTJS_VERSION: "16.0.0",
    NEXT_PUBLIC_REACT_VERSION: "19.0.0",
  },
};

export default nextConfig;
