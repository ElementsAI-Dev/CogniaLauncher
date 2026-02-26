# Spec Delta: WSL management completeness

## ADDED Requirements

### Requirement: Runtime Capability Detection

The system SHALL detect available WSL features at runtime and expose capability metadata to frontend workflows.

#### Scenario: Capability metadata returned

- **WHEN** WSL capability information is requested
- **THEN** the response includes support flags for manage subcommands and advanced options
- **AND** includes parsed version details when available

#### Scenario: Capability-aware UI behavior

- **WHEN** a WSL operation depends on unsupported command features
- **THEN** the UI does not execute the unsupported command path
- **AND** the user sees a clear unsupported reason and fallback behavior when applicable

### Requirement: Compatibility and Fallback Execution

The system SHALL prefer modern WSL command paths while preserving compatible fallback behavior for older or unsupported environments.

#### Scenario: Running distro listing is robust

- **WHEN** listing running distributions
- **THEN** the system first uses `wsl --list --running --quiet`
- **AND** falls back to locale-aware parsing only if needed

#### Scenario: Default user update fallback

- **WHEN** changing a distribution default user
- **THEN** the system prefers `wsl --manage <distro> --set-default-user <user>`
- **AND** falls back to legacy distro launcher or config-based strategy if unsupported

### Requirement: Advanced Manage Operations

The system SHALL support advanced manage operations for WSL distributions through backend commands and desktop UI flows.

#### Scenario: Move distribution

- **WHEN** a user triggers move for a distribution with valid destination path
- **THEN** the system executes `wsl --manage <distro> --move <location>`
- **AND** reports operation result with actionable error details on failure

#### Scenario: Resize distribution disk

- **WHEN** a user requests distribution disk resize with valid memory string
- **THEN** the system executes `wsl --manage <distro> --resize <size>`
- **AND** reports operation result with actionable error details on failure

### Requirement: High-risk Operation Safeguards

The system SHALL apply explicit safety UX for high-risk WSL operations that can cause data loss or significant system impact.

#### Scenario: Confirmation required before high-risk action

- **WHEN** a user invokes unregister, resize, move, mount/unmount, or full shutdown action
- **THEN** the UI requires explicit confirmation before execution
- **AND** displays risk and permission hints relevant to the operation

#### Scenario: Error visibility for failure

- **WHEN** a high-risk operation fails
- **THEN** the UI displays human-readable summary
- **AND** includes stderr-derived details to support troubleshooting

### Requirement: WSL Surface Completeness

The system SHALL expose existing WSL backend capabilities in UI where applicable, with capability gating and safe defaults.

#### Scenario: Existing backend actions are UI-reachable

- **WHEN** using desktop WSL management UI
- **THEN** users can access install WSL-only, set default version, import-in-place, mount/unmount, and sparse toggle operations
- **AND** each action follows capability checks and safety constraints

