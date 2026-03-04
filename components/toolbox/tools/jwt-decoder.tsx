'use client';

import { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { ToolActionRow, ToolTextArea, ToolValidationMessage } from '@/components/toolbox/tool-layout';
import { useLocale } from '@/components/providers/locale-provider';
import { useCopyToClipboard } from '@/hooks/use-clipboard';
import { useToolPreferences } from '@/hooks/use-tool-preferences';
import { TOOLBOX_LIMITS } from '@/lib/constants/toolbox-limits';
import { ShieldCheck, ShieldAlert } from 'lucide-react';
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

const DEFAULT_PREFERENCES = {
  showSignature: false,
} as const;

export default function JwtDecoder({ className }: ToolComponentProps) {
  const { t } = useLocale();
  const { preferences, setPreferences } = useToolPreferences('jwt-decoder', DEFAULT_PREFERENCES);
  const [input, setInput] = useState('');
  const [decoded, setDecoded] = useState<DecodedJwt | null>(null);
  const [errorDetail, setErrorDetail] = useState<string | null>(null);
  const { copy } = useCopyToClipboard();

  const handleDecode = useCallback(() => {
    if (!input.trim()) {
      setDecoded(null);
      setErrorDetail(null);
      return;
    }
    if (input.length > TOOLBOX_LIMITS.converterChars) {
      setDecoded(null);
      setErrorDetail(
        t('toolbox.tools.shared.inputTooLarge', {
          limit: TOOLBOX_LIMITS.converterChars.toLocaleString(),
        }),
      );
      return;
    }
    const result = decodeJwt(input, Date.now());
    setDecoded(result);
    setErrorDetail(result ? null : t('toolbox.tools.jwtDecoder.invalidToken'));
  }, [input, t]);

  const expInfo = decoded?.expDate ? { expDate: decoded.expDate, isExpired: decoded.isExpired } : null;

  const error = input.trim() && !decoded;

  const handleCopySection = useCallback(async (value: unknown) => {
    await copy(JSON.stringify(value, null, 2));
  }, [copy]);

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

        <ToolActionRow
          rightSlot={(
            <div className="flex items-center gap-2">
              <Switch
                id="jwt-show-signature"
                checked={preferences.showSignature}
                onCheckedChange={(checked) => setPreferences({ showSignature: checked })}
              />
              <Label htmlFor="jwt-show-signature" className="text-xs">{t('toolbox.tools.jwtDecoder.showSignature')}</Label>
            </div>
          )}
        />

        {error && (
          <ToolValidationMessage message={errorDetail ?? t('toolbox.tools.jwtDecoder.invalidToken')} />
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
                <Button variant="ghost" size="sm" className="mt-2 h-7 text-xs" onClick={() => handleCopySection(decoded.header)}>
                  {t('toolbox.actions.copy')}
                </Button>
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
                <Button variant="ghost" size="sm" className="mt-2 h-7 text-xs" onClick={() => handleCopySection(decoded.payload)}>
                  {t('toolbox.actions.copy')}
                </Button>
                {expInfo && (
                  <p className="text-xs text-muted-foreground mt-2">
                    {t('toolbox.tools.jwtDecoder.expiresAt')}: {expInfo.expDate.toLocaleString()}
                  </p>
                )}
              </CardContent>
            </Card>
            {preferences.showSignature && (
              <Card className="md:col-span-2">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">{t('toolbox.tools.jwtDecoder.signature')}</CardTitle>
                </CardHeader>
                <CardContent>
                  <code className="block rounded-md bg-muted p-2 text-xs break-all">{decoded.signature}</code>
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
