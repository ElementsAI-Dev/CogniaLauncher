# Software Design

This document records the core design philosophy and key algorithms of CogniaLauncher.

---

## Dependency Resolution Algorithm

CogniaLauncher uses the **PubGrub** algorithm for dependency resolution:

```mermaid
flowchart TD
    A[Input: Install Request List] --> B[Build Dependency Graph]
    B --> C{Version Conflict?}
    C -->|No| D[Generate Installation Plan]
    C -->|Yes| E[Conflict Analysis]
    E --> F[Learn Conflict Cause]
    F --> G[Backtrack]
    G --> C
    D --> H[Output: Ordered Installation Steps]
```

### Core Features

- **Completeness** — Guarantees finding a solution or proving none exists
- **Incremental** — Progressively adds constraints
- **Conflict Learning** — Avoids re-exploring the same conflict paths
- **Human-Readable Errors** — Generates understandable error messages on conflict

---

## Installation Orchestration

Multi-package installation uses an Orchestrator to coordinate:

```mermaid
sequenceDiagram
    participant User as User
    participant Batch as Batch Engine
    participant Resolver as Dependency Resolver
    participant Installer as Installer
    participant Provider as Provider

    User->>Batch: Batch Install Request
    Batch->>Resolver: Resolve Dependencies
    Resolver-->>Batch: Installation Plan
    loop For Each Package
        Batch->>Installer: Install Request
        Installer->>Provider: Execute Installation
        Provider-->>Installer: Install Result
        Installer-->>Batch: Install Receipt
    end
    Batch-->>User: Batch Result Report
```

### Installation Order

1. Topologically sort the dependency graph
2. Packages without dependencies can be installed in parallel
3. Packages with dependencies are installed in dependency order
4. A single package failure does not block unrelated packages

---

## Version Detection Priority

```mermaid
flowchart TD
    A[Find Version] --> B{Custom Detection Rule?}
    B -->|Match| C[Use Custom Rule Result]
    B -->|None| D{Project Version File?}
    D -->|Exists| E[Read Version File]
    D -->|None| F{CogniaLauncher Manifest?}
    F -->|Exists| G[Read Manifest Version]
    F -->|None| H{Global Version?}
    H -->|Exists| I[Use Global Version]
    H -->|None| J[Use System PATH Version]
```

### Custom Detection

Supports 9 extraction strategies:

| Strategy | Description | Example |
|----------|-------------|---------|
| Regex | Extract from text | `(\d+\.\d+\.\d+)` |
| JSON Path | Extract from JSON | `$.engines.node` |
| TOML Field | Extract from TOML | `tool.python.version` |
| YAML Path | Extract from YAML | `runtime.version` |
| Line Number | Extract from specific line | Line 3 |
| Environment Variable | Read env variable | `NODE_VERSION` |
| Command Output | Execute command to extract | `node --version` |
| Filename | Extract from filename | `python-3.11.tar.gz` |
| Fixed Value | Use a fixed version | `20.0.0` |

---

## Provider Selection Algorithm

Selection logic when multiple Providers are available for the same operation:

```mermaid
flowchart TD
    A[Operation Request] --> B[Get Available Provider List]
    B --> C{User-Specified Provider?}
    C -->|Yes| D[Use Specified Provider]
    C -->|No| E[Sort by Priority]
    E --> F[Select Highest Priority Available Provider]
    F --> G{is_available?}
    G -->|Yes| H[Execute Operation]
    G -->|No| I[Try Next]
    I --> F
```

---

## Health Check System

The health check system diagnoses environment and system issues:

1. **Environment Check** — Version file consistency, PATH configuration
2. **System Check** — Disk space, network connectivity
3. **Provider Check** — Provider availability, configuration correctness
4. **Fix Suggestions** — Generates fix actions for each issue

---

## Config Snapshots (Profiles)

The Profiles system manages environment configuration snapshots:

- **Create Snapshot** — Record all current environment versions
- **Restore Snapshot** — Batch switch to versions in the snapshot
- **Export/Import** — Share environment configuration across machines
- **Compare** — Diff two snapshots
