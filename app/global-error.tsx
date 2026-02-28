"use client";

import { useEffect, useState } from "react";
import { captureFrontendCrash } from "@/lib/crash-reporter";

const i18n: Record<string, Record<string, string>> = {
  en: {
    title: "Application Error",
    defaultMessage: "A critical error occurred in the application.",
    errorId: "Error ID",
    tryAgain: "Try Again",
    dashboard: "Go to Dashboard",
    copy: "Copy error details",
    copied: "Copied!",
  },
  zh: {
    title: "应用程序错误",
    defaultMessage: "应用程序发生了严重错误。",
    errorId: "错误 ID",
    tryAgain: "重试",
    dashboard: "返回首页",
    copy: "复制错误详情",
    copied: "已复制！",
  },
};

function detectLang(): string {
  if (typeof document !== "undefined") {
    const match = document.cookie.match(/NEXT_LOCALE=([^;]+)/);
    if (match?.[1] && (match[1] === "en" || match[1] === "zh")) {
      return match[1];
    }
  }
  if (typeof navigator !== "undefined") {
    const lang = navigator.language;
    if (lang.startsWith("zh")) return "zh";
  }
  return "en";
}

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const lang = detectLang();
  const t = i18n[lang] || i18n.en;

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

  const handleCopy = async () => {
    const text = [
      `Error: ${error.message}`,
      error.digest ? `Digest: ${error.digest}` : "",
      error.stack ? `\nStack:\n${error.stack}` : "",
    ]
      .filter(Boolean)
      .join("\n");
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      try {
        const textarea = document.createElement("textarea");
        textarea.value = text;
        textarea.style.position = "fixed";
        textarea.style.opacity = "0";
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand("copy");
        document.body.removeChild(textarea);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch {
        // Both methods failed
      }
    }
  };

  /* Shared button base style */
  const btnBase: React.CSSProperties = {
    padding: "10px 20px",
    fontSize: 14,
    fontWeight: 500,
    borderRadius: 8,
    cursor: "pointer",
    transition: "background 150ms, border-color 150ms",
    textDecoration: "none",
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
  };

  return (
    <html lang={lang}>
      <head>
        <style>{`
          :root {
            --ge-bg: #ffffff;
            --ge-fg: #09090b;
            --ge-muted: #71717a;
            --ge-border: #e4e4e7;
            --ge-surface: #f4f4f5;
            --ge-destructive: oklch(0.577 0.245 27.325);
            --ge-btn-bg: rgba(0,0,0,0.04);
            --ge-btn-border: rgba(0,0,0,0.12);
            --ge-btn-hover-bg: rgba(0,0,0,0.08);
            --ge-btn-hover-border: rgba(0,0,0,0.18);
          }
          @media (prefers-color-scheme: dark) {
            :root {
              --ge-bg: #09090b;
              --ge-fg: #fafafa;
              --ge-muted: #a1a1aa;
              --ge-border: #27272a;
              --ge-surface: #18181b;
              --ge-btn-bg: rgba(255,255,255,0.08);
              --ge-btn-border: rgba(255,255,255,0.15);
              --ge-btn-hover-bg: rgba(255,255,255,0.14);
              --ge-btn-hover-border: rgba(255,255,255,0.25);
            }
          }
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
          .ge-btn {
            background: var(--ge-btn-bg);
            border: 1px solid var(--ge-btn-border);
            color: var(--ge-fg);
          }
          .ge-btn:hover {
            background: var(--ge-btn-hover-bg);
            border-color: var(--ge-btn-hover-border);
          }
          .ge-details-box {
            border: 1px solid var(--ge-border);
            background: var(--ge-surface);
            border-radius: 8px;
            padding: 12px;
            font-family: monospace;
            font-size: 12px;
            color: var(--ge-muted);
            overflow: auto;
            max-height: 160px;
            text-align: left;
            white-space: pre-wrap;
            word-break: break-all;
            line-height: 1.5;
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
          background: "var(--ge-bg)",
          color: "var(--ge-fg)",
        }}
      >
        <div style={{ textAlign: "center", padding: "2rem", maxWidth: 460 }}>
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
            {t.title}
          </h1>

          {/* Message */}
          <p
            className="ge-anim"
            style={{
              fontSize: 14,
              lineHeight: 1.6,
              margin: "0 0 8px",
              color: "var(--ge-muted)",
              animation: "ge-fade-up 0.5s cubic-bezier(0.16, 1, 0.3, 1) 0.2s both",
            }}
          >
            {error.message || t.defaultMessage}
          </p>

          {error.digest && (
            <p
              className="ge-anim"
              style={{
                fontSize: 12,
                fontFamily: "monospace",
                color: "var(--ge-muted)",
                opacity: 0.7,
                margin: "0 0 16px",
                animation: "ge-fade-up 0.5s cubic-bezier(0.16, 1, 0.3, 1) 0.25s both",
              }}
            >
              {t.errorId}: {error.digest}
            </p>
          )}

          {/* Collapsible error details */}
          {(error.stack || error.digest) && (
            <div
              className="ge-anim"
              style={{
                marginBottom: 16,
                animation: "ge-fade-up 0.5s cubic-bezier(0.16, 1, 0.3, 1) 0.28s both",
              }}
            >
              <button
                onClick={() => setShowDetails(!showDetails)}
                style={{
                  background: "none",
                  border: "none",
                  color: "var(--ge-muted)",
                  fontSize: 12,
                  cursor: "pointer",
                  padding: "4px 8px",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 4,
                }}
              >
                <span style={{
                  display: "inline-block",
                  transition: "transform 200ms",
                  transform: showDetails ? "rotate(180deg)" : "rotate(0deg)",
                  fontSize: 10,
                }}>
                  ▼
                </span>
                {t.copy}
              </button>
              {showDetails && (
                <div style={{ marginTop: 8, position: "relative" }}>
                  <div className="ge-details-box">
                    {error.digest && <div>{t.errorId}: {error.digest}</div>}
                    {error.stack && <div style={{ marginTop: error.digest ? 8 : 0 }}>{error.stack}</div>}
                  </div>
                  <button
                    onClick={handleCopy}
                    style={{
                      position: "absolute",
                      top: 8,
                      right: 8,
                      background: "var(--ge-btn-bg)",
                      border: "1px solid var(--ge-btn-border)",
                      borderRadius: 6,
                      padding: "4px 8px",
                      fontSize: 11,
                      color: copied ? "#22c55e" : "var(--ge-muted)",
                      cursor: "pointer",
                      transition: "color 150ms",
                    }}
                  >
                    {copied ? t.copied : "⧉"}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Buttons */}
          <div
            className="ge-anim"
            style={{
              display: "flex",
              justifyContent: "center",
              gap: 12,
              flexWrap: "wrap",
              animation: "ge-fade-up 0.5s cubic-bezier(0.16, 1, 0.3, 1) 0.3s both",
            }}
          >
            <button
              className="ge-btn"
              onClick={reset}
              style={btnBase}
            >
              ↻ {t.tryAgain}
            </button>
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- global-error replaces entire layout; next/link unavailable */}
            <a
              href="/"
              className="ge-btn"
              style={btnBase}
            >
              {t.dashboard}
            </a>
          </div>
        </div>
      </body>
    </html>
  );
}
