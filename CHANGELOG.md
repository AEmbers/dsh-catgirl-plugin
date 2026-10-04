# Changelog

## [0.2.1] - 2026-10-04

### Changed

- `dsh.compatibility` added: `dsh: ">=0.2.0-rc.1"` + the three `dshReleases` entries.
- `engines.dsh` added: `">=0.2.0-rc.1"` (`engines.node` untouched).

For the Desktop-host transition window: the currently shipped Desktop application bundles the **0.2.0-rc.2** core and cannot be upgraded from a profile (the core comes from `app.asar`), so the compatibility window deliberately spans both `0.2.0-rc.2` and `0.2.1-alpha.1` instead of pinning only the newer release.

Verified installed, booted, and mounted on both cores (`C:\Sophia\_compat021` = 0.2.1-alpha.1, `C:\Sophia\_compat020` = 0.2.0-rc.2). No plugin behaviour was changed.

## 0.2.0 - 2026-09-05

- Share one Markdown-safe decoration core between headless and Web renderers.
- Keep the terminal kaomoji hidden until Web streaming completes.
- Add Coding, Normal, and Chat tool profiles with configurable escalation.
- Make the Web client installable, type-checkable, buildable, and packable without unpublished DSH packages.
- Make composition and quality tests portable across local checkouts.
- Add complete server/client CI and tag-driven npm/GitHub release automation.

## 0.1.1 - 2026-08-21

- Harden tool unlocking and renderer lifecycle behavior.
- Improve package metadata, documentation, and CI compatibility.

## 0.1.0 - 2026-08-15

- Initial npm release.
