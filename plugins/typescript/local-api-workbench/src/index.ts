import { cognia } from '@cognia/plugin-sdk';

type ApiMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD';

type ApiInput = {
  method: ApiMethod;
  url: string;
  headers?: Record<string, string>;
  body?: string;
  contentType?: string;
  timeoutMs?: number;
  maxBodyChars?: number;
};

type ApiResult = {
  ok: boolean;
  method: ApiMethod;
  url: string;
  requestHeaders?: Record<string, string>;
  status?: number;
  latencyMs?: number;
  responseBody?: string;
  responseJson?: unknown;
  responseHeaders?: Record<string, string>;
  responseBytes?: number;
  responseBodyTruncated?: boolean;
  errorCode?: string;
  message: string;
  recommendations?: string[];
};

const DEFAULT_URL = 'http://localhost:3000/health';
const DEFAULT_TIMEOUT_MS = 5000;
const DEFAULT_MAX_BODY_CHARS = 4000;
const SUPPORTED_METHODS: ApiMethod[] = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD'];

class ApiToolError extends Error {
  readonly code: string;
  readonly recommendations: string[];

  constructor(code: string, message: string, recommendations: string[]) {
    super(message);
    this.name = 'ApiToolError';
    this.code = code;
    this.recommendations = recommendations;
  }
}

function local_api_workbench(): number {
  const raw = Host.inputString();
  try {
    const input = parseInput(raw);
    const result = executeRequest(input);
    Host.outputString(JSON.stringify(result));
    return 0;
  } catch (error) {
    Host.outputString(JSON.stringify(buildFailureResult(error)));
    return 1;
  }
}

function buildFailureResult(error: unknown): ApiResult {
  if (error instanceof ApiToolError) {
    return {
      ok: false,
      method: 'GET',
      url: '',
      errorCode: error.code,
      message: error.message,
      recommendations: error.recommendations,
    };
  }

  return {
    ok: false,
    method: 'GET',
    url: '',
    errorCode: 'INVALID_INPUT',
    message: error instanceof Error ? error.message : 'Input must be empty, a URL string, or a JSON object.',
    recommendations: [
      'Provide no input to use the default localhost health URL.',
      'Provide a raw URL string or JSON like {"method":"GET","url":"http://localhost:3000/health"}.',
    ],
  };
}

function parseInput(raw: string): ApiInput {
  const trimmed = raw.trim();
  if (!trimmed) {
    return { method: 'GET', url: DEFAULT_URL, timeoutMs: DEFAULT_TIMEOUT_MS, maxBodyChars: DEFAULT_MAX_BODY_CHARS };
  }
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return validateInput({ method: 'GET', url: trimmed, timeoutMs: DEFAULT_TIMEOUT_MS, maxBodyChars: DEFAULT_MAX_BODY_CHARS });
  }

  const parsed = JSON.parse(trimmed) as Partial<ApiInput> & {
    headers?: unknown;
    body?: unknown;
  };
  return validateInput({
    method: normalizeMethod(parsed.method),
    url: parsed.url ?? DEFAULT_URL,
    headers: normalizeHeaders(parsed.headers),
    body: normalizeBody(parsed.body),
    contentType: typeof parsed.contentType === 'string' ? parsed.contentType : undefined,
    timeoutMs: normalizePositiveInteger(parsed.timeoutMs, 'timeoutMs', DEFAULT_TIMEOUT_MS),
    maxBodyChars: normalizePositiveInteger(parsed.maxBodyChars, 'maxBodyChars', DEFAULT_MAX_BODY_CHARS),
  });
}

function normalizeBody(body: unknown): string | undefined {
  if (body === undefined || body === null) {
    return undefined;
  }
  if (typeof body === 'string') {
    return body;
  }
  return JSON.stringify(body);
}

function normalizeHeaders(headers: unknown): Record<string, string> | undefined {
  if (headers === undefined || headers === null) {
    return undefined;
  }
  if (typeof headers !== 'object' || Array.isArray(headers)) {
    throw new ApiToolError('INVALID_INPUT', 'headers must be a JSON object of string values.', [
      'Provide headers like {"Authorization":"Bearer token","X-Trace-Id":"trace-1"}.',
    ]);
  }

  const normalized = Object.entries(headers as Record<string, unknown>).reduce<Record<string, string>>((acc, [key, value]) => {
    if (typeof value !== 'string') {
      throw new ApiToolError('INVALID_INPUT', `Header "${key}" must be a string value.`, [
        'Convert non-string header values to strings before sending the request.',
      ]);
    }
    acc[key] = value;
    return acc;
  }, {});

  return Object.keys(normalized).length > 0 ? normalized : undefined;
}

function normalizePositiveInteger(value: unknown, fieldName: string, fallback: number): number {
  if (value === undefined || value === null || value === '') {
    return fallback;
  }
  const numeric = typeof value === 'number' ? value : Number(value);
  if (!Number.isInteger(numeric) || numeric <= 0) {
    throw new ApiToolError('INVALID_INPUT', `${fieldName} must be a positive integer.`, [
      `Provide ${fieldName} as a positive integer value.`,
    ]);
  }
  return numeric;
}

function normalizeMethod(method: string | undefined): ApiMethod {
  const normalized = (method ?? 'GET').toUpperCase();
  if (!SUPPORTED_METHODS.includes(normalized as ApiMethod)) {
    throw new ApiToolError('INVALID_INPUT', `Unsupported HTTP method: ${normalized}.`, [
      `Use one of: ${SUPPORTED_METHODS.join(', ')}.`,
    ]);
  }
  return normalized as ApiMethod;
}

function validateInput(input: ApiInput): ApiInput {
  const parsed = new URL(input.url);
  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new ApiToolError('INVALID_TARGET', 'Only HTTP and HTTPS URLs are supported.', [
      'Change the URL to use http:// or https://.',
    ]);
  }
  if (!isAllowedHost(parsed.hostname)) {
    throw new ApiToolError('INVALID_TARGET', 'Only localhost-style development endpoints are allowed.', [
      'Use localhost, *.localhost, *.local, or Docker-local hostnames for this built-in tool.',
    ]);
  }
  if ((input.method === 'GET' || input.method === 'HEAD') && input.body) {
    throw new ApiToolError('INVALID_INPUT', `${input.method} requests do not support a request body in this tool.`, [
      'Switch to POST, PUT, PATCH, or DELETE if you need to send a payload.',
    ]);
  }
  return input;
}

function isAllowedHost(hostname: string): boolean {
  return hostname === 'localhost'
    || hostname === '127.0.0.1'
    || hostname === '::1'
    || hostname === 'host.docker.internal'
    || hostname === 'gateway.docker.internal'
    || hostname === 'kubernetes.docker.internal'
    || hostname.endsWith('.local')
    || hostname.endsWith('.localhost');
}

function buildRequestHeaders(input: ApiInput): Record<string, string> | undefined {
  const headers = { ...(input.headers ?? {}) };
  if (input.contentType && !Object.keys(headers).some((key) => key.toLowerCase() === 'content-type')) {
    headers['Content-Type'] = input.contentType;
  }
  return Object.keys(headers).length > 0 ? headers : undefined;
}

function executeRequest(input: ApiInput): ApiResult {
  const startedAt = Date.now();
  const requestHeaders = buildRequestHeaders(input);

  try {
    const response = cognia.http.request({
      method: input.method,
      url: input.url,
      headers: requestHeaders,
      body: input.body,
      contentType: input.contentType,
      timeoutMs: input.timeoutMs,
    });
    const latencyMs = Date.now() - startedAt;
    const maxBodyChars = input.maxBodyChars ?? DEFAULT_MAX_BODY_CHARS;
    const responseBytes = response.body.length;
    const responseBodyTruncated = responseBytes > maxBodyChars;
    const responseBody = responseBodyTruncated ? response.body.slice(0, maxBodyChars) : response.body;
    const ok = response.status >= 200 && response.status < 400;

    return {
      ok,
      method: input.method,
      url: input.url,
      requestHeaders,
      status: response.status,
      latencyMs,
      responseBody,
      responseJson: tryParseJson(response.body),
      responseHeaders: response.headers,
      responseBytes,
      responseBodyTruncated,
      errorCode: ok ? undefined : 'HTTP_STATUS_ERROR',
      message: ok ? 'HTTP request completed.' : `HTTP request returned status ${response.status}.`,
      recommendations: ok
        ? [
          'Inspect response headers and JSON payload to verify the local API contract.',
          'Lower maxBodyChars if you only need a shorter preview for large local responses.',
        ]
        : [
          'Inspect the bounded response body preview for error details.',
          'Verify the local service is running and the route accepts the supplied method and headers.',
        ],
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'HTTP request failed.';
    const latencyMs = Date.now() - startedAt;
    const timedOut = /timed out/i.test(message);
    return {
      ok: false,
      method: input.method,
      url: input.url,
      requestHeaders,
      latencyMs,
      errorCode: timedOut ? 'HTTP_TIMEOUT' : 'HTTP_REQUEST_FAILED',
      message,
      recommendations: timedOut
        ? [
          'Increase timeoutMs if the local API is expected to take longer to respond.',
          'Verify the local service is reachable and not paused in a debugger.',
        ]
        : [
          'Verify the local service is reachable on the selected hostname and port.',
          'Check whether the host permission allowlist matches the requested local-development hostname.',
        ],
    };
  }
}

function tryParseJson(value: string): unknown | undefined {
  try {
    return JSON.parse(value);
  } catch {
    return undefined;
  }
}

declare const module: { exports: unknown };

module.exports = {
  local_api_workbench,
  __test: {
    parseInput,
    isAllowedHost,
    executeRequest,
    normalizeMethod,
    validateInput,
    buildRequestHeaders,
  },
};
