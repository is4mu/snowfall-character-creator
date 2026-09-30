# Security Policy

## Supported versions

Snowfall Character Creator is currently pre-release software. Until the first supported release is published, security fixes are applied to the latest development version only.

## Reporting a vulnerability

Please do **not** disclose suspected security vulnerabilities in public GitHub issues, discussions, or pull requests.

Use GitHub's private vulnerability reporting feature for this repository when available. If private reporting is unavailable, contact the repository owner through a non-public channel listed on their GitHub profile.

When reporting, include as much of the following as practical:

- affected component or file;
- reproduction steps;
- expected and observed behavior;
- potential impact;
- relevant environment details;
- a minimal proof of concept if it is safe to share privately.

Please avoid accessing data that does not belong to you, disrupting services, or performing destructive testing.

## Scope considerations

Potential security-sensitive areas may include:

- import and parsing of untrusted character files;
- schema validation bypasses;
- path or file handling;
- unsafe deserialization;
- generated content passed to external systems;
- dependency vulnerabilities;
- future plugin, adapter, or web application surfaces.

Character data should be treated as untrusted input unless its source is explicitly trusted.

## Secrets and personal data

Do not commit API keys, credentials, private tokens, or personal information to this repository.

The project is intended for fictional character creation. Security or privacy concerns involving attempts to profile, identify, or reconstruct real people should be reported privately when they expose a technical vulnerability.
