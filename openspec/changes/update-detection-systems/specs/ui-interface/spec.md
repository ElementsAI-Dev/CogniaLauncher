# Spec Delta: UI alignment for detection systems

## MODIFIED Requirements

### Requirement: Package Management UI

The system SHALL surface all known providers in the Providers UI, even if they are not installed.

#### Scenario: Providers list shows installed and not installed

- **WHEN** the user opens the Providers page
- **THEN** all known providers for the platform are visible
- **AND** each provider displays an installed/available status

### Requirement: Environment Management UI

The environment UI SHALL display detected project versions using logical environment types and concrete source labels.

#### Scenario: Display detected version source

- **WHEN** a project version is detected for an environment type
- **THEN** the UI shows `env_type` as a logical type (e.g., `node`)
- **AND** shows the concrete `source` label (e.g., `.nvmrc`, `global.json (sdk.version)`)

