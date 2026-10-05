---
id: task-20260914-gitlab-pipeline
title: Adapt GitLab validation and releases for Pulsed
type: maintenance
priority: normal
effort: cake
creator: codex
owner: codex
created: 2026-09-14
---

## Problem

The copied Ivy pipeline references Ivy commands and artifact names, while Pulsed's
release configuration still publishes to GitHub.

## Done when

- Merge requests and the default branch validate commits, report npm audits,
  check Go formatting, vet, race-test, and build all six supported binary targets.
- GitLab releases build binaries with the selected release tag and publish stable
  asset links plus checksums.
- Package scripts, lockfile, deployment download links, and setup docs agree.
- Available local checks and GitLab pipeline lint are attempted and recorded.

## 2026-10-05 pipeline repair

- Reproduced the npm 10 clean-install error: `Missing: meow@14.1.0 from lock file`.
  Regenerated the lockfile and restored `npm ci` for validation and release.
- Updated obsolete semantic-release plugins and Nuxt; Nuxt 4 supports the
  existing Pages `app/` layout, which failed under Nuxt 3 with missing CSS.
- Rebuilt embedded Pages assets. Node 22.23.3/npm 10.9.9 clean installation, all
  nine UI tests, Pages build/typecheck, and release-plugin smoke checks pass.
- The audit dropped from 69 findings to 22 (21 high, one moderate). Remaining
  upstream and bundled npm advisories are recorded in the build documentation.
  At the user's request, audit is a visible nonblocking job; other checks remain
  required.
- GitLab's CI lint API accepted the updated configuration. Real Linux runner
  execution and authenticated publishing have not been verified locally. This
  task remains in progress for that validation.
