# Configuration

CogniaLauncher provides a flexible configuration system covering network, cache, providers, appearance, and more.

---

## Application Settings

Configure via the **Settings** page (gear icon at the bottom of the sidebar).

### General Settings

| Setting | Description | Default |
|---------|-------------|---------|
| Language | Interface language | System language |
| Parallel Downloads | Number of concurrent download tasks | 4 |
| Resolve Strategy | Version resolution strategy (latest/minimal/locked) | latest |
| Metadata Cache TTL | Metadata cache expiration time (seconds) | 3600 |

### Network Settings

| Setting | Description | Default |
|---------|-------------|---------|
| Timeout | Network request timeout (seconds) | 30 |
| Retries | Number of failure retries | 3 |
| Proxy | HTTP/HTTPS proxy address | None |

### Cache Settings

| Setting | Description | Default |
|---------|-------------|---------|
| Max Cache Size | Cache size limit | Unlimited |
| Max Cache Age | Cache expiration (days) | Unlimited |
| Auto Clean | Automatically clean expired cache | Off |
| Clean Threshold | Threshold to trigger auto-clean | 80% |
| Monitor Interval | Cache monitoring check interval (seconds) | 300 |

---

## Backend Configuration File

The backend uses a TOML configuration file located at `~/.CogniaLauncher/config/config.toml`.

### Main Configuration File Example

```toml
[general]
parallel_downloads = 4
resolve_strategy = "latest"
auto_update_metadata = true
metadata_cache_ttl = 3600

[network]
timeout = 30
retries = 3
# proxy = "http://proxy.example.com:8080"

[mirrors]
[mirrors.npm]
url = "https://registry.npmmirror.com"
priority = 100

[mirrors.pypi]
url = "https://pypi.tuna.tsinghua.edu.cn/simple"
priority = 100

[providers]
[providers.brew]
enabled = true
priority = 100

[providers.winget]
enabled = true
priority = 100

[providers.github]
enabled = true
# token = "ghp_xxxx"  # Optional, increases API rate limit

[security]
allow_http = false
verify_certificates = true
allow_self_signed = false
```

---

## Mirror Configuration

CogniaLauncher supports configuring mirrors for different package sources to accelerate downloads in regions like mainland China.

### Common Mirrors

| Source | Mirror URL |
|--------|-----------|
| npm | `https://registry.npmmirror.com` |
| PyPI | `https://pypi.tuna.tsinghua.edu.cn/simple` |
| crates.io | `https://rsproxy.cn/crates.io-index` |
| Homebrew | `https://mirrors.ustc.edu.cn/brew.git` |

Configure in the **Mirrors** section of the Settings page, or edit the `[mirrors]` section in `config.toml` directly.

---

## Environment Variables

### Next.js Environment Variables

Create a `.env.local` file:

```env
NEXT_PUBLIC_API_URL=https://api.example.com
NEXT_PUBLIC_APP_NAME=CogniaLauncher
```

!!! warning "Security Note"
    - Only variables with the `NEXT_PUBLIC_` prefix are exposed to the browser
    - Do not commit `.env.local` to version control

### Tauri Configuration

Edit `src-tauri/tauri.conf.json`:

```json
{
  "productName": "CogniaLauncher",
  "version": "0.1.0",
  "identifier": "com.cognia.launcher",
  "build": {
    "frontendDist": "../out",
    "devUrl": "http://localhost:3000"
  }
}
```

---

## Path Aliases

The project uses the following TypeScript path aliases:

| Alias | Maps To |
|-------|---------|
| `@/components` | `components/` |
| `@/lib` | `lib/` |
| `@/ui` | `components/ui/` |
| `@/hooks` | `hooks/` |
| `@/utils` | `lib/utils.ts` |

Usage:

```typescript
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
```

---

## Appearance Configuration

### Theme

Supports light/dark mode switching, implemented via CSS `class` strategy.

### Accent Color

Choose different accent color schemes in settings to personalize the interface.

### Chart Color Theme

Supports 6 chart color themes: default, vibrant, pastel, ocean, sunset, monochrome.

Configure in the **Appearance** section of the Settings page.
