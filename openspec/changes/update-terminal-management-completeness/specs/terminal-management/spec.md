# Spec Delta: Terminal management completeness

## ADDED Requirements

### Requirement: Profile Launch Compatibility and Structured Results

The system SHALL provide a backward-compatible profile launch command and a structured launch command for terminal profiles.

#### Scenario: Backward-compatible launch output

- **WHEN** `terminal_launch_profile` is invoked for a profile
- **THEN** the command executes the same launch pipeline as the structured launch path
- **AND** returns `stdout` as string for compatibility

#### Scenario: Structured launch output

- **WHEN** `terminal_launch_profile_detailed` is invoked for a profile
- **THEN** the command returns `exitCode`, `stdout`, `stderr`, and `success`
- **AND** does not require frontend parsing of ad-hoc text to infer failure

### Requirement: Complete Profile Context Application

The system SHALL apply full profile context during launch, including shell resolution, working directory, and optional environment activation.

#### Scenario: Shell id resolution supports detected shell entries

- **WHEN** a profile references a shell id detected by runtime shell scanning (for example `gitbash`)
- **THEN** the launcher resolves executable path from detected shell info before fallback mapping

#### Scenario: Working directory is applied

- **WHEN** a profile defines `cwd`
- **THEN** the launched process uses that working directory

#### Scenario: Environment activation uses envType/envVersion

- **WHEN** a profile defines `envType` and `envVersion`
- **THEN** launch applies environment modifications returned by `EnvironmentManager`

#### Scenario: Environment version detection fallback

- **WHEN** a profile defines `envType` without `envVersion`
- **THEN** launch attempts version detection from profile `cwd`
- **AND** returns a clear validation error if no version can be resolved

### Requirement: Deterministic Environment Variable Precedence

The system SHALL apply launch-time environment variables in deterministic precedence order.

#### Scenario: Variable precedence on collisions

- **WHEN** the same environment variable key exists in environment manager output, proxy env, and profile env
- **THEN** effective value precedence is: environment manager < proxy env < profile env

### Requirement: Terminal Profile Launch Feedback in UI

The UI SHALL present terminal profile launch status and output based on structured launch results.

#### Scenario: Success/failure feedback and output visibility

- **WHEN** a profile launch completes
- **THEN** the UI indicates success/failure using structured result fields
- **AND** displays latest `stdout` / `stderr` / `exitCode` in profile section
- **AND** allows clearing latest launch output state
