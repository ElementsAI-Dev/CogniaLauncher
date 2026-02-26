"use client";

import { useEffect } from "react";
import { captureFrontendCrash } from "@/lib/crash-reporter";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Global error:", error);
    void captureFrontendCrash({
      source: "next.global-error-boundary",
      error,
      includeConfig: true,
      extra: {
        digest: error.digest,
        boundary: "app/global-error.tsx",
      },
    });
  }, [error]);

  return (
    <html lang="en">
      <head>
        <style>{`
          @keyframes ge-icon-in {
            from { opacity: 0; transform: scale(0.5); }
            to { opacity: 1; transform: scale(1); }
          }
          @keyframes ge-fade-up {
            from { opacity: 0; transform: translateY(12px); }
            to { opacity: 1; transform: translateY(0); }
          }
          @keyframes ge-glow {
            0%, 100% { opacity: 0.12; transform: scale(1); }
            50% { opacity: 0.2; transform: scale(1.06); }
          }
          @media (prefers-reduced-motion: reduce) {
            .ge-anim { animation: none !important; }
          }
        `}</style>
      </head>
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "system-ui, -apple-system, sans-serif",
          background: "var(--background, #09090b)",
          color: "var(--foreground, #fafafa)",
        }}
      >
        <div style={{ textAlign: "center", padding: "2rem", maxWidth: 420 }}>
          {/* Icon with glow */}
          <div style={{ position: "relative", display: "inline-block", marginBottom: 24 }}>
            <div
              className="ge-anim"
              style={{
                position: "absolute",
                inset: -12,
                borderRadius: "50%",
                background: "oklch(0.577 0.245 27.325 / 20%)",
                animation: "ge-glow 3s ease-in-out infinite",
              }}
            />
            <div
              className="ge-anim"
              style={{
                position: "relative",
                width: 64,
                height: 64,
                borderRadius: 16,
                background: "oklch(0.577 0.245 27.325 / 12%)",
                border: "1px solid oklch(0.577 0.245 27.325 / 20%)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                animation: "ge-icon-in 0.6s cubic-bezier(0.16, 1, 0.3, 1) both",
              }}
            >
              <svg
                width="32"
                height="32"
                viewBox="0 0 24 24"
                fill="none"
                stroke="oklch(0.577 0.245 27.325)"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
            </div>
          </div>

          {/* Title */}
          <h1
            className="ge-anim"
            style={{
              fontSize: 20,
              fontWeight: 600,
              margin: "0 0 8px",
              letterSpacing: "-0.01em",
              animation: "ge-fade-up 0.5s cubic-bezier(0.16, 1, 0.3, 1) 0.1s both",
            }}
          >
            Application Error
          </h1>

          {/* Message */}
          <p
            className="ge-anim"
            style={{
              fontSize: 14,
              lineHeight: 1.6,
              margin: "0 0 8px",
              opacity: 0.6,
              animation: "ge-fade-up 0.5s cubic-bezier(0.16, 1, 0.3, 1) 0.2s both",
            }}
          >
            {error.message || "A critical error occurred in the application."}
          </p>

          {error.digest && (
            <p
              className="ge-anim"
              style={{
                fontSize: 12,
                fontFamily: "monospace",
                opacity: 0.4,
                margin: "0 0 24px",
                animation: "ge-fade-up 0.5s cubic-bezier(0.16, 1, 0.3, 1) 0.25s both",
              }}
            >
              Error ID: {error.digest}
            </p>
          )}

          {/* Button */}
          <button
            className="ge-anim"
            onClick={reset}
            style={{
              marginTop: error.digest ? 0 : 16,
              padding: "10px 24px",
              fontSize: 14,
              fontWeight: 500,
              border: "1px solid oklch(1 0 0 / 15%)",
              borderRadius: 8,
              background: "oklch(1 0 0 / 8%)",
              color: "inherit",
              cursor: "pointer",
              transition: "background 150ms, border-color 150ms",
              animation: "ge-fade-up 0.5s cubic-bezier(0.16, 1, 0.3, 1) 0.3s both",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "oklch(1 0 0 / 14%)";
              e.currentTarget.style.borderColor = "oklch(1 0 0 / 25%)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "oklch(1 0 0 / 8%)";
              e.currentTarget.style.borderColor = "oklch(1 0 0 / 15%)";
            }}
          >
            ↻ Try Again
          </button>
        </div>
      </body>
    </html>
  );
}
