---
id: task-20260914-responsive-dashboard
title: Make the cluster dashboard readable across screen and core counts
type: feature
priority: urgent
effort: night
creator: codex
owner: codex
created: 2026-09-14
---

## Problem

Per-core terminal rows and viewport-scaled fonts make large machines and large
clusters overwhelm the browser dashboard.

## Done when

- Readable responsive node cards retain the terminal-inspired style and palettes.
- CPU and memory summaries stay compact regardless of core count; every core is
  available in bounded, expandable detail.
- Search, sorting, density, and freshness filters make mixed clusters manageable.
- Refresh and peer navigation retain inspection state, including expanded cores
  and scroll position; refreshing can be paused.
- Regression checks cover small and large machines, missing metrics, offline
  nodes, and existing peer-routing and version behavior.

## Scope

Browser presentation only. This is the current-state navigation slice of
`task-20260529-history-navigation-ui`; history and terminal rendering remain
separate work.

## Completed

- Browser cards use CSS grid and fixed readable typography; Comfortable and
  Compact densities work from 320 to 2,560 pixels.
- At most 32 contiguous CPU bands show each group's peak. Native details expose
  every logical CPU inside a 280px scroll region.
- Added name filtering and retained metric sorting, freshness filters, and all
  appearance palettes.
- Refresh and peer navigation carry view state through the URL fragment, including
  expanded cores and scroll positions. Storage failure is tolerated.
- Kept same-node proxy query routing on refresh and fixed fragment-only navigation
  so refresh actually requests a new document.

## Validation

- `GOTOOLCHAIN=go1.25.11 go test ./...` passed, including 0 through 2,048 CPUs.
- `GOTOOLCHAIN=go1.25.11 go build -o /tmp/pulsed-preview/pulsed ./` passed.
- `scripts/check-dashboard.mjs` passed in local headless Chrome: six widths in
  both densities, a 1,024-core expanded panel, filters, light theme, repeated
  refresh, pause/resume, cross-origin state, blocked storage, and no-JavaScript
  core disclosure. Desktop and mobile screenshots were inspected.
- Verification used synthetic fixtures, not a deployed cluster.
- The installed Go 1.27 toolchain fails to compile the existing cockroachdb/swiss
  dependency; validation used the Go 1.25 series configured by repository CI.
