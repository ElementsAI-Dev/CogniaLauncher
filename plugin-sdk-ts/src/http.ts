import { callHostJson } from './host';
import type { HttpResponse } from './types';

/**
 * Make an HTTP GET request to a URL (must be in allowed domains).
 * Requires: http permission + domain allowlist.
 */
export function get(url: string): HttpResponse {
  return callHostJson<HttpResponse>(
    'cognia_http_get',
    JSON.stringify({ url }),
  );
}

/**
 * Make an HTTP POST request (must be in allowed domains).
 * Requires: http permission + domain allowlist.
 */
export function post(
  url: string,
  body: string,
  contentType?: string,
): HttpResponse {
  return callHostJson<HttpResponse>(
    'cognia_http_post',
    JSON.stringify({
      url,
      body,
      contentType: contentType ?? 'application/json',
    }),
  );
}
