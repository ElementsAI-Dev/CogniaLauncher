# CLAUDE.md - OpenSpec Module

[Root](../CLAUDE.md) > **openspec**

> Last Updated: 2026-01-15
> OpenSpec change management and specifications for CogniaLauncher

---

## Module Responsibility

This module contains **OpenSpec** specifications and change proposals for CogniaLauncher. OpenSpec is a spec-driven development methodology that maintains:

- **Current Specifications** (`specs/`) - The truth of what IS built
- **Change Proposals** (`changes/`) - What SHOULD change
- **Archived Changes** (`changes/archive/`) - Completed changes

---

## Directory Structure

```
openspec/
├── project.md              # Project conventions
├── AGENTS.md               # AI agent instructions (this file's source)
├── specs/                  # Current truth - what IS built
│   ├── platform-abstraction/
│   │   └── spec.md
│   ├── provider-system/
│   │   └── spec.md
│   ├── environment-management/
│   │   └── spec.md
│   ├── package-installation/
│   │   └── spec.md
│   ├── dependency-resolution/
│   │   └── spec.md
│   ├── configuration-system/
│   │   └── spec.md
│   ├── cache-management/
│   │   └── spec.md
│   └── ui-interface/
│       └── spec.md
└── changes/                # Proposals - what SHOULD change
    ├── archive/
    │   └── 2026-01-12-implement-cognialauncher-core/
    │       ├── proposal.md
    │       ├── design.md
    │       ├── tasks.md
    │       └── specs/
    │           ├── platform-abstraction/spec.md
    │           ├── provider-system/spec.md
    │           ├── environment-management/spec.md
    │           ├── package-installation/spec.md
    │           ├── dependency-resolution/spec.md
    │           ├── configuration-system/spec.md
    │           ├── ui-interface/spec.md
    │           └── cache-management/spec.md
```

---

## Specifications

### Current Capabilities

| Spec | Description | Key Requirements |
|------|-------------|------------------|
| **platform-abstraction** | Cross-platform FS, process, network, env operations | File system, process execution, HTTP downloads, environment variables |
| **provider-system** | Package provider registry and implementations | Provider trait, registry, environment providers, 30+ package providers |
| **environment-management** | Version management for Node.js, Python, Rust | List/install/uninstall versions, global/local switching |
| **package-installation** | Package install/uninstall/update operations | Search, install, uninstall, version selection |
| **dependency-resolution** | Dependency resolution with PubGrub algorithm | Constraint resolution, version comparison |
| **configuration-system** | Settings and configuration management | Get/set config, persistence, validation |
| **cache-management** | Download and metadata caching | SQLite backend, cleanup, verification |
| **ui-interface** | Frontend UI/UX specifications | Dashboard, environment/package pages, settings |

### Viewing Specifications

```bash
# List all specs
openspec list --specs

# Show specific spec
openspec show platform-abstraction

# View spec file directly
cat openspec/specs/platform-abstraction/spec.md
```

---

## Change Proposals

### Active Changes

Currently no active change proposals. All changes are archived.

### Archived Changes

| Change ID | Date | Description |
|-----------|------|-------------|
| `implement-cognialauncher-core` | 2026-01-12 | Initial implementation of core features |

### Viewing Changes

```bash
# List active changes
openspec list

# Show archived changes
ls openspec/changes/archive/

# View specific change
openspec show 2026-01-12-implement-cognialauncher-core

# View change proposal
cat openspec/changes/archive/2026-01-12-implement-cognialauncher-core/proposal.md
```

---

## OpenSpec Workflow

### Stage 1: Creating Changes

Create a proposal when you need to:
- Add features or functionality
- Make breaking changes (API, schema)
- Change architecture or patterns
- Optimize performance (changes behavior)
- Update security patterns

**Skip proposal for:**
- Bug fixes (restore intended behavior)
- Typos, formatting, comments
- Dependency updates (non-breaking)
- Configuration changes
- Tests for existing behavior

### Proposal Structure

```
changes/[change-id]/
├── proposal.md     # Why, what, impact
├── tasks.md        # Implementation checklist
├── design.md       # Technical decisions (optional)
└── specs/          # Delta changes
    └── [capability]/
        └── spec.md # ADDED/MODIFIED/REMOVED
```

### Stage 2: Implementing Changes

1. Read `proposal.md` - Understand what's being built
2. Read `design.md` (if exists) - Review technical decisions
3. Read `tasks.md` - Get implementation checklist
4. Implement tasks sequentially
5. Confirm completion - Ensure every item is finished
6. Update checklist - Mark all tasks as complete

### Stage 3: Archiving Changes

After deployment:
1. Move `changes/[name]/` to `changes/archive/YYYY-MM-DD-[name]/`
2. Update `specs/` if capabilities changed
3. Run `openspec validate --strict`

---

## Spec File Format

### Requirements

Every requirement MUST have at least one scenario:

```markdown
### Requirement: Feature Name
The system SHALL provide...

#### Scenario: Success case
- **WHEN** user performs action
- **THEN** expected result

#### Scenario: Error case
- **WHEN** invalid input provided
- **THEN** return error message
```

### Delta Operations

When creating change proposals, use these delta operations:

```markdown
## ADDED Requirements
### Requirement: New Feature
The system SHALL provide...

#### Scenario: Success
- **WHEN** condition
- **THEN** result

## MODIFIED Requirements
### Requirement: Existing Feature
[Complete modified requirement]

## REMOVED Requirements
### Requirement: Old Feature
**Reason**: [Why removing]
**Migration**: [How to handle]
```

---

## CLI Commands

```bash
# Essential commands
openspec list                  # List active changes
openspec list --specs          # List specifications
openspec show [item]           # Display change or spec
openspec validate [item]       # Validate changes or specs
openspec archive <change-id>   # Archive after deployment

# Project management
openspec init [path]           # Initialize OpenSpec
openspec update [path]         # Update instruction files

# Interactive mode
openspec show                  # Prompts for selection
openspec validate              # Bulk validation mode

# Debugging
openspec show [change] --json --deltas-only
openspec validate [change] --strict
```

### Command Flags

- `--json` - Machine-readable output
- `--type change|spec` - Disambiguate items
- `--strict` - Comprehensive validation
- `--no-interactive` - Disable prompts
- `--skip-specs` - Archive without spec updates
- `--yes`/`-y` - Skip confirmation prompts

---

## Best Practices

### Simplicity First

- Default to <100 lines of new code
- Single-file implementations until proven insufficient
- Avoid frameworks without clear justification
- Choose boring, proven patterns

### Capability Naming

- Use verb-noun: `user-auth`, `payment-capture`
- Single purpose per capability
- 10-minute understandability rule
- Split if description needs "AND"

### Change ID Naming

- Use kebab-case, short and descriptive: `add-two-factor-auth`
- Prefer verb-led prefixes: `add-`, `update-`, `remove-`, `refactor-`
- Ensure uniqueness; if taken, append `-2`, `-3`, etc.

### Clear References

- Use `file.ts:42` format for code locations
- Reference specs as `specs/auth/spec.md`
- Link related changes and PRs

---

## Creating a New Change

### Step-by-Step

1. **Review context:**
   ```bash
   openspec list --specs
   openspec list
   ```

2. **Choose change-id and scaffold:**
   ```bash
   CHANGE=add-new-provider
   mkdir -p openspec/changes/$CHANGE/specs/provider-system
   ```

3. **Write proposal.md:**
   ```markdown
   # Change: Add new provider

   ## Why
   Need to support XYZ package manager

   ## What Changes
   - Add XYZ provider implementation
   - Register in provider registry

   ## Impact
   - Affected specs: provider-system
   - Affected code: src-tauri/src/provider/
   ```

4. **Write tasks.md:**
   ```markdown
   ## 1. Implementation
   - [ ] 1.1 Create provider struct
   - [ ] 1.2 implement Provider trait
   - [ ] 1.3 Register in lib.rs
   - [ ] 1.4 Add tests
   ```

5. **Write spec deltas:**
   ```markdown
   ## ADDED Requirements
   ### Requirement: XYZ Provider
   The system SHALL provide an XYZ provider for managing packages...

   #### Scenario: Search packages
   - **WHEN** searching via XYZ provider
   - **THEN** return matching packages
   ```

6. **Validate:**
   ```bash
   openspec validate $CHANGE --strict
   ```

7. **Request approval** before implementation

---

## Validation

### Common Errors

**"Change must have at least one delta"**
- Check `changes/[name]/specs/` exists with .md files
- Verify files have operation prefixes (## ADDED Requirements)

**"Requirement must have at least one scenario"**
- Check scenarios use `#### Scenario:` format (4 hashtags)
- Don't use bullet points or bold for scenario headers

**Silent scenario parsing failures**
- Exact format required: `#### Scenario: Name`
- Debug with: `openspec show [change] --json --deltas-only`

### Validation Tips

```bash
# Always use strict mode for comprehensive checks
openspec validate [change] --strict

# Debug delta parsing
openspec show [change] --json | jq '.deltas'

# Check specific requirement
openspec show [spec] --json -r 1
```

---

## Related Documentation

- [AGENTS.md](./AGENTS.md) - Full OpenSpec instructions for AI agents
- [project.md](./project.md) - Project conventions
- [Root CLAUDE.md](../CLAUDE.md) - Project context
- [Tauri Backend CLAUDE.md](../src-tauri/CLAUDE.md) - Backend documentation
