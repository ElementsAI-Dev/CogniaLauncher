# Spec Delta: Provider visibility and health checks

## MODIFIED Requirements

### Requirement: Provider Registry

The system SHALL maintain a registry of **known providers** for the current platform. Provider registration MUST NOT be gated by runtime availability checks.

#### Scenario: Registry contains providers even when not installed

- **WHEN** the provider registry is initialized
- **THEN** all supported providers for the current platform are present in `provider_list`
- **AND** providers that are not installed are marked unavailable via status/health checks rather than being absent

#### Scenario: Enabled/disabled does not remove providers from visibility

- **WHEN** a provider is disabled in settings
- **THEN** it still appears in `provider_list` and provider detail views
- **AND** it is excluded from automatic/batch operations that require enabled providers

## ADDED Requirements

### Requirement: Provider Status Enumeration

The system SHALL provide an endpoint that returns availability status for **all** known providers.

#### Scenario: Status covers all providers

- **WHEN** `provider_status_all` is called
- **THEN** the response includes one entry per provider returned by `provider_list`
- **AND** `installed` reflects `is_available()` independent of `enabled/disabled`

### Requirement: Package Manager Health Details

For providers that can act as system package providers, the system SHALL return real version/path/install details when possible.

#### Scenario: Health check includes version and executable path

- **WHEN** `health_check_package_managers` (or single-provider health) runs for a system-capable provider
- **THEN** the response includes `version` and `executable_path` when the provider supports them
- **AND** includes `install_instructions` when the provider can provide them

