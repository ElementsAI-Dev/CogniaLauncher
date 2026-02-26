# Spec Delta: Terminal proxy key visibility in configuration listing

## MODIFIED Requirements

### Requirement: Configuration Commands

The system SHALL provide commands to view and modify configuration values, including terminal proxy settings in list output.

#### Scenario: Get configuration value

- **WHEN** requesting a configuration value by key
- **THEN** the system returns the current value

#### Scenario: Set configuration value

- **WHEN** setting a configuration value
- **THEN** the system validates and persists the new value

#### Scenario: List all configuration

- **WHEN** listing configuration
- **THEN** the system returns all configuration keys and their values
- **AND** includes terminal proxy keys (`terminal.proxy_mode`, `terminal.custom_proxy`, `terminal.no_proxy`)
