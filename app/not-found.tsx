"use client";

import { useRouter } from "next/navigation";
import { Home, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { useLocale } from "@/components/providers/locale-provider";

export default function NotFound() {
  const router = useRouter();
  const { t } = useLocale();

  return (
    <div className="flex items-center justify-center min-h-[60vh] p-6">
      <div className="w-full max-w-md text-center">
        {/* Large 404 number */}
        <div className="not-found-number select-none mb-2">
          <span className="text-8xl font-black tracking-tighter bg-gradient-to-b from-foreground to-muted-foreground/40 bg-clip-text text-transparent">
            {t("notFoundPage.code")}
          </span>
        </div>

        {/* Title & description */}
        <div className="error-content-2">
          <h1 className="text-lg font-semibold tracking-tight">
            {t("notFoundPage.title")}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground leading-relaxed max-w-xs mx-auto">
            {t("notFoundPage.description")}
          </p>
        </div>

        {/* Decorative divider */}
        <div className="error-content-3 flex items-center justify-center gap-2 my-6">
          <div className="h-px w-12 bg-border" />
          <div className="h-1.5 w-1.5 rounded-full bg-muted-foreground/30" />
          <div className="h-px w-12 bg-border" />
        </div>

        {/* Actions */}
        <div className="error-content-4 flex justify-center gap-3">
          <Button variant="outline" onClick={() => router.back()} className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            {t("notFoundPage.goBack")}
          </Button>
          <Button asChild className="gap-2">
            <Link href="/">
              <Home className="h-4 w-4" />
              {t("notFoundPage.dashboard")}
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
