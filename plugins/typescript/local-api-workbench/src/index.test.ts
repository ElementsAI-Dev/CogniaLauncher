const mockGet = jest.fn(() => ({ status: 200, body: '{"ok":true}' }));
const mockPost = jest.fn(() => ({ status: 201, body: '{"created":true}' }));
const mockRequest = jest.fn(() => ({
  status: 200,
  body: '{"ok":true,"message":"response payload"}',
  headers: {
    'content-type': 'application/json',
    'x-trace-id': 'trace-1',
  },
}));

jest.mock('@cognia/plugin-sdk', () => ({
  cognia: {
    http: {
      get: mockGet,
      post: mockPost,
      request: mockRequest,
    },
    log: {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    },
  },
}));

const plugin = require('./index');
const testApi = plugin.__test;

describe('local-api-workbench helpers', () => {
  beforeEach(() => {
    mockGet.mockClear();
    mockPost.mockClear();
    mockRequest.mockClear();
  });

  it('defaults to localhost health check', () => {
    expect(testApi.parseInput('')).toEqual({
      method: 'GET',
      url: 'http://localhost:3000/health',
      timeoutMs: 5000,
      maxBodyChars: 4000,
    });
  });

  it('rejects remote hosts', () => {
    expect(() => testApi.parseInput('https://example.com/api')).toThrow('Only localhost-style development endpoints are allowed.');
  });

  it('uses GET and parses JSON responses', () => {
    const result = testApi.executeRequest({
      method: 'GET',
      url: 'http://localhost:3000/health',
    });
    expect(mockRequest).toHaveBeenCalledWith({
      method: 'GET',
      url: 'http://localhost:3000/health',
      headers: undefined,
      body: undefined,
      contentType: undefined,
      timeoutMs: undefined,
    });
    expect(result.responseJson).toEqual(expect.objectContaining({ ok: true }));
  });

  it('parses richer request authoring input', () => {
    expect(testApi.parseInput(JSON.stringify({
      method: 'PATCH',
      url: 'http://api.localhost:3000/users',
      headers: {
        Authorization: 'Bearer token',
        'X-Trace-Id': 'trace-1',
      },
      body: '{"name":"cognia"}',
      contentType: 'application/json',
      timeoutMs: 2500,
      maxBodyChars: 12,
    }))).toEqual({
      method: 'PATCH',
      url: 'http://api.localhost:3000/users',
      headers: {
        Authorization: 'Bearer token',
        'X-Trace-Id': 'trace-1',
      },
      body: '{"name":"cognia"}',
      contentType: 'application/json',
      timeoutMs: 2500,
      maxBodyChars: 12,
    });
  });

  it('returns bounded response metadata for generic requests', () => {
    const result = testApi.executeRequest({
      method: 'PATCH',
      url: 'http://api.localhost:3000/users',
      headers: { 'X-Trace-Id': 'trace-1' },
      body: '{"name":"cognia"}',
      contentType: 'application/json',
      timeoutMs: 2500,
      maxBodyChars: 12,
    });

    expect(mockRequest).toHaveBeenCalledWith({
      method: 'PATCH',
      url: 'http://api.localhost:3000/users',
      headers: {
        'X-Trace-Id': 'trace-1',
        'Content-Type': 'application/json',
      },
      body: '{"name":"cognia"}',
      contentType: 'application/json',
      timeoutMs: 2500,
    });
    expect(result.responseBody).toHaveLength(12);
    expect(result.responseBodyTruncated).toBe(true);
    expect(result.responseBytes).toBeGreaterThan(12);
    expect(result.responseHeaders).toEqual({
      'content-type': 'application/json',
      'x-trace-id': 'trace-1',
    });
  });

  it('maps non-success HTTP status into deterministic diagnostics', () => {
    mockRequest.mockReturnValueOnce({
      status: 503,
      body: 'service unavailable',
      headers: {
        'content-type': 'text/plain',
      },
    });

    const result = testApi.executeRequest({
      method: 'POST',
      url: 'http://gateway.docker.internal:3000/reindex',
      body: '{"force":true}',
      contentType: 'application/json',
    });

    expect(result.ok).toBe(false);
    expect(result.errorCode).toBe('HTTP_STATUS_ERROR');
    expect(result.status).toBe(503);
    expect(result.message).toContain('503');
  });
});
