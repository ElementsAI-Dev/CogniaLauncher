# environment-management Specification

## Purpose
TBD - created by archiving change implement-cognialauncher-core. Update Purpose after archive.
## Requirements
### Requirement: Version Detection

The system SHALL automatically detect the required environment version by traversing the directory tree looking for version files and manifest configurations.

#### Scenario: Detect version from local file

- **WHEN** a version file exists in the current or parent directory (e.g., .node-version, .python-version)
- **THEN** the system returns the version specified in that file

#### Scenario: Detect version from manifest

- **WHEN** a CogniaLauncher.yaml manifest exists with environment specifications
- **THEN** the system returns the version constraint from the manifest

#### Scenario: Fall back to global version

- **WHEN** no local version file or manifest is found
- **THEN** the system returns the globally configured version

### Requirement: Global Version Management

The system SHALL allow setting a global default version for each environment type.

#### Scenario: Set global version

- **WHEN** setting a global version for an environment (e.g., Node.js 20)
- **THEN** the system updates the global version file
- **AND** updates shell configuration if needed

#### Scenario: Get current global version

- **WHEN** querying the current global version
- **THEN** the system returns the version from the global version file

### Requirement: Project-Local Version Management

The system SHALL allow setting project-specific versions that override global settings.

#### Scenario: Set local version

- **WHEN** setting a local version in a project directory
- **THEN** the system creates/updates the appropriate version file (.node-version, .python-version, etc.)

#### Scenario: Local version takes precedence

- **WHEN** both local and global versions are set
- **THEN** the local version takes precedence within the project directory

### Requirement: Environment Variable Modifications

The system SHALL generate the necessary environment variable modifications to activate a specific version.

#### Scenario: Generate PATH modifications

- **WHEN** activating a specific environment version
- **THEN** the system returns PATH additions/modifications needed

#### Scenario: Generate environment-specific variables

- **WHEN** activating Rust toolchain
- **THEN** the system returns RUSTUP_HOME and CARGO_HOME modifications

### Requirement: Shim Mechanism

The system SHALL provide shim executables that transparently route to the correct version based on context.

#### Scenario: Shim detects and delegates

- **WHEN** a shim (e.g., ~/.CogniaLauncher/bin/node) is executed
- **THEN** it detects the appropriate version based on current directory
- **AND** delegates to the actual binary for that version

#### Scenario: Shim passes arguments

- **WHEN** a shim is called with arguments
- **THEN** all arguments are passed through to the delegated binary

