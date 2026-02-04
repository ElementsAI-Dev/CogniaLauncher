# Spec Delta: Onboarding Guide

## ADDED Requirements

### Requirement: First-Run Onboarding Wizard

The system SHALL present a multi-step onboarding wizard on first launch that introduces core setup tasks and navigation.

#### Scenario: Show onboarding on first launch

- **WHEN** the application is opened for the first time
- **THEN** the onboarding wizard is displayed before the user interacts with main navigation

#### Scenario: Wizard covers core setup

- **WHEN** the user progresses through onboarding steps
- **THEN** the wizard presents language selection, theme preferences, environment detection, mirror configuration, and shell initialization guidance

### Requirement: Onboarding Progress Persistence

The system SHALL persist onboarding progress and completion state across sessions.

#### Scenario: Resume onboarding after restart

- **WHEN** the user closes the app mid-onboarding
- **THEN** the next launch resumes at the last incomplete step

#### Scenario: Skip onboarding

- **WHEN** the user skips onboarding
- **THEN** the system records the skip state and allows re-running onboarding later

### Requirement: Guided Tour

The system SHALL provide an optional guided tour highlighting core navigation and key pages.

#### Scenario: Start guided tour

- **WHEN** the user chooses to start the guided tour
- **THEN** the system highlights the sidebar navigation and primary pages with step-by-step tips

#### Scenario: Complete guided tour

- **WHEN** the user completes the tour
- **THEN** the system records completion and does not auto-start the tour again

### Requirement: Re-run Onboarding from Settings

The system SHALL provide a settings control to re-run onboarding and reset its progress.

#### Scenario: Re-run onboarding

- **WHEN** the user selects the re-run onboarding action in Settings
- **THEN** the onboarding wizard restarts from the first step
