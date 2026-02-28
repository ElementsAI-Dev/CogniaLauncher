'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { useLocale } from '@/components/providers/locale-provider';
import { ArrowLeft, FileQuestion } from 'lucide-react';

export default function DocsNotFound() {
  const { t } = useLocale();

  return (
    <div className="flex items-center justify-center min-h-[40vh] p-6">
      <div className="w-full max-w-sm text-center">
        <FileQuestion className="h-12 w-12 text-muted-foreground/40 mx-auto mb-4" />
        <h2 className="text-lg font-semibold">{t('docs.noContent')}</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          {t('docs.description')}
        </p>
        <Button variant="outline" asChild className="mt-6 gap-2">
          <Link href="/docs">
            <ArrowLeft className="h-4 w-4" />
            {t('docs.backToIndex')}
          </Link>
        </Button>
      </div>
    </div>
  );
}
