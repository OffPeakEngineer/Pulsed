---
id: task-20261004-versytl-dashboard
title: Build a Versytl dashboard with CPU observation history
type: feature
priority: normal
effort: trip
creator: codex
owner: ""
created: 2026-10-04
---

## Problem

Pulsed's embedded HTML dashboard already supports filters, densities, core
inspection, and peer rebasing, but full document refreshes interrupt inspection
and the latest heartbeat cannot explain how load changed. Use Versytl's actual
scene and dashboard components to give operators a useful focused view while
preserving a self-contained daemon.

## Offerings reviewed

Reviewed the local `versytl` link to `O:/libraries/versytl`, including source,
package exports, Stasis Pages' host, and its planning board. These are checkout
capabilities, not a claim that the packages or sites are deployed or published.

| Offering | Fit for Pulsed | Decision |
| --- | --- | --- |
| Stasis Pages (`stasis/app/app.vue`) | Dashboard tabs, SVG documents, keyboard page navigation, static generation | Extend the pinned Nuxt layer with a local Pulsed `SvgDashboard` and embed static output. The upstream component fetches `/pipelines`, so the Pulsed source remains application-owned. |
| `@versytl/stasis` (`stasis/packages/stasis/src/index.ts`) | Portable page metadata, parse/serialize, SVG validation | Use now for CPU dashboard documents and exports with `source.type: pulsed`. This does not activate a Pulsed adapter in upstream Pages. |
| `@versytl/shipkit/dashboard` | `createTrendChartNode`, radial gauges, level indicators, systems boards, dashboard cards | Use the trend factory now, with application-owned timestamp positioning and discontinuities. Its built-in x axis spaces values by index and connects all samples, so it needs a small adapter for real telemetry. |
| `@versytl/shipkit/progress` | Determinate normalized bars | Useful for focused CPU/memory meters; keep semantic HTML meters for the accessible overview. |
| `@versytl/shipkit/card` | Bounds, theme, badge, selection, arbitrary child scene nodes | Use for future SVG-native node cards and selection rather than reimplementing card geometry. |
| `@versytl/scene` | Validated renderer-neutral scenes, deterministic SVG, round-trip metadata | Use now to render/export Shipkit charts. Keep IDs independent of untrusted node names. |
| `@versytl/core` | Vue SVG primitives and `SvgScene`, controlled interaction | Use with the full Pages host later. The initial slice uses scene serialization without carrying Vue in the daemon. |
| Clay | Responsive measured SVG layout via WASM | Consider when full SVG dashboard pages need fluid layout; CSS grid already handles the current HTML overview. |
| Tween | Deterministic interpolation and Vue number adapter | Consider gentle transitions later. Do not interpolate missing samples or smooth away observed spikes. Honor reduced motion. |
| CTX | WASM software rasterizer for scene graphs | Useful for a future canvas/embedded target, unnecessary for the browser's native SVG renderer. |
| Bridge | Typed transport-neutral source adapter and explicit versioned registry | Register `pulsed/snapshot@1`; the host owns fetching, scheduling, and origin policy. |
| objects, physics, Box2D, Rapier, ISO, Yjs | Editor, simulation, synchronization, or alternate presentation concerns | Outside this monitoring UI slice. |

## Data contract and history scope

- Pebble currently overwrites `node/<name>` with the last `NodeStats`; no old CPU
  samples can be reconstructed. Do not invent history or interpret load averages
  as CPU samples.
- Capture only readings this daemon actually observes. Sample the existing
  cluster snapshot every two seconds, deduplicate heartbeat timestamps, and keep
  at most 150 readings per node within five minutes. Bound tracked nodes too.
- Retain mean CPU and peak logical CPU, timestamp, and advertised TTL. Missing,
  invalid, future, and offline readings do not become zero-usage observations.
- Use true timestamp spacing on a fixed 0–100% axis. Break lines across gaps
  longer than the heartbeat TTL. Label observation count, retention window, and
  empty/single-sample states.
- The ring is process-local and resets on restart. Peer rebasing switches to that
  peer's available observations. This is the small recent-trend slice of
  `history_and_navigable_dashboard.md`, not its persistent recall/share API.

## First implementation slice

1. Pin a minimal source snapshot of Scene, Shipkit dashboard factories, and the
   headless Stasis package in Pulsed, with repository commits and per-file hashes.
   Build local browser ES modules with TypeScript and embed generated assets in
   Go. Normal `go build` and released binaries require no external checkout,
   package registry, CDN, Vue server, or Node runtime.
2. Add a focus panel above the node overview: node selection, mean/peak CPU
   history, window controls, and export of a Stasis-compatible SVG carrying
   Versytl scene metadata. Keep core inspection and peer links in the overview.
3. Fetch and patch same-view snapshots in place. Preserve filters, density,
   expanded cores, scroll, keyboard focus, selected node, and history window.
   Keep existing navigation when refresh rebases to a different peer route.
4. Keep a readable server-rendered view without JavaScript. Show current values
   and explain history availability; use native controls around SVG.
5. Verify retention/deduplication, concurrency, missing data, escaping, gaps,
   irregular timestamps, portable metadata, responsive layout, refresh state,
   and peer/proxy routing.

## Full Stasis Pages follow-up

- Introduce a typed `pulsed` source adapter for snapshot, node, CPU-history, and
  freshness resources; avoid mapping heartbeat health onto pipeline statuses.
- Generate Overview, Node detail, and History SVG page documents with stable
  binding IDs and ordinary source metadata. Keep the focused HTML fallback.
- Embed generated Nuxt static assets under a documented route, with all browser
  requests preserving `pulsed_node` and reverse-proxy prefixes.
- Hydrate Shipkit component payloads through a registry rather than flattening
  them into fixed SVG text. Upstream Stasis has registry/component hydration
  work on its board; verify it before treating it as an available feature.
- Add memory/load history only when real retained samples exist. Evaluate
  persistent capture and sharing separately against the existing history epic.
- Replace the vendored development snapshot with authenticated, pinned package
  releases when their distribution contract is ready.

## Done when

- [x] First slice has real Versytl imports, embedded assets, and reproducible builds
- [x] Focused node inspection and CPU history work using available observations
- [x] Missing history and peer-local retention are explained in the UI/docs
- [x] Same-view updates preserve operator state, pause, and keyboard interaction
- [x] Stasis-compatible exported SVG retains Versytl component metadata
- [x] Go, frontend, and responsive browser checks pass
- [x] Full Stasis Pages host and typed Bridge source adapter are embedded

## Full Pages implementation

`frontend/pages` extends the unmodified Stasis Nuxt layer. The host keeps its
page discovery, tabs, keyboard navigation, and SVG document contract; the local
component consumes the explicit Bridge source and provider registry. Overview
uses Shipkit cards/progress bars, Node uses radial CPU and memory level widgets,
and History uses the timestamp/gap-aware trend adapter. Exported pages retain
provider and Shipkit metadata and can be hydrated again. Unknown provider
versions preserve the authored view.

`/api/v1/snapshot`, `/nodes`, and `/cpu-history` expose typed snapshots, with
nullable unavailable readings and opt-in core detail. `/pages/` serves embedded
static output with incoming proxy prefix and peer query. Lazy JS is bundled and
CSS is linked with peer identity; no runtime Node server or upstream pipeline
API is required. Classic navigation carries view preferences between hosts.

Search, sorting, compact density, themes, pause/manual refresh, missing-node
states, last-snapshot failure retention, bounded core disclosure, and 24-card
pagination support ordinary operator work. Hash navigation normalizes the
Nuxt base path to prevent duplicated proxy prefixes. A no-JavaScript link
returns to the classic dashboard with the same routed peer.

Local Go tests/vet/build, nine frontend tests, Vue typechecking, and both browser
regression suites pass. Pages are checked at widths 320–2560, including mobile,
keyboard selection, exports, 1024 cores, failed refreshes, and a 40-node fixture.
Repeated static builds are checked for deterministic assets. These are local
checks, not evidence of a deployment on the user's cluster.

## First-slice validation

Local `go test ./...`, `go vet ./...`, Go build, and `npm run test:ui` pass.
Browser checks use a synthetic mixed-hardware cluster at widths 320–2560 in
both densities, touch layouts, blocked storage, and disabled JavaScript. SVG
exports retain Shipkit component and Stasis page metadata; history tests cover
deduplication, time/point/node bounds, invalid readings, and concurrent capture.
These checks do not establish a deployed result on the user's cluster.

Native race tests are unsupported on Windows ARM64; a local Linux ARM64 WSL
race run now passes. The hosted Linux CI race job remains required. The existing
npm audit gate reported 14 high and one
moderate finding in the first slice's release-tool dependencies. After adding
the Nuxt build tooling and applying compatible patches, 21 high and one moderate
remain. Force fixes suggest breaking downgrades and were not applied; the audit
gate still needs separate dependency remediation.

## v1.8.0 release preparation

Remote tags were checked on 2026-10-04: the latest is `v1.7.0`. The installed
semantic-release commit analyzer classifies the two subsequent feature commits
as a minor release, making `v1.8.0` the expected next stable version. Keep version
selection in semantic-release; do not create a manual stable tag from this plan.

Draft release notes:

- Add embedded Versytl Stasis Overview, Node detail, and CPU History pages, with
  Shipkit cards, gauges, progress meters, and portable SVG export.
- Retain up to five minutes of per-core CPU observations on the serving peer,
  with all-core and 32-core views, a mean/peak option, usage-driven colors, and
  missing data and process-local retention shown explicitly.
- Add node search, sorting, density, themes, pause/manual refresh, core inspection,
  and failure recovery while retaining the classic dashboard.
- Preserve operator preferences, routed peer identity, and reverse-proxy prefixes
  across refresh and navigation; improve keyboard and mobile usability.
- Integrate the supplied Pulsed logo and browser icon. All assets stay embedded
  in the single executable, with no Node runtime or external asset host required.

Release candidate binaries use `v1.8.0-rc.1` for local review and testing. Their
six OS/architecture filenames and `checksums.sha256` match the existing build
script and GitLab Generic Package Registry release manifest. Release notes are
draft content; no tag or publication is created by preparation.

Validation and remaining gates:

- Local Go tests/vet, nine frontend tests, Pages typechecking, and both browser
  suites pass, including the new artwork in light/dark and mobile layouts.
- The branding checkout's npm audit reported 21 high and one moderate finding
  in build and release dependencies. Its offered force fixes downgraded
  semantic-release and Nuxt. See the current follow-up audit below; do not
  weaken the audit gate or blindly apply breaking dependency changes.
- Linux ARM64 WSL race testing and vet pass using the CI-pinned Go 1.25.11 toolchain.
  Repeated frontend builds produce identical generated assets.
- All six `v1.8.0-rc.1` builds completed through `deploy/release/build-all.sh`;
  `sha256sum -c checksums.sha256` verified every binary. Candidates are in `dist/`.
- Hosted CI and stable publication remain pending. Resolve the dependency audit
  gate before publishing; no stable tag or release was created by this work.

## Logical CPU bars and history follow-up

Overview cards show the logical CPU count and one vertical bar for every
available core. Node detail exposes a labeled, scrollable bar chart and retains
the numeric inspector. Large machines keep all their cores; no cores are grouped
into peak bands in the Pages overview. Cards flow independently down each column
so a machine with many cores does not leave empty rows beneath its neighbors.
Node SVG exports include the gauges and all logical CPU bars.

CPU history defaults to individual logical CPUs, with an all-core view, groups
of 32 for identification, and a Mean / peak view. Each core keeps a stable hue;
its most recent observed utilization controls saturation. Usage at or below 1%
settles to grey, and active traces draw above idle traces. Color indicates usage,
not temperature. Group legends retain CPU indices, including on large machines.

The serving peer records actual core vectors at 0.1% precision, bounded by the
existing five-minute/150-observation retention and an 8 MiB vector budget across
nodes. If that budget fills, mean/peak observations continue and core history
leaves honest gaps. Missing vectors, changed CPU counts, and heartbeat gaps are
never joined into continuous traces. No past core data is inferred from means.
Core vectors are returned only for the selected history node; current readings
are requested only for the visible overview nodes or the selected node.

The Pages host now explicitly imports the pinned upstream Stasis app and its
CSS, keeping its tabs and navigation intact on the installed Nuxt 3 build.
Pages has its own TypeScript configuration so typechecking includes the Vue
components. Builds can use the canonical embedded PNG when the original design
exports have been removed from `assets/`. The host also fixes base/theme CSS
ordering so the upstream defaults cannot override the light theme or logo.

Follow-up validation on 2026-10-05:

- Go tests, Linux ARM64 race tests/vet, 15 frontend tests, and Pages Vue
  typechecking pass. Both browser suites pass, with synthetic 192/1,024-core
  machines, all-core/group/mean-peak views, saved-group reload, full-core SVG
  exports, bounded scrolling, light/dark themes, and widths 320–2560.
- All six local `v1.8.0-rc.1` candidates were rebuilt with this interface through
  `deploy/release/build-all.sh`; every checksum passes. No stable publication
  or tag was created.
- The current installed/locked dependency tree contains Nuxt 3.15.1 and
  semantic-release 15.14.0. `npm audit --audit-level=high` now reports 83 findings:
  3 low, 17 moderate, 59 high, and 4 critical. The release audit gate still fails
  and requires dependency remediation before stable publication. Dependency
  versions and the audit gate were not changed in this follow-up.

## Dashboard consolidation — 2026-10-07

The main dashboard is now the single performance overview. CPU group squares
are replaced by one fixed-scale bar per logical CPU, with a bounded, keyboard
scrollable area on large nodes. Its separate node inspector is removed; each
card opens the combined Stasis node page on the current serving peer.

Stasis now has two tabs: a node directory with role, logical CPU count, memory
capacity, and version; and CPU history above current node gauges/core detail.
`PULSED_ROLE` is an optional heartbeat label. Directory specs remain available
for offline nodes, while current utilization remains unavailable. The directory
does not request per-core data. The combined node view requests current cores
and per-core history together; exported SVGs retain both and their Scene payloads.
Existing `#history` bookmarks select the combined node tab after Nuxt mounts.

Validation: generated Pages build, Vue typecheck, 16 frontend tests, Go tests,
race tests, and vet pass. Both browser suites pass. The main dashboard browser suite passes across widths 320–2560, including
1,024-core scroll bounds, no-JavaScript inspection, and in-place refresh state.
The Stasis browser suite checks the node directory, combined layout, logical CPU
traces/grouping, exports, offline/empty states, proxy routing, mobile controls,
and legacy bookmarks. Desktop directory and mobile combined-page screenshots
were visually inspected using synthetic data. Live cluster deployment remains
untested; no release or deployment was performed.

## Related planning

- `history_and_navigable_dashboard.md`
- `pluggable_dashboard_themes.md`
- Versytl Stasis: `task-20260816-pages-runtime-hydration`,
  `task-20260814-component-adapter-registry`, and
  `task-20260814-shipkit-component-payloads`
