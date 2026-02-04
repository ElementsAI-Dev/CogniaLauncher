# Custom Detection System

## 1. Identity

- **What it is:** A rule-based version detection system allowing users to define custom patterns for detecting environment versions from project files.
- **Purpose:** Extend built-in version detection to support custom file formats, extraction patterns, and version transformation rules.

## 2. High-Level Description

The Custom Detection System enables users to create and manage detection rules that specify how to extract version information from arbitrary files. Rules define file patterns (glob), extraction strategies (regex, JSON path, TOML path, YAML path, XML path, plain text, .tool-versions, INI keys, or command output), and optional version transformations. The system includes 8 built-in preset rules for common scenarios (Dockerfile, GitHub Actions, Pipfile, Cargo.toml, gradle.properties) and supports importing/exporting rules as JSON for sharing.
