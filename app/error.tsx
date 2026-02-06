"use client";

import { useEffect, useState } from "react";
import { AlertCircle, RotateCcw, Home, ChevronDown, Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const [showDetails, setShowDetails] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    console.error("Unhandled error:", error);
  }, [error]);

  const handleCopyError = async () => {
    const text = [
      `Error: ${error.message}`,
      error.digest ? `Digest: ${error.digest}` : "",
      error.stack ? `\nStack:\n${error.stack}` : "",
    ]
      .filter(Boolean)
      .join("\n");
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex items-center justify-center min-h-[60vh] p-6">
      <div className="w-full max-w-lg">
        {/* Animated icon with glow */}
        <div className="relative flex justify-center mb-6 error-content-1">
          <div className="absolute inset-0 flex justify-center items-center">
            <div className="w-24 h-24 rounded-full bg-destructive/10 error-glow" />
          </div>
          <div className="relative error-icon-float flex h-16 w-16 items-center justify-center rounded-2xl bg-destructive/10 border border-destructive/20 shadow-sm">
            <AlertCircle className="h-8 w-8 text-destructive" />
          </div>
        </div>

        {/* Title */}
        <div className="text-center mb-2 error-content-2">
          <h1 className="text-xl font-semibold tracking-tight">
            Something went wrong
          </h1>
          <p className="mt-2 text-sm text-muted-foreground leading-relaxed max-w-sm mx-auto">
            {error.message || "An unexpected error occurred. Please try again."}
          </p>
        </div>

        {/* Error details (collapsible) */}
        {(error.digest || error.stack) && (
          <div className="mt-4 error-content-3">
            <button
              onClick={() => setShowDetails(!showDetails)}
              className="flex items-center gap-1.5 mx-auto text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <ChevronDown
                className={`h-3.5 w-3.5 transition-transform duration-200 ${showDetails ? "rotate-180" : ""}`}
              />
              Error details
            </button>
            {showDetails && (
              <div className="mt-3 relative group">
                <div className="rounded-lg border bg-muted/30 p-3 font-mono text-xs text-muted-foreground overflow-auto max-h-40 leading-relaxed">
                  {error.digest && (
                    <p className="mb-1">
                      <span className="text-foreground/60">ID:</span> {error.digest}
                    </p>
                  )}
                  {error.stack && (
                    <pre className="whitespace-pre-wrap break-all">{error.stack}</pre>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute top-2 right-2 h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={handleCopyError}
                >
                  {copied ? (
                    <Check className="h-3.5 w-3.5 text-green-500" />
                  ) : (
                    <Copy className="h-3.5 w-3.5" />
                  )}
                </Button>
              </div>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-center gap-3 mt-6 error-content-4">
          <Button variant="outline" onClick={reset} className="gap-2">
            <RotateCcw className="h-4 w-4" />
            Try Again
          </Button>
          <Button asChild className="gap-2">
            <Link href="/">
              <Home className="h-4 w-4" />
              Dashboard
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
