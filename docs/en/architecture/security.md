# Security Design

CogniaLauncher's security model covers network communication, file system access, and permission control.

---

## Network Security

### HTTPS First

- Only HTTPS connections allowed by default
- `allow_http` setting is for development environments
- Certificate verification enabled by default

### Proxy Support

- HTTP/HTTPS proxy
- Proxy address configured in settings
- Proxy credentials are not logged

---

## Tauri Security

### Capability System

Tauri 2.x uses a capability system to control permissions:

```json
// src-tauri/capabilities/default.json
{
  "identifier": "default",
  "windows": ["main"],
  "permissions": [
    "core:default",
    "core:window:default",
    "core:window:allow-close",
    "core:window:allow-minimize",
    ...
  ]
}
```

### Principle of Least Privilege

- Only necessary window operation permissions are granted
- File system access is restricted to the application data directory
- Network requests are limited to known package source APIs

---

## Environment Variable Security

### Next.js Side

- Only variables with the `NEXT_PUBLIC_` prefix are exposed to the client
- `.env.local` is not committed to version control
- Production builds do not include development environment variables

### Tauri Side

- API Tokens stored in system credential manager or encrypted config
- Provider Tokens (e.g., GitHub Token) managed via settings
- Sensitive information is not output in logs

---

## Package Installation Security

### Checksum Verification

- Downloaded files support SHA256 checksum verification
- Cache files store checksums for deduplication verification
- Optional verification before installation

### Permission Elevation

Some operations require administrator privileges:

| Operation | Requires Elevation | Provider |
|-----------|-------------------|----------|
| System package install | Yes | apt, dnf, pacman, zypper |
| WSL management | Yes | wsl |
| Global package install | Partial | winget, chocolatey |
| User-level install | No | scoop, brew, npm, pip |

Providers declare whether they need elevation via the `requires_elevation()` method.

---

## Content Security Policy

!!! warning "To Be Completed"
    The current CSP in `tauri.conf.json` is set to null (common during development).
    A strict CSP policy should be configured before production release.

Recommended production CSP:

```
default-src 'self';
script-src 'self';
style-src 'self' 'unsafe-inline';
img-src 'self' data: https:;
connect-src 'self' https://registry.npmjs.org https://pypi.org;
```
