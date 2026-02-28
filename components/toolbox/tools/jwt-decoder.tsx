'use client';

import { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ToolTextArea } from '@/components/toolbox/tool-layout';
import { useLocale } from '@/components/providers/locale-provider';
import { AlertCircle, ShieldCheck, ShieldAlert } from 'lucide-react';
import type { ToolComponentProps } from '@/types/toolbox';

function base64UrlDecode(str: string): string {
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) base64 += '=';
  return decodeURIComponent(escape(atob(base64)));
}

interface DecodedJwt {
  header: object;
  payload: object;
  signature: string;
  expDate: Date | null;
  isExpired: boolean;
}

function decodeJwt(token: string, now: number): DecodedJwt | null {
  const parts = token.trim().split('.');
  if (parts.length !== 3) return null;
  try {
    const header = JSON.parse(base64UrlDecode(parts[0]));
    const payload = JSON.parse(base64UrlDecode(parts[1]));
    const exp = (payload as Record<string, unknown>).exp;
    const expDate = typeof exp === 'number' ? new Date(exp * 1000) : null;
    const isExpired = expDate ? expDate.getTime() < now : false;
    return { header, payload, signature: parts[2], expDate, isExpired };
  } catch {
    return null;
  }
}

export default function JwtDecoder({ className }: ToolComponentProps) {
  const { t } = useLocale();
  const [input, setInput] = useState('');
  const [decoded, setDecoded] = useState<DecodedJwt | null>(null);

  const handleDecode = useCallback(() => {
    if (!input.trim()) { setDecoded(null); return; }
    setDecoded(decodeJwt(input, Date.now()));
  }, [input]);

  const expInfo = decoded?.expDate ? { expDate: decoded.expDate, isExpired: decoded.isExpired } : null;

  const error = input.trim() && !decoded;

  return (
    <div className={className}>
      <div className="space-y-4">
        <ToolTextArea
          label={t('toolbox.tools.jwtDecoder.input')}
          value={input}
          onChange={setInput}
          placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
          showPaste
          showClear
          rows={4}
        />

        <Button onClick={handleDecode} size="sm" disabled={!input.trim()}>
          {t('toolbox.tools.jwtDecoder.decode')}
        </Button>

        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{t('toolbox.tools.jwtDecoder.invalidToken')}</AlertDescription>
          </Alert>
        )}

        {decoded && (
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  {t('toolbox.tools.jwtDecoder.header')}
                  <Badge variant="secondary" className="text-[10px]">
                    {(decoded.header as Record<string, unknown>).alg as string ?? 'unknown'}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <pre className="text-xs font-mono bg-muted rounded-md p-3 overflow-auto max-h-48">
                  {JSON.stringify(decoded.header, null, 2)}
                </pre>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  {t('toolbox.tools.jwtDecoder.payload')}
                  {expInfo && (
                    <Badge
                      variant="secondary"
                      className={expInfo.isExpired
                        ? 'bg-red-500/10 text-red-600 dark:text-red-400 gap-1'
                        : 'bg-green-500/10 text-green-600 dark:text-green-400 gap-1'}
                    >
                      {expInfo.isExpired ? <ShieldAlert className="h-3 w-3" /> : <ShieldCheck className="h-3 w-3" />}
                      {expInfo.isExpired ? t('toolbox.tools.jwtDecoder.expired') : t('toolbox.tools.jwtDecoder.valid')}
                    </Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <pre className="text-xs font-mono bg-muted rounded-md p-3 overflow-auto max-h-48">
                  {JSON.stringify(decoded.payload, null, 2)}
                </pre>
                {expInfo && (
                  <p className="text-xs text-muted-foreground mt-2">
                    {t('toolbox.tools.jwtDecoder.expiresAt')}: {expInfo.expDate.toLocaleString()}
                  </p>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
