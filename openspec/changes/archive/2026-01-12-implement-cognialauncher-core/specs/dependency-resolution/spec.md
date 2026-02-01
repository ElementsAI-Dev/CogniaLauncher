# Dependency Resolution Capability

## ADDED Requirements

### Requirement: Version Parsing

The system SHALL parse semantic versions and version constraints in multiple formats.

#### Scenario: Parse semver version

- **WHEN** parsing a version string "1.2.3" or "1.2.3-beta.1+build.123"
- **THEN** the system extracts major, minor, patch, prerelease, and build metadata

#### Scenario: Parse version constraint

- **WHEN** parsing constraints like "^1.2.3", "~1.2.0", ">=1.0.0 <2.0.0", "1.x"
- **THEN** the system creates an appropriate constraint object

### Requirement: Version Comparison

The system SHALL compare versions according to semantic versioning rules.

#### Scenario: Compare versions

- **WHEN** comparing two versions
- **THEN** the system returns correct ordering (1.0.0 < 1.0.1 < 1.1.0 < 2.0.0)

#### Scenario: Prerelease ordering

- **WHEN** comparing prerelease versions
- **THEN** 1.0.0-alpha < 1.0.0-beta < 1.0.0

### Requirement: Constraint Matching

The system SHALL check if a version satisfies a given constraint.

#### Scenario: Caret constraint matching

- **WHEN** checking if version matches "^1.2.3"
- **THEN** 1.2.3, 1.2.4, 1.9.0 match, but 2.0.0 does not

#### Scenario: Tilde constraint matching

- **WHEN** checking if version matches "~1.2.3"
- **THEN** 1.2.3, 1.2.9 match, but 1.3.0 does not

#### Scenario: Range constraint matching

- **WHEN** checking if version matches ">=1.0.0 <2.0.0"
- **THEN** 1.0.0, 1.5.0 match, but 0.9.0 and 2.0.0 do not

### Requirement: Dependency Resolution Algorithm

The system SHALL resolve dependencies using the PubGrub algorithm to find compatible versions.

#### Scenario: Simple resolution

- **WHEN** resolving dependencies for a package with non-conflicting requirements
- **THEN** the system returns a map of package names to resolved versions

#### Scenario: Conflict detection

- **WHEN** dependencies have conflicting version requirements
- **THEN** the system returns an error explaining the conflict

#### Scenario: Resolution with lockfile

- **WHEN** resolving with an existing lockfile
- **THEN** the system prefers locked versions when they satisfy constraints

### Requirement: Conflict Explanation

The system SHALL provide human-readable explanations for dependency conflicts.

#### Scenario: Explain conflict chain

- **WHEN** a conflict is detected
- **THEN** the system explains which packages have conflicting requirements
- **AND** suggests possible resolutions
