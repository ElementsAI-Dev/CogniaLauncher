import { callHostJson } from './host';
import type { HttpRequest, HttpResponse } from './types';

/**
 * Make an HTTP request (must be in allowed domains).
 * Requires: http permission + domain allowlist.
 */
export function request(input: HttpRequest): HttpResponse {
  return callHostJson<HttpResponse>(
    'cognia_http_request',
    JSON.stringify({
      method: input.method ?? 'GET',
      url: input.url,
      headers: input.headers ?? {},
      body: input.body,
      contentType: input.contentType,
      timeoutMs: input.timeoutMs,
    }),
  );
}

/**
 * Compatibility helper for a simple HTTP GET request.
 * For new plugins, prefer `request()` to use the normalized request contract.
 */
export function get(url: string): HttpResponse {
  return request({ method: 'GET', url });
}

/**
 * Compatibility helper for a simple HTTP POST request.
 * For new plugins, prefer `request()` to use the normalized request contract.
 */
export function post(
  url: string,
  body: string,
  contentType?: string,
): HttpResponse {
  return request({
    method: 'POST',
    url,
    body,
    contentType: contentType ?? 'application/json',
  });
}
