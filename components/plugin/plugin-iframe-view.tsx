'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { useLocale } from '@/components/providers/locale-provider';
import { usePlugins } from '@/hooks/use-plugins';
import { pluginGetUiEntry } from '@/lib/tauri';
import { writeClipboard, readClipboard } from '@/lib/clipboard';
import { AlertCircle, Shield } from 'lucide-react';
import { toast } from 'sonner';
import type { PluginUiEntry } from '@/types/plugin';

// ============================================================================
// Bridge script injected into the iframe srcdoc
// ============================================================================

const BRIDGE_SCRIPT = `
<script>
(function() {
  var _pending = {};
  var _nextId = 1;

  function rpc(method, params) {
    return new Promise(function(resolve, reject) {
      var id = 'rpc_' + (_nextId++);
      _pending[id] = { resolve: resolve, reject: reject };
      parent.postMessage({ type: 'cognia-rpc', id: id, method: method, params: params }, '*');
    });
  }

  window.addEventListener('message', function(e) {
    var msg = e.data;
    if (msg && msg.type === 'cognia-rpc-response' && _pending[msg.id]) {
      var p = _pending[msg.id];
      delete _pending[msg.id];
      if (msg.error) { p.reject(new Error(msg.error)); }
      else { p.resolve(msg.result); }
    }
    if (msg && msg.type === 'cognia-event') {
      window.dispatchEvent(new CustomEvent('cognia:' + msg.name, { detail: msg.payload }));
    }
  });

  window.cognia = {
    log: {
      info: function(m) { return rpc('log.info', { message: m }); },
      warn: function(m) { return rpc('log.warn', { message: m }); },
      error: function(m) { return rpc('log.error', { message: m }); },
      debug: function(m) { return rpc('log.debug', { message: m }); }
    },
    i18n: {
      translate: function(key, params) { return rpc('i18n.translate', { key: key, params: params }); },
      getLocale: function() { return rpc('i18n.getLocale', {}); }
    },
    ui: {
      close: function() { return rpc('ui.close', {}); },
      setTitle: function(title) { return rpc('ui.setTitle', { title: title }); },
      showToast: function(message, type) { return rpc('ui.showToast', { message: message, type: type }); }
    },
    clipboard: {
      read: function() { return rpc('clipboard.read', {}); },
      write: function(text) { return rpc('clipboard.write', { text: text }); }
    },
    callTool: function(entry, input) { return rpc('callTool', { entry: entry, input: input }); },
    theme: {
      current: function() { return rpc('theme.current', {}); }
    }
  };
})();
</script>
`;

const CSP_META = '<meta http-equiv="Content-Security-Policy" content="default-src \'none\'; script-src \'unsafe-inline\'; style-src \'unsafe-inline\'; img-src data: blob:;">';

// ============================================================================
// Component
// ============================================================================

interface PluginIframeViewProps {
  pluginId: string;
  toolEntry: string;
  className?: string;
}

export function PluginIframeView({ pluginId, toolEntry, className }: PluginIframeViewProps) {
  const { t } = useLocale();
  const { callTool, getLocales, translatePluginKey } = usePlugins();
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [entry, setEntry] = useState<PluginUiEntry | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load the iframe entry HTML
  useEffect(() => {
    let cancelled = false;

    pluginGetUiEntry(pluginId)
      .then((data) => {
        if (!cancelled) {
          setEntry(data);
          setLoading(false);
        }
      })
      .catch((e) => {
        if (!cancelled) {
          setError((e as Error).message ?? String(e));
          setLoading(false);
        }
      });

    return () => { cancelled = true; };
  }, [pluginId]);

  // Handle postMessage from iframe
  const handleMessage = useCallback(
    async (event: MessageEvent) => {
      const msg = event.data;
      if (!msg || msg.type !== 'cognia-rpc' || !msg.id || !msg.method) return;

      const iframe = iframeRef.current;
      if (!iframe?.contentWindow || event.source !== iframe.contentWindow) return;

      const respond = (result?: unknown, error?: string) => {
        iframe.contentWindow?.postMessage(
          { type: 'cognia-rpc-response', id: msg.id, result, error },
          '*',
        );
      };

      const permissions = entry?.permissions ?? [];

      try {
        switch (msg.method) {
          // Logging — always allowed
          case 'log.info':
          case 'log.warn':
          case 'log.error':
          case 'log.debug':
            console.log(`[plugin:${pluginId}] ${msg.method}:`, msg.params?.message);
            respond({ ok: true });
            break;

          // i18n — always allowed
          case 'i18n.getLocale': {
            respond({ locale: document.documentElement.lang || 'en' });
            break;
          }
          case 'i18n.translate': {
            const locales = await getLocales(pluginId);
            const locale = document.documentElement.lang || 'en';
            const text = translatePluginKey(locales, locale, msg.params?.key, msg.params?.params);
            respond({ text });
            break;
          }

          // UI controls — always allowed
          case 'ui.close':
            respond({ ok: true });
            break;
          case 'ui.setTitle':
            respond({ ok: true });
            break;
          case 'ui.showToast':
            toast(msg.params?.message ?? '');
            respond({ ok: true });
            break;

          // Clipboard — permission-gated
          case 'clipboard.read':
            if (!permissions.includes('clipboard')) {
              respond(undefined, 'clipboard permission not granted');
            } else {
              const text = await readClipboard();
              respond({ text });
            }
            break;
          case 'clipboard.write':
            if (!permissions.includes('clipboard')) {
              respond(undefined, 'clipboard permission not granted');
            } else {
              await writeClipboard(msg.params?.text ?? '');
              respond({ ok: true });
            }
            break;

          // Call back into WASM
          case 'callTool': {
            const result = await callTool(pluginId, msg.params?.entry ?? toolEntry, msg.params?.input ?? '');
            respond({ result });
            break;
          }

          // Theme info — always allowed
          case 'theme.current': {
            const isDark = document.documentElement.classList.contains('dark');
            respond({ mode: isDark ? 'dark' : 'light' });
            break;
          }

          default:
            respond(undefined, `Unknown method: ${msg.method}`);
        }
      } catch (e) {
        respond(undefined, (e as Error).message ?? String(e));
      }
    },
    [pluginId, toolEntry, entry, callTool, getLocales, translatePluginKey],
  );

  useEffect(() => {
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [handleMessage]);

  if (loading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (error || !entry) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>{error ?? t('toolbox.plugin.iframeError')}</AlertDescription>
      </Alert>
    );
  }

  // Inject CSP and bridge script into HTML
  const srcdoc = entry.html.replace(
    /<head[^>]*>/i,
    (match) => `${match}\n${CSP_META}\n${BRIDGE_SCRIPT}\n`,
  );

  return (
    <div className={className}>
      <div className="flex items-center gap-2 mb-2">
        <Badge variant="outline" className="text-[10px] gap-1">
          <Shield className="h-2.5 w-2.5" />
          {t('toolbox.plugin.iframeSandboxed')}
        </Badge>
      </div>
      <iframe
        ref={iframeRef}
        srcDoc={srcdoc}
        sandbox="allow-scripts"
        className="w-full rounded-md border bg-background"
        style={{ minHeight: 400, height: '60vh' }}
        title={`Plugin: ${pluginId}`}
      />
    </div>
  );
}
