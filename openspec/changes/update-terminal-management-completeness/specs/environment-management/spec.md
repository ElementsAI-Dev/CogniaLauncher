# Spec Delta: Environment activation in terminal profile launch

## MODIFIED Requirements

### Requirement: Environment Variable Modifications

The system SHALL generate and apply the necessary environment variable modifications when activating a specific version, including terminal profile launch flows.

#### Scenario: Generate PATH modifications

- **WHEN** activating a specific environment version
- **THEN** the system returns PATH additions/modifications needed

#### Scenario: Generate environment-specific variables

- **WHEN** activating Rust toolchain
- **THEN** the system returns RUSTUP_HOME and CARGO_HOME modifications

#### Scenario: Apply modifications during terminal profile launch

- **WHEN** a terminal profile defines `envType` and a resolved version (`envVersion` or detected from `cwd`)
- **THEN** profile launch applies environment modifications before process execution
- **AND** returns a clear error when version resolution is required but unavailable
