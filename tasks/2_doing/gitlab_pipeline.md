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

- Merge requests and the default branch validate commits, audit npm tooling,
  check Go formatting, vet, race-test, and build all six supported binary targets.
- GitLab releases build binaries with the selected release tag and publish stable
  asset links plus checksums.
- Package scripts, lockfile, deployment download links, and setup docs agree.
- Available local checks and GitLab pipeline lint are attempted and recorded.
