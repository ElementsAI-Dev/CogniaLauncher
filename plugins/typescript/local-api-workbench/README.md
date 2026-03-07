# Local API Workbench (TypeScript Built-in Plugin)

Built-in plugin for richer local-development HTTP diagnostics without leaving CogniaLauncher.

## Tool

- `local-api-workbench`

## Supported workflow

- Methods: `GET`, `POST`, `PUT`, `PATCH`, `DELETE`, `HEAD`
- Request options:
  - `url`
  - `headers`
  - `body`
  - `contentType`
  - `timeoutMs`
  - `maxBodyChars` for bounded response previews
- Safe local targets only:
  - `localhost`
  - `*.localhost`
  - `*.local`
  - `host.docker.internal`
  - `gateway.docker.internal`
  - `kubernetes.docker.internal`

## Input

```json
{
  "method": "PATCH",
  "url": "http://api.localhost:3000/users/123",
  "headers": {
    "Authorization": "Bearer local-token",
    "X-Trace-Id": "trace-1"
  },
  "body": "{\"enabled\":true}",
  "contentType": "application/json",
  "timeoutMs": 2500,
  "maxBodyChars": 512
}
```

You can also pass a raw URL string for a default `GET`.

## Output

- `ok`
- `method`
- `url`
- `requestHeaders`
- `status`
- `latencyMs`
- `responseBody`
- `responseBodyTruncated`
- `responseBytes`
- `responseHeaders`
- `responseJson` when the full response body parses as JSON
- `errorCode`, `message`, and `recommendations[]` on failure

## Notes

- `GET` / `HEAD` requests reject request bodies.
- Large response bodies are truncated to the configured `maxBodyChars` preview.
- Non-2xx/3xx HTTP responses return deterministic `HTTP_STATUS_ERROR` diagnostics.

## Permissions

- `http` restricted to loopback and common local-development host patterns.
